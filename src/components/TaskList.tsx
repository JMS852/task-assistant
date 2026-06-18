import React, { useState } from 'react';
import { Task } from '../types';
import './TaskList.css';

interface Props {
  tasks: Task[];
  loading: boolean;
  selectedId?: string;
  onSelect: (t: Task) => void;
  onComplete: (id: string) => void;
  onRefresh: () => void;
}

const priorityConfig = {
  high: { label: '紧急', color: '#e5484d', icon: '●' },
  medium: { label: '普通', color: '#f5a623', icon: '◐' },
  low: { label: '不急', color: '#30a46c', icon: '○' },
};

const sourceIcon = { wechat: '💬', qq: '🐧' };

export function TaskList({ tasks, loading, selectedId, onSelect, onComplete, onRefresh }: Props) {
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [search, setSearch] = useState('');

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
          <span className="tl-header-title">待办清单</span>
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

  const renderItem = (t: Task) => {
    const cfg = priorityConfig[t.priority];
    return (
      <div
        key={t.id}
        className={`tl-item ${selectedId === t.id ? 'selected' : ''}`}
        onClick={() => onSelect(t)}
      >
        <div className="tl-item-priority" style={{ color: cfg.color }} title={cfg.label}>
          {cfg.icon}
        </div>
        <div className="tl-item-body">
          <div className="tl-item-title">{t.title || '(无标题)'}</div>
          <div className="tl-item-meta">
            <span className="tl-item-source">{sourceIcon[t.source]}</span>
            <span>{t.sender}</span>
            {t.deadline && <span className="tl-item-deadline">📅 {t.deadline}</span>}
          </div>
        </div>
        <div className="tl-item-actions">
          {t.context_missing && <span className="tl-badge-warn" title="缺少上下文">!</span>}
          <button
            className="tl-btn-check"
            onClick={e => { e.stopPropagation(); onComplete(t.id); }}
            title="标记完成"
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
          <span>{cfg.label}</span>
          <span className="tl-group-count">{items.length}</span>
        </div>
        {items.map(renderItem)}
      </div>
    );
  };

  return (
    <div className="tl-container">
      <div className="tl-header">
        <span className="tl-header-title">待办清单</span>
        <button className="tl-btn-refresh" onClick={onRefresh} title="刷新">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6"/><path d="M3.5 15a9 9 0 102.1-9.4L1 10"/></svg>
        </button>
      </div>

      <div className="tl-search-bar">
        <svg className="tl-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
        <input
          type="text"
          className="tl-search-input"
          placeholder="搜索任务或发送者..."
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
            {{ all: '全部', high: '紧急', medium: '普通', low: '不急' }[f]}
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
            <div>未找到 "{search}"</div>
          </div>
        )}
        {filtered.length === 0 && !search && activeTasks.length === 0 && (
          <div className="tl-empty">
            <div style={{fontSize:32, marginBottom:8}}>🎉</div>
            <div>暂无待办任务</div>
            <div className="tl-empty-sub">等待微信/QQ 消息采集...</div>
          </div>
        )}
      </div>
    </div>
  );
}
