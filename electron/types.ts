// ── Shared types for Electron main process ──
// Mirrors src/types/index.ts where applicable, since Electron (CommonJS)
// cannot directly import from src/ (ESNext).

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  deadline: string | null;
  source: string;
  sender: string;
  group_name: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  confidence: number;
  context_missing: number;
  created_at?: string;
  updated_at?: string;
}

export interface AIConfig {
  id: string;
  provider: string;
  api_key_encrypted: string;
  endpoint: string;
  enabled: boolean | number;
}

export interface ListenerStatus {
  state: 'idle' | 'starting' | 'running' | 'stopped' | 'error';
  windows_found: string[] | number;
  messages_captured: number;
  last_error: string;
}

export interface CapturedMessage {
  sender: string;
  content: string;
  source: string;
  captured_at: string;
}

export interface RecognitionResult {
  content: string;
  is_task: boolean;
  confidence: number;
  rationale: string;
  heuristic_score: number;
  heuristic_matches: string[];
}

export interface PythonBridgeOptions {
  onReady?: () => void;
  onNewTask?: (task: Task) => void;
  onStatus?: (status: ListenerStatus) => void;
  onMessage?: (msg: CapturedMessage) => void;
  onRecognition?: (result: RecognitionResult) => void;
  onHistory?: (event: string, data: unknown) => void;
}

export interface ExecutionResponse {
  execution_id?: string;
  level?: string;
  task_type?: string;
  reference_results?: number;
  passed?: number;
  final_result?: string;
  duration_ms?: number;
  status?: string;
  generated_files?: string[];
  output_dir?: string;
  error?: string;
}

export interface CreateTaskInput {
  title: string;
  description: string;
  priority: string;
  deadline: string;
  source: string;
  sender: string;
}
