import React, { useState, useEffect, useCallback } from 'react';
import { useTasks } from './hooks/useTasks';
import { useApi } from './hooks/useApi';
import { TaskList } from './components/TaskList';
import { TaskDetail } from './components/TaskDetail';
import { Settings } from './components/Settings';
import { HistoryScan } from './components/HistoryScan';
import { ChatPanel } from './components/ChatPanel';
import { DailyBriefing } from './components/DailyBriefing';
import { Task } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useI18n, format } from './i18n';

export default function App() {
  const { t } = useI18n();
  const { tasks, completedTasks, loading, monitorActive, statusTooltip, capturedMsgs, completeTask, refresh, demo, refreshCompleted, clearCompleted, addTask, toggleMonitor } = useTasks();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistoryScan, setShowHistoryScan] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const [briefing, setBriefing] = useState<any>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [historyScanning, setHistoryScanning] = useState(false);
  const [historyScanMsg, setHistoryScanMsg] = useState('');

  const api = useApi();

  const refreshBriefing = useCallback(async () => {
    setBriefingLoading(true);
    try {
      const b = await api.getBriefing();
      setBriefing(b);
    } catch (e) {
      console.error('Briefing fetch failed:', e);
    } finally {
      setBriefingLoading(false);
    }
  }, [api]);

  // Load briefing on mount
  useEffect(() => { refreshBriefing(); }, [refreshBriefing]);

  // Listen for 9am trigger from Electron
  useEffect(() => {
    if (!window.electronAPI?.onTriggerBriefing) return;
    const unsub = window.electronAPI.onTriggerBriefing(() => {
      refreshBriefing();
    });
    return () => { if (unsub) unsub(); };
  }, [refreshBriefing]);

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
          <DailyBriefing data={briefing} loading={briefingLoading} onRefresh={refreshBriefing} />
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
          ) : selectedTask ? (
            <TaskDetail
              key={selectedTask.id}
              task={selectedTask}
              onComplete={(id) => { completeTask(id); setSelectedTask(null); }}
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
      <ChatPanel
        visible={chatVisible}
        onToggle={() => setChatVisible(!chatVisible)}
        onSelectTask={(id) => {
          const task = tasks.find(t => t.id === id);
          if (task) { setSelectedTask(task); setChatVisible(false); }
        }}
      />
    </div>
  );
}
