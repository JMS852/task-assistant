import React, { useState, useEffect } from 'react';
import { Task } from '../types';
import { useI18n, format } from '../i18n';
import { AddTaskModal } from './AddTaskModal';
import './TaskList.css';

interface Props {
  tasks: Task[];
  completedTasks: Task[];
  loading: boolean;
  selectedId?: string;
  onSelect: (t: Task) => void;
  onComplete: (id: string) => void;
  onRefresh: () => void;
  onDemo?: () => void;
  onRefreshCompleted: () => void;
  onClearCompleted: () => void;
  onScanHistory?: () => void;
  historyScanning?: boolean;
  historyScanMsg?: string;
  onAddTask?: (data: {
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    deadline: string;
    source: 'manual';
    sender: string;
  }) => void;
  capturedMsgs?: { sender: string; content: string; source: string; captured_at: string; isTask?: boolean; confidence?: number; rationale?: string }[];
}

export function TaskList({ tasks, completedTasks, loading, selectedId, onSelect, onComplete, onRefresh, onDemo, onRefreshCompleted, onClearCompleted, onScanHistory, historyScanning, historyScanMsg, onAddTask, capturedMsgs }: Props) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low' | 'completed'>('all');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (filter === 'completed') onRefreshCompleted();
  }, [filter, onRefreshCompleted]);

  const priorityConfig: Record<string, { color: string; icon: string }> = {
    high: { color: '#e5484d', icon: '●' },
    medium: { color: '#f5a623', icon: '◐' },
    low: { color: '#30a46c', icon: '○' },
  };

  const priorityLabels: Record<string, string> = {
    high: t.common.priorityHigh,
    medium: t.common.priorityMedium,
    low: t.common.priorityLow,
  };

  const sourceIcon: Record<string, string> = {
    wechat: t.common.sourceIconWechat,
    qq: t.common.sourceIconQQ,
  };

  const filterLabels: Record<string, string> = {
    all: t.taskList.filterAll,
    high: t.taskList.filterHigh,
    medium: t.taskList.filterMedium,
    low: t.taskList.filterLow,
    completed: t.taskList.filterCompleted,
  };

  const showingCompleted = filter === 'completed';

  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const sourceList = showingCompleted ? completedTasks : activeTasks;

  const filtered = sourceList.filter(t => {
    if (filter !== 'all' && filter !== 'completed' && t.priority !== filter) return false;
    if (search && !t.title.includes(search) && !t.sender.includes(search)) return false;
    return true;
  });

  const groups = {
    high: filtered.filter(t => t.priority === 'high'),
    medium: filtered.filter(t => t.priority === 'medium'),
    low: filtered.filter(t => t.priority === 'low'),
  };

  if (loading) {
    return (
      <div className="tl-container">
        <div className="tl-header">
          <span className="tl-header-title">{t.taskList.title}</span>
        </div>
        <div className="tl-loading">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="tl-skeleton">
              <div className="skeleton-line w-70" />
              <div className="skeleton-line w-40" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const renderItem = (task: Task) => {
    const cfg = priorityConfig[task.priority];
    const plabel = priorityLabels[task.priority];
    const isDone = task.status === 'completed';
    return (
      <div
        key={task.id}
        className={`tl-item ${selectedId === task.id ? 'selected' : ''} ${isDone ? 'completed' : ''}`}
        onClick={() => onSelect(task)}
      >
        <div className="tl-item-priority" style={{ color: isDone ? '#30a46c' : cfg.color }} title={plabel}>
          {isDone ? '✓' : cfg.icon}
        </div>
        <div className="tl-item-body">
          <div className="tl-item-title">{task.title || t.taskList.untitled}</div>
          <div className="tl-item-meta">
            <span className="tl-item-source">{sourceIcon[task.source]}</span>
            <span>{format(t.taskList.taskFrom, { sender: task.sender })}</span>
            {task.deadline && <span className="tl-item-deadline">{t.taskList.deadlinePrefix} {task.deadline}</span>}
          </div>
        </div>
        <div className="tl-item-actions">
          {task.context_missing && <span className="tl-badge-warn" title={t.taskList.missingContext}>!</span>}
          {!isDone && (
            <button
              className="tl-btn-check"
              onClick={e => { e.stopPropagation(); onComplete(task.id); }}
              title={t.taskList.markComplete}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderGroup = (priority: 'high' | 'medium' | 'low', items: Task[]) => {
    if (items.length === 0) return null;
    const cfg = priorityConfig[priority];
    return (
      <div className="tl-group" key={priority}>
        <div className="tl-group-header">
          <span className="tl-group-dot" style={{ background: cfg.color }} />
          <span>{priorityLabels[priority]}</span>
          <span className="tl-group-count">{items.length}</span>
        </div>
        {items.map(renderItem)}
      </div>
    );
  };

  const handleClearCompleted = () => {
    if (window.confirm(t.taskList.confirmClear)) {
      onClearCompleted();
    }
  };

  return (
    <div className="tl-container">
      <div className="tl-header">
        <span className="tl-header-title">{t.taskList.title}</span>
        <div className="tl-header-actions">
          {onAddTask && !showingCompleted && (
            <button className="tl-btn-add" onClick={() => setShowAddModal(true)} title={t.addTask.title}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          )}
          {onDemo && activeTasks.length === 0 && !showingCompleted && (
            <button className="tl-btn-demo" onClick={onDemo}>{t.taskList.demoBtn}</button>
          )}
          {showingCompleted && completedTasks.length > 0 && (
            <button className="tl-btn-demo tl-btn-clear" onClick={handleClearCompleted}>{t.taskList.clearCompleted}</button>
          )}
          <button className="tl-btn-refresh" onClick={onRefresh} title={t.taskList.refresh}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6"/><path d="M3.5 15a9 9 0 102.1-9.4L1 10"/></svg>
          </button>
        </div>
        {showAddModal && onAddTask && (
          <AddTaskModal onClose={() => setShowAddModal(false)} onSubmit={onAddTask} />
        )}
      </div>

      <div className="tl-search-bar">
        <svg className="tl-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
        <input
          type="text"
          className="tl-search-input"
          placeholder={t.taskList.searchPlaceholder}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* ── History Scan Banner ── */}
      {onScanHistory && (
        <div
          className={`tl-scan-banner ${historyScanning ? 'scanning' : ''}`}
          onClick={historyScanning ? undefined : onScanHistory}
          title={historyScanMsg || '扫描7天内微信/QQ聊天记录，自动寻找任务'}
        >
          <span className="tl-scan-icon">{historyScanning ? '🔍' : '📥'}</span>
          <span className="tl-scan-text">
            {historyScanning ? (historyScanMsg || '扫描中…') : '从聊天记录中扫描任务'}
          </span>
          {!historyScanning && <span className="tl-scan-arrow">→</span>}
          {historyScanning && <span className="tl-scan-spinner" />}
        </div>
      )}

      <div className="tl-filter-bar">
        {(['all', 'high', 'medium', 'low'] as const).map(f => (
          <button
            key={f}
            className={`tl-filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {filterLabels[f]}
          </button>
        ))}
        <button
          className={`tl-filter-btn tl-filter-completed ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          {filterLabels.completed}
          {completedTasks.length > 0 && (
            <span className="tl-completed-count">{completedTasks.length}</span>
          )}
        </button>
      </div>

      <div className="tl-list">
        {showingCompleted ? (
          <>
            {filtered.length === 0 ? (
              <div className="tl-empty">
                <div style={{fontSize:28, marginBottom:8}}>📦</div>
                <div>{search ? format(t.taskList.noResult, { search }) : t.taskList.noCompleted}</div>
                <div className="tl-empty-sub">{t.taskList.noCompletedHint}</div>
              </div>
            ) : (
              filtered.map(renderItem)
            )}
          </>
        ) : (
          <>
            {renderGroup('high', groups.high)}
            {renderGroup('medium', groups.medium)}
            {renderGroup('low', groups.low)}
            {filtered.length === 0 && search && (
              <div className="tl-empty">
                <div style={{fontSize:28, marginBottom:8}}>🔍</div>
                <div>{format(t.taskList.noResult, { search })}</div>
              </div>
            )}
            {filtered.length === 0 && !search && activeTasks.length === 0 && (
              <div className="tl-empty">
                <div style={{fontSize:32, marginBottom:8}}>📋</div>
                <div>{t.taskList.noTasks}</div>
                <div className="tl-empty-sub">{t.taskList.noTasksHint}</div>
                <div className="tl-test-section">
                  <div className="tl-test-label">🔬 管线测试：</div>
                  {['帮我写一份周报', '麻烦你今天修复登录bug', '约周末聚餐记得订位'].map(msg => (
                    <button key={msg} className="tl-btn-test" onClick={() => window.electronAPI?.testMessage(msg)}>
                      "{msg}"
                    </button>
                  ))}
                </div>
                {onDemo && (
                  <button className="tl-btn-demo tl-btn-demo-lg" onClick={onDemo}>{t.taskList.demoBtn}</button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {capturedMsgs && capturedMsgs.length > 0 && !showingCompleted && (
        <div className="tl-capture-log">
          <div className="tl-capture-header">
            <span className="tl-capture-title">📡 实时捕获 ({capturedMsgs.length})</span>
          </div>
          <div className="tl-capture-list">
            {capturedMsgs.slice(0, 10).map((msg, i) => (
              <div key={i} className={`tl-capture-item ${msg.isTask ? 'is-task' : msg.confidence !== undefined ? 'not-task' : ''}`}>
                <span className="tl-capture-source">{msg.source === 'wechat' ? '💬' : msg.source === 'qq' ? '🐧' : '🔔'}</span>
                <span className="tl-capture-sender">{msg.sender || '未知'}</span>
                <span className="tl-capture-content">{msg.content.slice(0, 40)}{msg.content.length > 40 ? '…' : ''}</span>
                {msg.isTask && <span className="tl-capture-badge task" title="已识别为任务">✓</span>}
                {msg.confidence !== undefined && !msg.isTask && (
                  <span className="tl-capture-badge no-task" title={`置信度: ${(msg.confidence * 100).toFixed(0)}% | ${msg.rationale || ''}`}>✗</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
