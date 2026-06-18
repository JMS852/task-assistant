import React from 'react';
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

export function TaskList({ tasks, loading, selectedId, onSelect, onComplete, onRefresh }: Props) {
  const high = tasks.filter(t => t.priority === 'high' && t.status !== 'completed');
  const medium = tasks.filter(t => t.priority === 'medium' && t.status !== 'completed');
  const low = tasks.filter(t => t.priority === 'low' && t.status !== 'completed');

  const renderGroup = (label: string, items: Task[], color: string) => (
    <div className="task-group">
      <div className="group-header" style={{ borderLeftColor: color }}>{label} ({items.length})</div>
      {items.map(t => (
        <div
          key={t.id}
          className={`task-item ${selectedId === t.id ? 'selected' : ''}`}
          onClick={() => onSelect(t)}
        >
          <div className="task-title">{t.title || '(无标题)'}</div>
          <div className="task-meta">{t.sender} · {t.source === 'wechat' ? '微信' : 'QQ'}</div>
          {t.context_missing ? <span className="badge-warn">缺上下文</span> : null}
          <button className="btn-done" onClick={e => { e.stopPropagation(); onComplete(t.id); }}>✓</button>
        </div>
      ))}
    </div>
  );

  if (loading) return <div className="task-list-loading">加载中...</div>;

  return (
    <div className="task-list">
      <div className="task-list-header">
        <span>待办清单</span>
        <button onClick={onRefresh} className="btn-refresh">刷新</button>
      </div>
      {renderGroup('高优先', high, '#e74c3c')}
      {renderGroup('中优先', medium, '#f39c12')}
      {renderGroup('低优先', low, '#27ae60')}
      {high.length === 0 && medium.length === 0 && low.length === 0 && (
        <div className="empty-tasks">暂无待办任务</div>
      )}
    </div>
  );
}
