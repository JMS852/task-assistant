import React, { useState, useRef, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import './ChatPanel.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  taskIds?: string[];
}

interface Props {
  visible: boolean;
  onToggle: () => void;
  onSelectTask: (id: string) => void;
}

export function ChatPanel({ visible, onToggle, onSelectTask }: Props) {
  const api = useApi();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '你好！我是任务助手，你可以问我任何关于待办事项的问题。\n\n例如："有哪些高优先级的任务"、"张经理派的活"、"今天到期的"、"SSL证书的截止时间是什么"',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setLoading(true);

    try {
      const res = await api.askQuery(q);
      const answer = res?.answer || res?.error || '抱歉，查询失败。';
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: answer + (res?.suggestion ? '\n\n💡 ' + res.suggestion : ''),
        taskIds: res?.relevant_task_ids || [],
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `查询失败: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  if (!visible) {
    return (
      <button className="cp-toggle-btn" onClick={onToggle} title="AI 助手">💬</button>
    );
  }

  return (
    <div className="cp-panel">
      <div className="cp-header">
        <h3>🤖 AI 助手</h3>
        <button className="cp-close" onClick={onToggle}>✕</button>
      </div>
      <div className="cp-messages">
        {messages.map((m, i) => (
          <div key={i} className={`cp-msg cp-msg-${m.role}`}>
            <div className="cp-msg-content">{m.content}</div>
            {m.taskIds && m.taskIds.length > 0 && (
              <div className="cp-msg-tasks">
                {m.taskIds.map(id => (
                  <button key={id} className="cp-task-link" onClick={() => onSelectTask(id)}>
                    查看任务 →
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="cp-msg cp-msg-assistant"><div className="cp-typing">思考中...</div></div>}
        <div ref={endRef} />
      </div>
      <div className="cp-input-area">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="问点什么... (Enter 发送)"
          rows={2}
          disabled={loading}
        />
      </div>
    </div>
  );
}
