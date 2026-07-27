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
  created_at: string;
  updated_at: string;
}

export interface RawMessage {
  id: string;
  source: string;
  sender: string;
  group_name: string | null;
  content: string;
  context_json: string | null;
  captured_at: string;
  processed: boolean;
}

export interface ExecutionResult {
  id: string;
  task_id: string;
  level: 'L1' | 'L2' | 'L3';
  main_model: string;
  reference_models: string[];
  result_json: string;
  files: string[];
  duration_ms: number;
  status: 'running' | 'completed' | 'failed';
  created_at: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  linked_task_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIConfig {
  id: string;
  provider: string;
  api_key_encrypted: string;
  endpoint: string;
  enabled: boolean;
}
