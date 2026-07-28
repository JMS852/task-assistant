export {};

declare global {
  interface Window {
    electronAPI?: {
      getTasks: () => Promise<any[]>;
      updateTaskStatus: (id: string, status: string) => Promise<{ success: boolean }>;
      enhanceTask: (taskId: string) => Promise<{ background?: string; subtasks?: string[]; priority_suggestion?: string; priority_reason?: string; related_task_ids?: string[]; suggested_deadline?: string | null; notes?: string; error?: string }>;
      askQuery: (question: string) => Promise<{ answer?: string; relevant_task_ids?: string[]; suggestion?: string; error?: string }>;
      getBriefing: () => Promise<{ date?: string; top_priorities?: any[]; recently_completed?: any[]; expiring_soon?: any[]; stats?: any; ai_advice?: string; error?: string }>;
      getSettings: () => Promise<any[]>;
      saveSettings: (settings: any[]) => Promise<{ success: boolean }>;
      createTask: (data: any) => Promise<any>;
      createDemoTasks: () => Promise<{ success: boolean; count?: number; message?: string }>;
      getCompletedTasks: () => Promise<any[]>;
      deleteCompletedTasks: () => Promise<{ success: boolean }>;
      startCollector: () => Promise<{ success: boolean }>;
      stopCollector: () => Promise<{ success: boolean }>;
      getMonitorStatus: () => Promise<{ active: boolean }>;
      onToggleMonitor: (cb: (active: boolean) => void) => (() => void) | void;
      onNavigate: (cb: (page: string) => void) => (() => void) | void;
      onNewTask: (cb: (task: any) => void) => (() => void) | void;
      onMessageCaptured: (cb: (msg: any) => void) => (() => void) | void;
      onListenerStatus: (cb: (status: any) => void) => (() => void) | void;
      onRecognitionResult: (cb: (result: any) => void) => (() => void) | void;
      scanHistory: (maxDays?: number) => Promise<{ success: boolean; error?: string }>;
      onHistoryScanEvent: (cb: (event: string, data: any) => void) => (() => void) | void;
      testMessage: (content: string, sender?: string) => Promise<{ success: boolean }>;
      onTriggerBriefing: (cb: () => void) => (() => void) | void;
    };
  }
}
