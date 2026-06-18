import React from 'react';
import { Task } from '../types';
import './TaskDetail.css';

interface Props {
  task: Task;
  onComplete: (id: string) => void;
  onExecute: () => void;
}

export function TaskDetail({ task, onComplete, onExecute }: Props) {
  return (
    <div className="task-detail">
      <h2>{task.title || '(无标题)'}</h2>
      <div className="detail-meta">
        <span className={`priority-tag ${task.priority}`}>
          {{ high: '高优先', medium: '中优先', low: '低优先' }[task.priority]}
        </span>
        <span>来自 {task.sender}</span>
        <span>{task.source === 'wechat' ? '微信' : 'QQ'}</span>
        {task.deadline && <span>截止: {task.deadline}</span>}
      </div>
      <div className="detail-desc">
        <h3>描述</h3>
        <p>{task.description || '暂无描述'}</p>
      </div>
      {task.context_missing && (
        <div className="context-warning">上下文信息不完整，点击补全</div>
      )}
      <div className="detail-actions">
        <button className="btn-execute" onClick={onExecute}>
          智能执行
        </button>
        <button className="btn-complete" onClick={() => onComplete(task.id)}>标记完成</button>
      </div>
    </div>
  );
}
