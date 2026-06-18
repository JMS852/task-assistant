import React, { useState, useEffect } from 'react';
import './Settings.css';

interface Props {
  onBack: () => void;
}

interface ProviderConfig {
  provider: string;
  displayName: string;
  icon: string;
  envVar: string;
  endpoint: string;
  enabled: boolean;
}

const defaultProviders: ProviderConfig[] = [
  { provider: 'deepseek', displayName: 'DeepSeek', icon: '🔮', envVar: 'DEEPSEEK_API_KEY', endpoint: 'https://api.deepseek.com/v1', enabled: true },
  { provider: 'qianwen', displayName: '通义千问', icon: '☁️', envVar: 'DASHSCOPE_API_KEY', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1', enabled: true },
  { provider: 'doubao', displayName: '豆包', icon: '🫘', envVar: 'DOUBAO_API_KEY', endpoint: 'https://ark.cn-beijing.volces.com/api/v3', enabled: false },
  { provider: 'hunyuan', displayName: '混元', icon: '🌐', envVar: 'HUNYUAN_SECRET_ID / HUNYUAN_SECRET_KEY', endpoint: 'https://hunyuan.tencentcloudapi.com', enabled: false },
];

export function Settings({ onBack }: Props) {
  const [providers, setProviders] = useState<ProviderConfig[]>(defaultProviders);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('ai_providers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProviders(parsed);
      } catch {}
    }
  }, []);

  const toggleProvider = (idx: number) => {
    const next = [...providers];
    next[idx] = { ...next[idx], enabled: !next[idx].enabled };
    setProviders(next);
  };

  const saveSettings = () => {
    localStorage.setItem('ai_providers', JSON.stringify(providers));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="s-container">
      <div className="s-sidebar">
        <button className="s-back-btn" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          返回
        </button>
        <nav className="s-nav">
          <div className="s-nav-item active">AI 服务</div>
          <div className="s-nav-item">关于</div>
        </nav>
      </div>

      <div className="s-content">
        <div className="s-page">
          <h2>AI 服务配置</h2>
          <p className="s-subtitle">配置 AI 服务商的 API Key，用于任务识别和智能执行。密钥通过环境变量设置，不存储在本地。</p>

          <div className="s-provider-list">
            {providers.map((p, idx) => (
              <div key={p.provider} className={`s-provider-card ${p.enabled ? 'enabled' : ''}`}>
                <div className="s-provider-main">
                  <div className="s-provider-icon">{p.icon}</div>
                  <div className="s-provider-info">
                    <div className="s-provider-name">{p.displayName}</div>
                    <div className="s-provider-endpoint">{p.endpoint}</div>
                  </div>
                  <button
                    className={`s-toggle ${p.enabled ? 'on' : ''}`}
                    onClick={() => toggleProvider(idx)}
                    role="switch"
                    aria-checked={p.enabled}
                  >
                    <span className="s-toggle-knob" />
                  </button>
                </div>
                {p.enabled && (
                  <div className="s-provider-env">
                    <span className="s-env-label">环境变量</span>
                    <code className="s-env-code">{p.envVar}</code>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button className="s-btn-save" onClick={saveSettings}>
            {saved ? '✓ 已保存' : '保存配置'}
          </button>

          <div className="s-note">
            <h4>📌 使用说明</h4>
            <ul>
              <li>在系统环境变量中设置对应的 API Key</li>
              <li>至少启用一个 AI 服务才能使用智能执行功能</li>
              <li>建议启用 DeepSeek 和通义千问作为基础配置</li>
              <li>API Key 存储在本地，不会上传到任何第三方</li>
            </ul>
          </div>
        </div>

        <div className="s-page-footer">
          <div className="s-about">
            <div className="s-about-logo">✦</div>
            <div>
              <strong>桌面待办助手</strong> v1.0.0
              <div className="s-about-path">数据存储: %APPDATA%\task-assistant\</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
