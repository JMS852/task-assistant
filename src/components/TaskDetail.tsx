import React, { useState } from 'react';
import { Task } from '../types';
import { useI18n, format } from '../i18n';
import { useApi } from '../hooks/useApi';
import { TaskEnhancement } from './TaskEnhancement';
import './TaskDetail.css';

interface Props {
  task: Task;
  onComplete: (id: string) => void;
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function TaskDetail({ task, onComplete }: Props) {
  const api = useApi();
  const [enhancing, setEnhancing] = useState(false);
  const [enhancement, setEnhancement] = useState<any>(null);
  const [enhanceError, setEnhanceError] = useState('');

  const handleEnhance = async () => {
    setEnhancing(true);
    setEnhanceError('');
    setEnhancement(null);
    try {
      const res = await api.enhanceTask(task.id);
      if (res?.error) setEnhanceError(res.error);
      else setEnhancement(res);
    } catch (e: any) {
      setEnhanceError(e.message || String(e));
    } finally {
      setEnhancing(false);
    }
  };
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

        {(enhancement || enhancing || enhanceError) && (
          <TaskEnhancement
            taskTitle={task.title}
            loading={enhancing}
            result={enhancement}
            error={enhanceError}
            onAdopt={(s) => {
              console.log('[TaskDetail] Adopted suggestions:', s);
            }}
            onClose={() => { setEnhancement(null); setEnhanceError(''); }}
          />
        )}

        <div className="td-actions">
          <button className="td-btn-execute" onClick={handleEnhance} disabled={enhancing}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            {enhancing ? '分析中…' : 'AI 分析'}
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
