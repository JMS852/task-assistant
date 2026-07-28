import React, { useState } from 'react';
import './TaskEnhancement.css';

interface EnhancementResult {
  background?: string;
  subtasks?: string[];
  priority_suggestion?: string;
  priority_reason?: string;
  related_task_ids?: string[];
  suggested_deadline?: string | null;
  notes?: string;
  error?: string;
}

interface Props {
  taskTitle: string;
  loading: boolean;
  result: EnhancementResult | null;
  error: string;
  onAdopt: (suggestion: { subtasks?: string[]; priority?: string; deadline?: string }) => void;
  onClose: () => void;
}

export function TaskEnhancement({ taskTitle, loading, result, error, onAdopt, onClose }: Props) {
  const [adopted, setAdopted] = useState(false);

  if (loading) {
    return (
      <div className="te-container">
        <div className="te-card te-loading">
          <div className="te-spinner" />
          <p>AI 正在分析任务…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="te-container">
        <div className="te-card te-error">
          <h4>⚠️ 分析失败</h4>
          <p>{error}</p>
          <button className="te-btn-close" onClick={onClose}>关闭</button>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const priorityLabel: Record<string, string> = {
    high: '紧急',
    medium: '普通',
    low: '不急',
  };

  const handleAdopt = () => {
    onAdopt({
      subtasks: result.subtasks,
      priority: result.priority_suggestion,
      deadline: result.suggested_deadline || undefined,
    });
    setAdopted(true);
  };

  return (
    <div className="te-container">
      <div className="te-card">
        <div className="te-header">
          <h3>✨ AI 分析结果</h3>
          <button className="te-close" onClick={onClose}>✕</button>
        </div>

        {result.background && (
          <div className="te-section">
            <h4>📋 背景</h4>
            <p>{result.background}</p>
          </div>
        )}

        {result.subtasks && result.subtasks.length > 0 && (
          <div className="te-section">
            <h4>📝 建议子任务</h4>
            <ul>
              {result.subtasks.map((s: string, i: number) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {result.priority_suggestion && (
          <div className="te-section">
            <h4>🎯 优先级建议</h4>
            <span className={`te-priority te-prio-${result.priority_suggestion}`}>
              {priorityLabel[result.priority_suggestion] || result.priority_suggestion}
            </span>
            {result.priority_reason && <p>{result.priority_reason}</p>}
          </div>
        )}

        {result.notes && (
          <div className="te-section">
            <h4>💡 备注</h4>
            <p>{result.notes}</p>
          </div>
        )}

        <div className="te-actions">
          <button
            className={`te-btn-adopt ${adopted ? 'adopted' : ''}`}
            onClick={handleAdopt}
            disabled={adopted}
          >
            {adopted ? '✓ 已采纳' : '采纳建议'}
          </button>
        </div>
      </div>
    </div>
  );
}
