import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { ExecutionResult } from '../types';
import './SmartExecute.css';

interface Props {
  taskId: string;
  taskTitle: string;
  onClose: () => void;
}

export function SmartExecute({ taskId, taskTitle, onClose }: Props) {
  const [level, setLevel] = useState<'L1' | 'L2' | 'L3'>('L2');
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [status, setStatus] = useState('');
  const { executeTask } = useApi();

  const handleExecute = async () => {
    setExecuting(true);
    setStatus('正在分析任务...');
    try {
      const res = await executeTask(taskId, level);
      setResult(res);
      setStatus('执行完成');
    } catch (e) {
      setStatus('执行失败: ' + String(e));
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="smart-execute">
      <h3>智能执行: {taskTitle}</h3>

      <div className="level-selector">
        <label>执行级别:</label>
        <select value={level} onChange={e => setLevel(e.target.value as any)}>
          <option value="L1">L1 快速 — 仅主AI，适合简单任务</option>
          <option value="L2">L2 标准 — 2个参考AI，适合日常任务</option>
          <option value="L3">L3 深度 — 3个参考AI + 沙箱，适合复杂任务</option>
        </select>
      </div>

      <button
        className="btn-execute-primary"
        onClick={handleExecute}
        disabled={executing}
      >
        {executing ? '执行中...' : '开始执行'}
      </button>

      {status && <div className="status-msg">{status}</div>}

      {result && (
        <div className="result-panel">
          <div className="result-header">
            执行结果 · {result.level} · 耗时 {result.duration_ms}ms
          </div>
          <div className="result-body">
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        </div>
      )}

      <button className="btn-close" onClick={onClose}>关闭</button>
    </div>
  );
}
