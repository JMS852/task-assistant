import React, { useState, useEffect, useCallback } from 'react';
import { useTasks } from './hooks/useTasks';
import { TaskList } from './components/TaskList';
import { TaskDetail } from './components/TaskDetail';
import { Settings } from './components/Settings';
import { SmartExecute } from './components/SmartExecute';
import { HistoryScan } from './components/HistoryScan';
import { Task } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useI18n, format } from './i18n';

export default function App() {
  const { t } = useI18n();
  const { tasks, completedTasks, loading, monitorActive, statusTooltip, capturedMsgs, completeTask, refresh, demo, refreshCompleted, clearCompleted, addTask, toggleMonitor } = useTasks();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [executingTask, setExecutingTask] = useState<Task | null>(null);
  const [showHistoryScan, setShowHistoryScan] = useState(false);
  const [historyScanning, setHistoryScanning] = useState(false);
  const [historyScanMsg, setHistoryScanMsg] = useState('');

  const activeCount = tasks.filter(t => t.status !== 'completed').length;

  // Listen for history scan events
  useEffect(() => {
    if (!window.electronAPI?.onHistoryScanEvent) return;
    const unsub = window.electronAPI.onHistoryScanEvent((event: string, data: any) => {
      if (event === 'history_scan_started') {
        setHistoryScanning(true);
        setHistoryScanMsg('正在扫描聊天记录…');
      } else if (event === 'history_scan_progress') {
        if (data.stage === 'scanning' && data.phase === 'reading') {
          setHistoryScanMsg(`扫描中: ${data.title || ''} (${data.current}/${data.total})`);
        } else if (data.stage === 'processing') {
          setHistoryScanMsg(`识别中: ${data.processed}/${data.total} (已找到 ${data.tasks_found} 个任务)`);
        }
      } else if (event === 'history_scan_complete') {
        setHistoryScanning(false);
        setHistoryScanMsg(`扫描完成: ${data.total_messages} 条消息, ${data.tasks_found} 个任务`);
      } else if (event === 'history_scan_collected') {
        setHistoryScanMsg(`收集完成: ${data.total_messages} 条消息, 正在识别任务…`);
      }
    });
    return () => { if (unsub) unsub(); };
  }, []);

  const startHistoryScan = useCallback(() => {
    setShowHistoryScan(true);
  }, []);

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
          <div className={`header-monitor ${monitorActive ? 'active' : ''}`} onClick={toggleMonitor} title={statusTooltip || (monitorActive ? '监听中 - 点击暂停' : '已暂停 - 点击启动')}>
            <span className="monitor-dot" />
            <span className="monitor-label">{monitorActive ? '监听中' : '已暂停'}</span>
          </div>
          <div className={`header-scan ${historyScanning ? 'scanning' : ''}`} onClick={startHistoryScan} title={historyScanMsg || '扫描最近7天的微信/QQ聊天记录，自动识别其中的任务和通知'}>
            <span className="monitor-label">{historyScanning ? '🔍 扫描中…' : '📥 扫描历史'}</span>
          </div>
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
            completedTasks={completedTasks}
            loading={loading}
            selectedId={selectedTask?.id}
            onSelect={setSelectedTask}
            onComplete={completeTask}
            onRefresh={refresh}
            onDemo={demo}
            onRefreshCompleted={refreshCompleted}
            onClearCompleted={clearCompleted}
            onScanHistory={startHistoryScan}
            historyScanning={historyScanning}
            historyScanMsg={historyScanMsg}
            onAddTask={addTask}
            capturedMsgs={capturedMsgs}
          />
        </div>
        <div className="panel-right">
          <ErrorBoundary>
            {showHistoryScan ? (
            <HistoryScan onClose={() => setShowHistoryScan(false)} />
          ) : executingTask ? (
            <SmartExecute
              key={executingTask.id}
              taskId={executingTask.id}
              taskTitle={executingTask.title}
              onClose={() => setExecutingTask(null)}
            />
          ) : selectedTask ? (
            <TaskDetail
              key={selectedTask.id}
              task={selectedTask}
              onComplete={(id) => { completeTask(id); setSelectedTask(null); }}
              onExecute={() => { console.log('[App] onExecute clicked, selectedTask:', selectedTask?.title); if (selectedTask) setExecutingTask(selectedTask); }}
            />
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <h3>{t.app.emptyTitle}</h3>
              <p>{t.app.emptyDesc}<br />{t.app.emptyHint}</p>
            </div>
          )}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
