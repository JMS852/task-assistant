import React from 'react';
import { Task } from '../types';
import './TaskDetail.css';

interface Props {
  task: Task;
  onComplete: (id: string) => void;
  onExecute: () => void;
}

const priorityLabel = { high: '紧急', medium: '普通', low: '不急' };
const statusLabel = { pending: '待处理', in_progress: '进行中', completed: '已完成' };

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function TaskDetail({ task, onComplete, onExecute }: Props) {
  const remaining = task.deadline ? daysUntil(task.deadline) : null;
  const isOverdue = remaining !== null && remaining < 0;

  return (
    <div className="td-container">
      <div className="td-card">
        <div className="td-card-header">
          <div className="td-title-row">
            <div className={`td-priority-indicator ${task.priority}`} />
            <h2>{task.title || '(无标题)'}</h2>
          </div>
          <span className={`td-status-chip ${task.status}`}>
            {statusLabel[task.status]}
          </span>
        </div>

        <div className="td-meta-grid">
          <div className="td-meta-item">
            <span className="td-meta-icon">👤</span>
            <div>
              <div className="td-meta-label">发送者</div>
              <div className="td-meta-value">{task.sender}</div>
            </div>
          </div>
          <div className="td-meta-item">
            <span className="td-meta-icon">{task.source === 'wechat' ? '💬' : '🐧'}</span>
            <div>
              <div className="td-meta-label">来源</div>
              <div className="td-meta-value">{task.source === 'wechat' ? '微信' : 'QQ'}</div>
            </div>
          </div>
          {task.group_name && (
            <div className="td-meta-item">
              <span className="td-meta-icon">👥</span>
              <div>
                <div className="td-meta-label">群聊</div>
                <div className="td-meta-value">{task.group_name}</div>
              </div>
            </div>
          )}
          <div className="td-meta-item">
            <span className="td-meta-icon">{isOverdue ? '🔴' : '📅'}</span>
            <div>
              <div className="td-meta-label">截止日期</div>
              <div className={`td-meta-value ${isOverdue ? 'overdue' : ''}`}>
                {task.deadline
                  ? `${task.deadline} (${isOverdue ? `已过期 ${Math.abs(remaining!)} 天` : `剩余 ${remaining} 天`})`
                  : '无截止日期'}
              </div>
            </div>
          </div>
          <div className="td-meta-item">
            <span className="td-meta-icon">🎯</span>
            <div>
              <div className="td-meta-label">优先级</div>
              <div className={`td-meta-value td-prio-${task.priority}`}>
                {priorityLabel[task.priority]}
              </div>
            </div>
          </div>
          <div className="td-meta-item">
            <span className="td-meta-icon">🤖</span>
            <div>
              <div className="td-meta-label">AI 置信度</div>
              <div className="td-meta-value">{Math.round(task.confidence * 100)}%</div>
            </div>
          </div>
        </div>

        <div className="td-section">
          <h3 className="td-section-title">📝 任务描述</h3>
          <p className="td-description">{task.description || '暂无描述'}</p>
        </div>

        {task.context_missing && (
          <div className="td-context-warning">
            <span>⚠️</span>
            <div>
              <strong>上下文不完整</strong>
              <p>无法获取完整的消息上下文，可能影响 AI 执行效果</p>
            </div>
            <button className="td-context-btn">补全</button>
          </div>
        )}

        <div className="td-actions">
          <button className="td-btn-execute" onClick={onExecute}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            智能执行
          </button>
          <button className="td-btn-complete" onClick={() => onComplete(task.id)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
            标记完成
          </button>
        </div>
      </div>
    </div>
  );
}
