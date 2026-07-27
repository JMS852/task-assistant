import React, { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { useI18n } from '../i18n';
import './SmartExecute.css';

interface Props {
  taskId: string;
  taskTitle: string;
  onClose: () => void;
}

const levels = [
  { key: 'L1', icon: '⚡', title: 'L1 快速', desc: '单 AI 快速处理\n适合简单问答/翻译', color: '#30a46c' },
  { key: 'L2', icon: '🧠', title: 'L2 标准', desc: '双 AI 并行+交叉验证\n适合文案/整理/报告', color: '#4f6ef7' },
  { key: 'L3', icon: '🚀', title: 'L3 深度', desc: '三 AI 并行+沙箱验证\n适合代码/建模/分析', color: '#7c5cfc' },
];

const loadingMsgs = [
  '正在解析任务意图…',
  '正在调用 AI 模型…',
  '正在生成执行方案…',
  '正在验证结果…',
  '正在整理输出…',
  '即将完成…',
];

export function SmartExecute({ taskId, taskTitle, onClose }: Props) {
  const { t } = useI18n();
  const api = useApi();

  const [phase, setPhase] = useState<'select' | 'connecting' | 'executing' | 'done'>('select');
  const [level, setLevel] = useState('L2');
  const [result, setResult] = useState<any>(null);
  const [statusMsg, setStatusMsg] = useState(0);
  const [error, setError] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const cancelled = useRef(false);

  useEffect(() => {
    return () => { cancelled.current = true; };
  }, []);

  const addLog = (msg: string) => {
    console.log('[SmartExecute]', msg);
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const pingPython = async (): Promise<string> => {
    // Direct IPC test
    if (!window.electronAPI) {
      return 'ERROR: window.electronAPI 不可用 — 你是在浏览器还是 Electron 里运行？';
    }
    try {
      const tasks = await window.electronAPI.getTasks();
      if (tasks && Array.isArray(tasks)) {
        return `OK: 已通过 IPC 获取到 ${tasks.length} 条任务`;
      }
      return 'OK: IPC 通道正常';
    } catch (e: any) {
      return `IPC 错误: ${e.message || String(e)}`;
    }
  };

  const startExecution = async () => {
    setPhase('connecting');
    setError('');
    setResult(null);
    setLog([]);

    // Step 1: test IPC connectivity
    addLog('检测 IPC 通道…');
    const ipcStatus = await pingPython();
    addLog(ipcStatus);

    if (ipcStatus.startsWith('ERROR') || ipcStatus.startsWith('IPC 错误')) {
      setError(`IPC 通道不通：${ipcStatus}`);
      setPhase('done');
      return;
    }

    // Step 2: start execution
    addLog(`开始执行 (级别=${level}, taskId=${taskId})`);
    setPhase('executing');

    const msgTimer = setInterval(() => {
      if (!cancelled.current) setStatusMsg(s => (s + 1) % loadingMsgs.length);
    }, 1500);

    const startTime = Date.now();
    try {
      addLog('发送 execute_task 到 Python…');
      const res = await api.executeTask(taskId, level);
      clearInterval(msgTimer);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (cancelled.current) return;
      addLog(`收到响应 (耗时 ${elapsed}s)`);
      if (res?.error) {
        setError(res.error);
        addLog(`执行错误: ${res.error}`);
      } else {
        setResult(res);
        addLog('执行完成 ✓');
      }
    } catch (e: any) {
      clearInterval(msgTimer);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (cancelled.current) return;
      const msg = e?.message || String(e);
      setError(msg);
      addLog(`异常 (耗时 ${elapsed}s): ${msg}`);
    } finally {
      if (!cancelled.current) setPhase('done');
    }
  };

  const hasFileOutput = result?.generated_files && result.generated_files.length > 0;

  const openOutputDir = () => {
    if (result?.output_dir) {
      window.open(`file://${result.output_dir}`, '_blank');
    }
  };

  const openFile = (path: string) => {
    window.open(`file://${path}`, '_blank');
  };

  return (
    <div className="se-container">
      <div className="se-card">
        <div className="se-header">
          <h2>{t.smartExecute.title}</h2>
          <button className="se-btn-back" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="se-task-info">
          <span className="se-task-label">{t.smartExecute.targetTask}</span>
          <span className="se-task-name">{taskTitle}</span>
        </div>

        {/* ── Phase: Level Selection ── */}
        {phase === 'select' && (
          <>
            <div className="se-level-grid">
              {levels.map(l => (
                <button
                  key={l.key}
                  className={`se-level-card ${level === l.key ? 'active' : ''}`}
                  style={{ '--card-color': l.color } as React.CSSProperties}
                  onClick={() => setLevel(l.key)}
                >
                  <span className="se-level-icon">{l.icon}</span>
                  <span className="se-level-title">{l.title}</span>
                  <span className="se-level-desc" style={{ whiteSpace: 'pre-line' }}>{l.desc}</span>
                  {level === l.key && <span className="se-level-check">✓</span>}
                </button>
              ))}
            </div>
            <button className="se-btn-launch" onClick={startExecution}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              开始执行
            </button>
          </>
        )}

        {/* ── Phase: Connecting ── */}
        {phase === 'connecting' && (
          <div className="se-loading-section">
            <div className="se-orbital">
              <div className="se-orbital-ring" />
              <div className="se-orbital-core">🔌</div>
            </div>
            <div className="se-progress-text">正在连接后端服务…</div>
            <div style={{ fontSize: 11, color: '#999', marginTop: -8, maxHeight: 120, overflowY: 'auto', textAlign: 'left', width: '100%' }}>
              {log.map((l, i) => <div key={i} style={{ padding: '2px 0' }}>{l}</div>)}
            </div>
          </div>
        )}

        {/* ── Phase: Executing ── */}
        {phase === 'executing' && (
          <div className="se-loading-section">
            <div className="se-orbital">
              <div className="se-orbital-ring" />
              <div className="se-orbital-core">✦</div>
            </div>
            <div className="se-progress-bar">
              <div className="se-progress-fill se-progress-indeterminate" />
            </div>
            <div className="se-progress-text">{loadingMsgs[statusMsg]}</div>
            <div style={{ fontSize: 11, color: '#999', marginTop: -8, maxHeight: 120, overflowY: 'auto', textAlign: 'left', width: '100%' }}>
              {log.map((l, i) => <div key={i} style={{ padding: '2px 0' }}>{l}</div>)}
            </div>
          </div>
        )}

        {/* ── Phase: Done with Result ── */}
        {phase === 'done' && result && !error && (
          <div className="se-result">
            <div className="se-result-header">
              <span className={`se-result-badge ${result.status === 'completed' ? 'completed' : 'failed'}`}>
                {result.status === 'completed' ? t.smartExecute.completed : t.smartExecute.failedBadge}
              </span>
              <span className="se-result-level">{result.level || level}</span>
              {result.duration_ms && <span className="se-result-time">{result.duration_ms}ms</span>}
              {result.reference_results != null && (
                <span className="se-result-refs">
                  {result.passed}/{result.reference_results} AI 通过
                </span>
              )}
            </div>

            {result.final_result ? (
              <div className="se-result-content">
                {result.final_result.split('\n').map((line: string, i: number) => {
                  if (line.startsWith('##')) return <h3 key={i}>{line.replace(/^##\s*/, '')}</h3>;
                  if (line.startsWith('#') || line.startsWith('结论') || line.startsWith('依据') || line.startsWith('注意')) return <h4 key={i}>{line}</h4>;
                  if (line.startsWith('-') || line.startsWith('*') || line.startsWith('·')) return <li key={i}>{line.replace(/^[-*·]\s*/, '')}</li>;
                  if (line.trim() === '') return <br key={i} />;
                  return <p key={i}>{line}</p>;
                })}
              </div>
            ) : (
              <pre className="se-result-raw">{JSON.stringify(result, null, 2)}</pre>
            )}

            {/* ── File output notification ── */}
            {hasFileOutput && (
              <div style={{ marginTop: 16, padding: '14px 18px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#166534', marginBottom: 8 }}>
                  文件已生成 ({result.generated_files.length} 个)
                </div>
                {result.generated_files.map((f: string, i: number) => (
                  <div key={i} style={{ fontSize: 12, color: '#15803d', marginBottom: 4, wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>📄 {f.split(/[/\\]/).pop()}</span>
                    <button
                      onClick={() => openFile(f)}
                      style={{ fontSize: 11, padding: '2px 10px', background: '#15803d', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >
                      打开
                    </button>
                  </div>
                ))}
                <button
                  onClick={openOutputDir}
                  style={{ marginTop: 8, fontSize: 11, padding: '4px 14px', background: '#166534', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  📂 打开输出文件夹
                </button>
              </div>
            )}

            {/* ── Code block notice (when text result contains code but no files generated) ── */}
            {!hasFileOutput && result?.final_result && (result.final_result.includes('```') || result.task_type === 'code') && (
              <div style={{ marginTop: 16, padding: '14px 18px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                  ⚠️ 代码已生成但未产出文件
                </div>
                <div style={{ fontSize: 12, color: '#a16207' }}>
                  AI 提供了代码但执行后未生成文件。请检查上方输出中的代码块，手动复制到本地运行。
                </div>
              </div>
            )}

            <div style={{ marginTop: 16, fontSize: 11, color: '#999', textAlign: 'left' }}>
              {log.map((l, i) => <div key={i} style={{ padding: '2px 0' }}>{l}</div>)}
            </div>

            <button className="se-btn-launch" style={{ marginTop: 20 }} onClick={() => setPhase('select')}>
              再执行一次
            </button>
          </div>
        )}

        {/* ── Phase: Done with Error ── */}
        {phase === 'done' && error && (
          <>
            <div className="se-error-section">
              <div className="se-error-icon">⚠️</div>
              <div className="se-error-text">执行失败</div>
              <div className="se-error-detail">{error}</div>
            </div>
            <div style={{ marginTop: 12, padding: '12px 16px', background: '#fafafa', borderRadius: 8, fontSize: 11, color: '#666', textAlign: 'left', maxHeight: 200, overflowY: 'auto' }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: '#333' }}>📋 执行日志</div>
              {log.map((l, i) => <div key={i} style={{ padding: '2px 0', fontFamily: 'monospace' }}>{l}</div>)}
            </div>
            <button className="se-btn-launch" style={{ marginTop: 20, width: 'auto', padding: '10px 28px' }} onClick={() => { setPhase('select'); setError(''); setLog([]); }}>
              重试
            </button>
          </>
        )}
      </div>
    </div>
  );
}
