import React, { useState } from 'react';
import { useTasks } from './hooks/useTasks';
import { TaskList } from './components/TaskList';
import { TaskDetail } from './components/TaskDetail';
import { Settings } from './components/Settings';
import { SmartExecute } from './components/SmartExecute';
import { Task } from './types';
import { useI18n, format } from './i18n';

export default function App() {
  const { t } = useI18n();
  const { tasks, loading, completeTask, refresh, demo } = useTasks();
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
          <span className="app-title">{t.app.title}</span>
        </div>
        <div className="app-header-right">
          {activeCount > 0 && (
            <div className="header-badge">
              <span className="dot" />
              {format(t.app.taskCount, { count: activeCount })}
            </div>
          )}
          <button className="btn-icon" onClick={() => setShowSettings(true)} title={t.app.settings}>⚙</button>
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
            onDemo={demo}
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
              <h3>{t.app.emptyTitle}</h3>
              <p>{t.app.emptyDesc}<br />{t.app.emptyHint}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
