import React, { useState } from 'react';
import { Task } from '../types';
import { useI18n, format } from '../i18n';
import './TaskList.css';

interface Props {
  tasks: Task[];
  loading: boolean;
  selectedId?: string;
  onSelect: (t: Task) => void;
  onComplete: (id: string) => void;
  onRefresh: () => void;
  onDemo?: () => void;
}

export function TaskList({ tasks, loading, selectedId, onSelect, onComplete, onRefresh, onDemo }: Props) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [search, setSearch] = useState('');

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
  };

  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const filtered = activeTasks.filter(t => {
    if (filter !== 'all' && t.priority !== filter) return false;
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
    return (
      <div
        key={task.id}
        className={`tl-item ${selectedId === task.id ? 'selected' : ''}`}
        onClick={() => onSelect(task)}
      >
        <div className="tl-item-priority" style={{ color: cfg.color }} title={plabel}>
          {cfg.icon}
        </div>
        <div className="tl-item-body">
          <div className="tl-item-title">{task.title || t.taskList.untitled}</div>
          <div className="tl-item-meta">
            <span className="tl-item-source">{sourceIcon[task.source]}</span>
            <span>{task.sender}</span>
            {task.deadline && <span className="tl-item-deadline">{t.taskList.deadlinePrefix} {task.deadline}</span>}
          </div>
        </div>
        <div className="tl-item-actions">
          {task.context_missing && <span className="tl-badge-warn" title={t.taskList.missingContext}>!</span>}
          <button
            className="tl-btn-check"
            onClick={e => { e.stopPropagation(); onComplete(task.id); }}
            title={t.taskList.markComplete}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
          </button>
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

  return (
    <div className="tl-container">
      <div className="tl-header">
        <span className="tl-header-title">{t.taskList.title}</span>
        <div className="tl-header-actions">
          {onDemo && activeTasks.length === 0 && (
            <button className="tl-btn-demo" onClick={onDemo}>{t.taskList.demoBtn}</button>
          )}
          <button className="tl-btn-refresh" onClick={onRefresh} title={t.taskList.refresh}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6"/><path d="M3.5 15a9 9 0 102.1-9.4L1 10"/></svg>
          </button>
        </div>
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
      </div>

      <div className="tl-list">
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
            {onDemo && (
              <button className="tl-btn-demo tl-btn-demo-lg" onClick={onDemo}>{t.taskList.demoBtn}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
