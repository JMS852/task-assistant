import React from 'react';
import { Task } from '../types';
import { useI18n, format } from '../i18n';
import './TaskDetail.css';

interface Props {
  task: Task;
  onComplete: (id: string) => void;
  onExecute: () => void;
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function TaskDetail({ task, onComplete, onExecute }: Props) {
  const { t } = useI18n();
  const remaining = task.deadline ? daysUntil(task.deadline) : null;
  const isOverdue = remaining !== null && remaining < 0;

  const priorityLabel: Record<string, string> = {
    high: t.common.priorityHigh,
    medium: t.common.priorityMedium,
    low: t.common.priorityLow,
  };

  const statusLabel: Record<string, string> = {
    pending: t.common.statusPending,
    in_progress: t.common.statusInProgress,
    completed: t.common.statusCompleted,
  };

  return (
    <div className="td-container">
      <div className="td-card">
        <div className="td-card-header">
          <div className="td-title-row">
            <div className={`td-priority-indicator ${task.priority}`} />
            <h2>{task.title || t.taskDetail.untitled}</h2>
          </div>
          <span className={`td-status-chip ${task.status}`}>
            {statusLabel[task.status]}
          </span>
        </div>

        <div className="td-meta-grid">
          <div className="td-meta-item">
            <span className="td-meta-icon">👤</span>
            <div>
              <div className="td-meta-label">{t.taskDetail.sender}</div>
              <div className="td-meta-value">{task.sender}</div>
            </div>
          </div>
          <div className="td-meta-item">
            <span className="td-meta-icon">{task.source === 'wechat' ? t.common.sourceIconWechat : t.common.sourceIconQQ}</span>
            <div>
              <div className="td-meta-label">{t.taskDetail.source}</div>
              <div className="td-meta-value">{task.source === 'wechat' ? t.common.sourceWechat : t.common.sourceQQ}</div>
            </div>
          </div>
          {task.group_name && (
            <div className="td-meta-item">
              <span className="td-meta-icon">👥</span>
              <div>
                <div className="td-meta-label">{t.taskDetail.group}</div>
                <div className="td-meta-value">{task.group_name}</div>
              </div>
            </div>
          )}
          <div className="td-meta-item">
            <span className="td-meta-icon">{isOverdue ? '🔴' : '📅'}</span>
            <div>
              <div className="td-meta-label">{t.taskDetail.deadline}</div>
              <div className={`td-meta-value ${isOverdue ? 'overdue' : ''}`}>
                {task.deadline
                  ? `${task.deadline} (${isOverdue ? format(t.taskDetail.overdue, { days: Math.abs(remaining!) }) : format(t.taskDetail.remaining, { days: remaining! })})`
                  : t.taskDetail.noDeadline}
              </div>
            </div>
          </div>
          <div className="td-meta-item">
            <span className="td-meta-icon">🎯</span>
            <div>
              <div className="td-meta-label">{t.taskDetail.priority}</div>
              <div className={`td-meta-value td-prio-${task.priority}`}>
                {priorityLabel[task.priority]}
              </div>
            </div>
          </div>
          <div className="td-meta-item">
            <span className="td-meta-icon">🤖</span>
            <div>
              <div className="td-meta-label">{t.taskDetail.aiConfidence}</div>
              <div className="td-meta-value">{Math.round(task.confidence * 100)}%</div>
            </div>
          </div>
        </div>

        <div className="td-section">
          <h3 className="td-section-title">{t.taskDetail.description}</h3>
          <p className="td-description">{task.description || t.taskDetail.noDescription}</p>
        </div>

        {task.context_missing && (
          <div className="td-context-warning">
            <span>⚠️</span>
            <div>
              <strong>{t.taskDetail.contextMissing}</strong>
              <p>{t.taskDetail.contextMissingHint}</p>
            </div>
            <button className="td-context-btn">{t.taskDetail.completeContext}</button>
          </div>
        )}

        <div className="td-actions">
          <button className="td-btn-execute" onClick={onExecute}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            {t.taskDetail.smartExecute}
          </button>
          <button className="td-btn-complete" onClick={() => onComplete(task.id)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
            {t.taskDetail.markComplete}
          </button>
        </div>
      </div>
    </div>
  );
}
