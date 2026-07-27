import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import type { Task, ListenerStatus, CapturedMessage, RecognitionResult, PythonBridgeOptions, ExecutionResponse } from '../types';

let pythonProcess: ChildProcess | null = null;
let onNewTaskCb: ((task: Task) => void) | null = null;
let onReadyCb: (() => void) | null = null;
let onStatusCb: ((status: ListenerStatus) => void) | null = null;
let onMsgCb: ((msg: CapturedMessage) => void) | null = null;
let onRecogCb: ((result: RecognitionResult) => void) | null = null;
let onHistoryCb: ((event: string, data: unknown) => void) | null = null;

// Map-based promise mechanism for concurrent request-response with Python.
// Each request gets a unique ID so concurrent calls don't overwrite each other.
const pendingExecMap = new Map<string, { resolve: (result: ExecutionResponse) => void; timer: NodeJS.Timeout }>();
let execCounter = 0;

export function startPythonBackend(options?: PythonBridgeOptions): void {
  if (options?.onNewTask) onNewTaskCb = options.onNewTask;
  if (options?.onReady) onReadyCb = options.onReady;
  if (options?.onStatus) onStatusCb = options.onStatus;
  if (options?.onMessage) onMsgCb = options.onMessage;
  if (options?.onRecognition) onRecogCb = options.onRecognition;
  if (options?.onHistory) onHistoryCb = options.onHistory;

  const pythonPath = path.join(__dirname, '..', '..', 'python', 'main.py');
  // Try common Python commands — Windows uses 'python', macOS/Linux use 'python3'
  const pythonExe = process.platform === 'win32' ? 'python' : 'python3';
  pythonProcess = spawn(pythonExe, [pythonPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: path.join(__dirname, '..', '..', 'python'),
    env: {
      ...process.env,
    },
  });

  pythonProcess.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        if (msg.status === 'ready') {
          console.log('[Python] Backend ready');
          onReadyCb?.();
        } else if (msg.event === 'new_task' && onNewTaskCb) {
          onNewTaskCb(msg.data);
        } else if (msg.event === 'task_executed') {
          const reqId = msg._requestId;
          if (reqId && pendingExecMap.has(reqId)) {
            const entry = pendingExecMap.get(reqId)!;
            clearTimeout(entry.timer);
            pendingExecMap.delete(reqId);
            entry.resolve(msg.data);
          }
        } else if (msg.event === 'recognition_result' && onRecogCb) {
          onRecogCb(msg.data);
        } else if (msg.event === 'message_captured' && onMsgCb) {
          onMsgCb(msg.data);
        } else if (msg.event === 'listener_status' && onStatusCb) {
          onStatusCb(msg.data);
        } else if (msg.event === 'error') {
          console.error('[Python]', msg.data);
          const reqId = msg._requestId;
          if (reqId && pendingExecMap.has(reqId)) {
            const entry = pendingExecMap.get(reqId)!;
            clearTimeout(entry.timer);
            pendingExecMap.delete(reqId);
            entry.resolve({ error: msg.data || 'Python error' });
          } else {
            // Fallback: resolve all pending to avoid stuck promises
            for (const [id, entry] of pendingExecMap) {
              clearTimeout(entry.timer);
              entry.resolve({ error: msg.data || 'Python error' });
              pendingExecMap.delete(id);
            }
          }
        } else if (msg.event && msg.event.startsWith('history_scan')) {
          onHistoryCb?.(msg.event, msg.data);
        } else {
          console.log('[Python]', msg);
        }
      } catch {
        console.log('[Python stdout]', line);
      }
    }
  });

  pythonProcess.stderr?.on('data', (data: Buffer) => {
    console.error('[Python stderr]', data.toString());
  });

  pythonProcess.on('error', (err) => {
    console.error('[Python] spawn error:', err.message);
    for (const [id, entry] of pendingExecMap) {
      clearTimeout(entry.timer);
      entry.resolve({ error: `Python process failed: ${err.message}` });
      pendingExecMap.delete(id);
    }
  });

  pythonProcess.on('exit', (code) => {
    console.log(`[Python] exited with code ${code}`);
    if (code !== 0 && code !== null && pendingExecMap.size > 0) {
      for (const [id, entry] of pendingExecMap) {
        clearTimeout(entry.timer);
        entry.resolve({ error: `Python exited with code ${code}` });
        pendingExecMap.delete(id);
      }
    }
  });
}

export function sendToPython(cmd: object): void {
  if (pythonProcess?.stdin?.writable) {
    pythonProcess.stdin.write(JSON.stringify(cmd) + '\n');
  } else {
    console.error('[Python] Cannot send: stdin pipe not writable. Process:', !!pythonProcess, pythonProcess?.exitCode);
  }
}

export function sendToPythonAndWait(cmd: object, timeoutMs = 120000): Promise<ExecutionResponse> {
  return new Promise((resolve, reject) => {
    const id = `exec_${++execCounter}`;
    const timer = setTimeout(() => {
      pendingExecMap.delete(id);
      reject(new Error('Execution timed out'));
    }, timeoutMs);
    pendingExecMap.set(id, { resolve, timer });
    sendToPython({ ...cmd, _requestId: id });
  });
}

export function stopPythonBackend(): void {
  pythonProcess?.kill();
}
