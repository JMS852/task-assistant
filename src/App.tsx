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

  const activeCount = tasks.filter(t => t.status !== 'completed').length;

  if (showSettings) {
    return <Settings onBack={() => setShowSettings(false)} />;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-logo">✦</div>
          <span className="app-title">待办助手</span>
        </div>
        <div className="app-header-right">
          {activeCount > 0 && (
            <div className="header-badge">
              <span className="dot" />
              {activeCount} 个待办
            </div>
          )}
          <button className="btn-icon" onClick={() => setShowSettings(true)} title="设置">⚙</button>
        </div>
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
              onComplete={(id) => { completeTask(id); setSelectedTask(null); }}
              onExecute={() => setExecutingTask(selectedTask)}
            />
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <h3>选择一个任务</h3>
              <p>从左侧列表中选择任务查看详情<br />或点击"智能执行"让 AI 帮你完成</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
