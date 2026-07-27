import React, { useState, useEffect, useRef, useCallback } from 'react';
import './HistoryScan.css';

interface Props {
  onClose: () => void;
}

interface LogEntry {
  time: string;
  text: string;
  type: 'info' | 'success' | 'error' | 'task';
}

export function HistoryScan({ onClose }: Props) {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'done'>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<{ messages: number; tasks: number; windows: number } | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    return () => { cancelled.current = true; };
  }, []);

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { time, text, type }]);
  }, []);

  // Listen for history scan events from Python
  useEffect(() => {
    if (!window.electronAPI?.onHistoryScanEvent) return;

    const unsub = window.electronAPI.onHistoryScanEvent((event: string, data: any) => {
      console.log('[HistoryScan] event:', event, data);
      if (cancelled.current) return;

      if (event === 'history_scan_started') {
        setPhase('scanning');
        addLog(`开始扫描，回溯 ${data.max_days} 天`, 'info');
      } else if (event === 'history_scan_progress') {
        // Show ALL phases so user sees what's happening
        if (data.stage === 'scanning') {
          if (data.phase === 'locating') {
            if (data.windows_found > 0) {
              addLog(`正在查找聊天窗口… 找到 ${data.windows_found} 个`, 'info');
              if (data.windows_detail) {
                data.windows_detail.forEach((w: string) => addLog(`  📌 ${w}`, 'info'));
              }
            } else {
              addLog(`正在查找聊天窗口… 找到 0 个 (请确认微信/QQ 窗口已打开并可见)`, 'error');
            }
          } else if (data.phase === 'locating_error') {
            addLog(`查找窗口失败: ${data.error}`, 'error');
          } else if (data.phase === 'reading') {
            addLog(`[${data.current}/${data.total}] ${data.title || data.source} — 读取中…`, 'info');
          } else if (data.phase === 'method_try') {
            addLog(`  尝试方法: ${data.method === 'clipboard' ? '剪贴板' : data.method === 'ocr' ? 'OCR截图' : data.method}`, 'info');
          } else if (data.phase === 'method_ok') {
            addLog(`  成功 (${data.method}): ${data.count} 条消息`, 'success');
          } else if (data.phase === 'method_fail') {
            addLog(`  所有方法均无法读取此窗口`, 'error');
          } else if (data.phase === 'clipboard_focus') {
            addLog(`  激活窗口…`, 'info');
          } else if (data.phase === 'clipboard_focused') {
            addLog(`  窗口已激活 (focus=${data.fg_ok})`, data.fg_ok ? 'success' : 'error');
          } else if (data.phase === 'clipboard_copied') {
            addLog(`  已发送 Ctrl+A, Ctrl+C`, 'info');
          } else if (data.phase === 'clipboard_pasted') {
            addLog(`  剪贴板内容: ${data.length} 字符`, data.length > 0 ? 'success' : 'error');
          } else if (data.phase === 'clipboard_error') {
            addLog(`  剪贴板错误: ${data.error}`, 'error');
          } else if (data.phase === 'reading_start') {
            addLog(`开始读取: ${data.source}`, 'info');
          } else if (data.phase === 'reading_result') {
            addLog(`  读取结果: 方法=${data.method}, 消息数=${data.count}`, data.count > 0 ? 'success' : 'error');
            if (data.sample) {
              data.sample.forEach((s: any) => addLog(`    样例: ${s[0]} | ${s[1]}`, 'info'));
            }
          } else if (data.phase === 'reading_after_dedup') {
            addLog(`  去重后: ${data.count} 条`, 'info');
          } else if (data.phase === 'reading_empty') {
            addLog(`  未能读取任何消息 — ${data.hint}`, 'error');
          } else if (data.phase === 'ocr_empty') {
            addLog(`  OCR 返回空文本`, 'error');
          } else if (data.phase === 'ocr_raw') {
            addLog(`  OCR 原始输出 (${data.length} 字符): ${data.preview}`, 'info');
          } else if (data.phase === 'ocr_parsed') {
            addLog(`  OCR 解析: 专用=${data.ocr_count}, 通用=${data.clip_count}, 采用=${data.chosen}`, 'info');
          } else if (data.phase === 'starting') {
            addLog('扫描器已启动…', 'info');
          } else {
            addLog(`扫描中: ${data.phase || data.stage}`, 'info');
          }
        } else if (data.stage === 'processing') {
          addLog(`识别消息: ${data.processed}/${data.total}, 已找到 ${data.tasks_found} 个任务`, 'task');
        } else if (data.stage === 'scanned_window') {
          addLog(`${data.source || data.title}: ${data.messages_found} 条消息`, 'success');
        } else {
          addLog(`进度: ${data.stage || '...'}`, 'info');
        }
      } else if (event === 'history_scan_log') {
        const msg = typeof data === 'string' ? data : (data.message || JSON.stringify(data));
        const isError = msg.startsWith('ERROR');
        addLog(msg, isError ? 'error' : 'info');
      } else if (event === 'history_scan_collected') {
        addLog(`收集完成: ${data.total_messages} 条消息，来自 ${data.windows_scanned} 个窗口`, 'success');
      } else if (event === 'history_scan_complete') {
        setPhase('done');
        setStats({
          messages: data.total_messages,
          tasks: data.tasks_found,
          windows: data.windows_scanned,
        });
        addLog(`扫描完成! ${data.total_messages} 条消息, ${data.tasks_found} 个任务`, 'success');
        if (data.errors && data.errors.length > 0) {
          data.errors.forEach((e: string) => addLog(`错误: ${e}`, 'error'));
        }
      }
    });

    return () => { if (unsub) unsub(); };
  }, [addLog]);

  const startScan = useCallback(async () => {
    setPhase('scanning');
    setLogs([]);
    setStats(null);
    addLog('正在连接后端服务…', 'info');

    console.log('[HistoryScan] startScan called, electronAPI:', !!window.electronAPI);
    console.log('[HistoryScan] scanHistory fn:', typeof window.electronAPI?.scanHistory);

    if (!window.electronAPI) {
      addLog('错误: electronAPI 不可用，请确认在 Electron 中运行', 'error');
      setPhase('done');
      return;
    }
    if (typeof window.electronAPI?.scanHistory !== 'function') {
      addLog('错误: scanHistory 方法未在 preload 中暴露', 'error');
      setPhase('done');
      return;
    }

    try {
      const result = await window.electronAPI.scanHistory(7);
      console.log('[HistoryScan] result:', result);
      if (!result?.success) {
        addLog(`启动失败: ${result?.error || '未知错误'}`, 'error');
        setPhase('done');
      }
    } catch (e: any) {
      console.error('[HistoryScan] exception:', e);
      addLog(`异常: ${e.message || String(e)}`, 'error');
      setPhase('done');
    }
  }, [addLog]);

  const logContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="hs-panel">
      <div className="hs-header">
        <h2 className="hs-title">📥 聊天记录扫描</h2>
        <button className="hs-btn-close" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div className="hs-body">
        {/* ── Idle: Big start button ── */}
        {phase === 'idle' && (
          <div className="hs-idle">
            <div className="hs-idle-icon">🔍</div>
            <h3>从聊天记录中智能扫描任务</h3>
            <p className="hs-idle-desc">
              自动读取微信/QQ 最近 <strong>7 天</strong>的聊天记录，<br/>
              识别其中的任务和待办事项，并自动添加到任务列表。
            </p>
            <div className="hs-idle-info">
              <div className="hs-info-row">
                <span>📋</span> 支持微信和 QQ 聊天窗口
              </div>
              <div className="hs-info-row">
                <span>⏱️</span> 扫描需要 10-30 秒（取决于消息量）
              </div>
              <div className="hs-info-row">
                <span>🔒</span> 仅读取可见消息，不上传聊天数据
              </div>
            </div>
            <button className="hs-btn-start" onClick={startScan}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16"/></svg>
              开始扫描
            </button>
          </div>
        )}

        {/* ── Scanning: Progress ── */}
        {phase === 'scanning' && (
          <div className="hs-scanning">
            <div className="hs-orbital">
              <div className="hs-ring" />
              <div className="hs-ring hs-ring-2" />
              <div className="hs-core">🔍</div>
            </div>
            <div className="hs-scanning-text">正在扫描聊天记录…</div>
            <div className="hs-progress-bar">
              <div className="hs-progress-fill" />
            </div>

            <div className="hs-log-container" ref={logContainerRef}>
              {logs.map((entry, i) => (
                <div key={i} className={`hs-log-entry hs-log-${entry.type}`}>
                  <span className="hs-log-time">{entry.time}</span>
                  <span className="hs-log-text">{entry.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Done: Results ── */}
        {phase === 'done' && (
          <div className="hs-done">
            {stats ? (
              <>
                <div className="hs-done-icon">✅</div>
                <h3>扫描完成</h3>
                <div className="hs-stats">
                  <div className="hs-stat">
                    <span className="hs-stat-value">{stats.messages}</span>
                    <span className="hs-stat-label">条消息</span>
                  </div>
                  <div className="hs-stat hs-stat-highlight">
                    <span className="hs-stat-value">{stats.tasks}</span>
                    <span className="hs-stat-label">个任务</span>
                  </div>
                  <div className="hs-stat">
                    <span className="hs-stat-value">{stats.windows}</span>
                    <span className="hs-stat-label">个窗口</span>
                  </div>
                </div>
                {stats.tasks > 0 && (
                  <div className="hs-done-hint">
                    找到的任务已自动添加到左侧任务列表中
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="hs-done-icon">⚠️</div>
                <h3>扫描未完成</h3>
              </>
            )}

            <div className="hs-log-container" ref={logContainerRef}>
              {logs.map((entry, i) => (
                <div key={i} className={`hs-log-entry hs-log-${entry.type}`}>
                  <span className="hs-log-time">{entry.time}</span>
                  <span className="hs-log-text">{entry.text}</span>
                </div>
              ))}
            </div>

            <div className="hs-done-actions">
              <button className="hs-btn-start hs-btn-retry" onClick={startScan}>
                重新扫描
              </button>
              <button className="hs-btn-back" onClick={onClose}>
                返回
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
