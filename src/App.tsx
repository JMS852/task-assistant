import React, { useState } from 'react';
import { useTasks } from './hooks/useTasks';
import { TaskList } from './components/TaskList';
import { TaskDetail } from './components/TaskDetail';
import { Settings } from './components/Settings';
import { SmartExecute } from './components/SmartExecute';
import { Task } from './types';

export default function App() {
  const { tasks, loading, completeTask, refresh } = useTasks();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [executingTask, setExecutingTask] = useState<Task | null>(null);

  if (showSettings) {
    return <Settings onBack={() => setShowSettings(false)} />;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>待办助手</h1>
        <button onClick={() => setShowSettings(true)} className="btn-settings">设置</button>
      </header>
      <div className="app-body">
        <div className="panel-left">
          <TaskList
            tasks={tasks}
            loading={loading}
            selectedId={selectedTask?.id}
            onSelect={setSelectedTask}
            onComplete={completeTask}
            onRefresh={refresh}
          />
        </div>
        <div className="panel-right">
          {executingTask ? (
            <SmartExecute
              taskId={executingTask.id}
              taskTitle={executingTask.title}
              onClose={() => setExecutingTask(null)}
            />
          ) : selectedTask ? (
            <TaskDetail
              task={selectedTask}
              onComplete={completeTask}
              onExecute={() => setExecutingTask(selectedTask)}
            />
          ) : (
            <div className="empty-state">选择一个任务查看详情</div>
          )}
        </div>
      </div>
    </div>
  );
}
