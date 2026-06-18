import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import './SmartExecute.css';

interface Props {
  taskId: string;
  taskTitle: string;
  onClose: () => void;
}

const levels = [
  { key: 'L1', title: '快速模式', desc: '仅主 AI · 30s 超时', icon: '⚡', color: '#30a46c' },
  { key: 'L2', title: '标准模式', desc: '2 个参考 AI · 120s 超时', icon: '🔄', color: '#4f6ef7' },
  { key: 'L3', title: '深度模式', desc: '3 个参考 AI + 沙箱验证 · 180s 超时', icon: '🧠', color: '#7c5cfc' },
];

export function SmartExecute({ taskId, taskTitle, onClose }: Props) {
  const [level, setLevel] = useState<'L1' | 'L2' | 'L3'>('L2');
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const { executeTask } = useApi();

  const handleExecute = async () => {
    setExecuting(true);
    setResult(null);
    setProgress(10);

    const messages = ['正在分析任务需求...', '分解子任务并分派 AI...', '各 AI 模型并行执行中...', '验证结果一致性...', '主 AI 综合最终答案...'];
    let step = 0;
    const msgInterval = setInterval(() => {
      if (step < messages.length) {
        setStatus(messages[step]);
        setProgress(20 + step * 16);
        step++;
      }
    }, 600);

    try {
      const res = await executeTask(taskId, level);
      clearInterval(msgInterval);
      setResult(res);
      setStatus('执行完成');
      setProgress(100);
    } catch (e) {
      clearInterval(msgInterval);
      setStatus('执行失败: ' + String(e));
      setProgress(0);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="se-container">
      <div className="se-card">
        <div className="se-header">
          <h2>🤖 智能执行</h2>
          <button className="se-btn-back" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="se-task-info">
          <span className="se-task-label">目标任务</span>
          <span className="se-task-name">{taskTitle}</span>
        </div>

        <div className="se-level-grid">
          {levels.map(l => (
            <button
              key={l.key}
              className={`se-level-card ${level === l.key ? 'active' : ''}`}
              onClick={() => !executing && setLevel(l.key as any)}
              disabled={executing}
              style={{ '--card-color': l.color } as React.CSSProperties}
            >
              <div className="se-level-icon">{l.icon}</div>
              <div className="se-level-title">{l.title}</div>
              <div className="se-level-desc">{l.desc}</div>
              {level === l.key && <div className="se-level-check">✓</div>}
            </button>
          ))}
        </div>

        {executing && (
          <div className="se-progress-section">
            <div className="se-progress-bar">
              <div className="se-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="se-progress-text">{status}</div>
          </div>
        )}

        {!executing && !result && (
          <button className="se-btn-launch" onClick={handleExecute}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            开始执行
          </button>
        )}

        {result && (
          <div className="se-result">
            <div className="se-result-header">
              <span className={`se-result-badge ${result.status}`}>
                {result.status === 'completed' ? '✅ 已完成' : '❌ 失败'}
              </span>
              <span className="se-result-level">{result.level}</span>
              <span className="se-result-time">{result.duration_ms}ms</span>
              {result.reference_results && (
                <span className="se-result-refs">{result.passed}/{result.reference_results} AI 通过</span>
              )}
            </div>

            {result.final_result && (
              <div className="se-result-content">
                {result.final_result.split('\n').map((line: string, i: number) => {
                  if (line.startsWith('##')) return <h3 key={i}>{line.replace(/^##\s*/, '')}</h3>;
                  if (line.startsWith('#') || line.startsWith('结论') || line.startsWith('依据') || line.startsWith('注意')) return <h4 key={i}>{line}</h4>;
                  if (line.startsWith('-') || line.startsWith('*') || line.startsWith('·')) return <li key={i}>{line.replace(/^[-*·]\s*/, '')}</li>;
                  if (line.trim() === '') return <br key={i} />;
                  return <p key={i}>{line}</p>;
                })}
              </div>
            )}

            {!result.final_result && (
              <pre className="se-result-raw">{JSON.stringify(result, null, 2)}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
