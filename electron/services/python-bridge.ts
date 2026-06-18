import { spawn, ChildProcess } from 'child_process';
import path from 'path';

let pythonProcess: ChildProcess | null = null;

export function startPythonBackend(): void {
  const pythonPath = path.join(__dirname, '..', '..', 'python', 'main.py');
  const pythonExe = process.platform === 'win32' ? 'python' : 'python3';
  pythonProcess = spawn(pythonExe, [pythonPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: path.join(__dirname, '..', '..', 'python'),
  });

  pythonProcess.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        console.log('[Python]', msg);
      } catch {
        console.log('[Python stdout]', line);
      }
    }
  });

  pythonProcess.stderr?.on('data', (data: Buffer) => {
    console.error('[Python stderr]', data.toString());
  });

  pythonProcess.on('exit', (code) => {
    console.log(`[Python] exited with code ${code}`);
  });
}

export function sendToPython(cmd: object): void {
  if (pythonProcess?.stdin?.writable) {
    pythonProcess.stdin.write(JSON.stringify(cmd) + '\n');
  }
}

export function stopPythonBackend(): void {
  pythonProcess?.kill();
}
