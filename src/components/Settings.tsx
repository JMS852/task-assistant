import React, { useState, useEffect } from 'react';
import { useI18n, format } from '../i18n';
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
  apiKey: string;
}

const defaultProviders: ProviderConfig[] = [
  { provider: 'deepseek', displayName: 'DeepSeek', icon: '🔮', envVar: 'DEEPSEEK_API_KEY', endpoint: 'https://api.deepseek.com/v1', enabled: true, apiKey: '' },
  { provider: 'qianwen', displayName: '通义千问', icon: '☁️', envVar: 'DASHSCOPE_API_KEY', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1', enabled: true, apiKey: '' },
  { provider: 'doubao', displayName: '豆包', icon: '🫘', envVar: 'DOUBAO_API_KEY', endpoint: 'https://ark.cn-beijing.volces.com/api/v3', enabled: false, apiKey: '' },
  { provider: 'hunyuan', displayName: '混元', icon: '🌐', envVar: 'HUNYUAN_SECRET_ID / HUNYUAN_SECRET_KEY', endpoint: 'https://hunyuan.tencentcloudapi.com', enabled: false, apiKey: '' },
];

declare global {
  interface Window {
    electronAPI?: {
      saveSettings: (settings: any[]) => Promise<any>;
    };
  }
}

export function Settings({ onBack }: Props) {
  const { t, lang, setLang } = useI18n();
  const [providers, setProviders] = useState<ProviderConfig[]>(defaultProviders);
  const [saved, setSaved] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = localStorage.getItem('ai_providers');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setProviders(defaultProviders.map(dp => {
          const existing = parsed.find((p: ProviderConfig) => p.provider === dp.provider);
          return existing ? { ...dp, ...existing, apiKey: existing.apiKey || '' } : dp;
        }));
      } catch {}
    }
  }, []);

  const toggleProvider = (idx: number) => {
    const next = [...providers];
    next[idx] = { ...next[idx], enabled: !next[idx].enabled };
    setProviders(next);
  };

  const setApiKey = (idx: number, key: string) => {
    const next = [...providers];
    next[idx] = { ...next[idx], apiKey: key };
    setProviders(next);
  };

  const toggleKeyVisible = (provider: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      next.has(provider) ? next.delete(provider) : next.add(provider);
      return next;
    });
  };

  const saveSettings = () => {
    localStorage.setItem('ai_providers', JSON.stringify(providers));
    if (window.electronAPI?.saveSettings) {
      window.electronAPI.saveSettings(providers.map(p => ({
        id: p.provider,
        provider: p.provider,
        api_key_encrypted: p.apiKey,
        endpoint: p.endpoint,
        enabled: p.enabled,
      })));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="s-container">
      <div className="s-sidebar">
        <button className="s-back-btn" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          {t.settings.back}
        </button>
        <nav className="s-nav">
          <div className="s-nav-item active">{t.settings.navAI}</div>
          <div className="s-nav-item">{t.settings.navAbout}</div>
        </nav>

        <div className="s-lang-section">
          <div className="s-lang-label">{t.settings.language}</div>
          <div className="s-lang-btns">
            <button
              className={`s-lang-btn ${lang === 'zh' ? 'active' : ''}`}
              onClick={() => setLang('zh')}
            >{t.settings.langZh}</button>
            <button
              className={`s-lang-btn ${lang === 'en' ? 'active' : ''}`}
              onClick={() => setLang('en')}
            >{t.settings.langEn}</button>
          </div>
        </div>
      </div>

      <div className="s-content">
        <div className="s-page">
          <h2>{t.settings.heading}</h2>
          <p className="s-subtitle">{t.settings.subtitle}</p>

          <div className="s-provider-list">
            {providers.map((p, idx) => (
              <div key={p.provider} className={`s-provider-card ${p.enabled ? 'enabled' : ''}`}>
                <div className="s-provider-main">
                  <div className="s-provider-icon">{p.icon}</div>
                  <div className="s-provider-info">
                    <div className="s-provider-name">{t.providers[p.provider as keyof typeof t.providers] || p.displayName}</div>
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
                  <div className="s-key-row">
                    <input
                      className="s-key-input"
                      type={visibleKeys.has(p.provider) ? 'text' : 'password'}
                      value={p.apiKey}
                      onChange={(e) => setApiKey(idx, e.target.value)}
                      placeholder={p.provider === 'hunyuan' ? t.settings.keyPlaceholderHunyuan : format(t.settings.keyPlaceholder, { name: t.providers[p.provider as keyof typeof t.providers] || p.displayName })}
                      spellCheck={false}
                      autoComplete="off"
                    />
                    <button
                      className="s-key-eye"
                      onClick={() => toggleKeyVisible(p.provider)}
                      title={visibleKeys.has(p.provider) ? t.settings.hideKey : t.settings.showKey}
                    >
                      {visibleKeys.has(p.provider) ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button className="s-btn-save" onClick={saveSettings}>
            {saved ? t.settings.saveDone : t.settings.saveBtn}
          </button>

          <div className="s-note">
            <h4>{t.settings.usageTitle}</h4>
            <ul>
              <li>{t.settings.usage1}</li>
              <li>{t.settings.usage2}</li>
              <li>{t.settings.usage3}</li>
              <li>{t.settings.usage4}</li>
              <li>{t.settings.usage5}</li>
            </ul>
          </div>
        </div>

        <div className="s-page-footer">
          <div className="s-about">
            <div className="s-about-logo">✦</div>
            <div>
              <strong>{t.settings.aboutName}</strong> {t.settings.aboutVersion}
              <div className="s-about-path">{t.settings.aboutPath}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
