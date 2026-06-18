import React, { useState, useEffect } from 'react';
import './Settings.css';

interface Props {
  onBack: () => void;
}

export function Settings({ onBack }: Props) {
  const [configs, setConfigs] = useState<Array<{
    provider: string;
    apiKey: string;
    endpoint: string;
    enabled: boolean;
  }>>([
    { provider: 'deepseek', apiKey: '', endpoint: 'https://api.deepseek.com/v1', enabled: true },
    { provider: 'qianwen', apiKey: '', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1', enabled: true },
    { provider: 'doubao', apiKey: '', endpoint: 'https://ark.cn-beijing.volces.com/api/v3', enabled: false },
    { provider: 'hunyuan', apiKey: '', endpoint: 'https://hunyuan.tencentcloudapi.com', enabled: false },
  ]);

  const updateConfig = (idx: number, field: string, value: any) => {
    const newConfigs = [...configs];
    (newConfigs[idx] as any)[field] = value;
    setConfigs(newConfigs);
  };

  const saveSettings = () => {
    localStorage.setItem('ai_configs', JSON.stringify(configs));
    alert('设置已保存');
  };

  useEffect(() => {
    const saved = localStorage.getItem('ai_configs');
    if (saved) {
      try { setConfigs(JSON.parse(saved)); } catch {}
    }
  }, []);

  return (
    <div className="settings">
      <div className="settings-header">
        <button onClick={onBack}>← 返回</button>
        <h2>设置</h2>
      </div>

      <section className="settings-section">
        <h3>AI 服务配置</h3>
        <p className="settings-hint">API Key 通过环境变量设置：DEEPSEEK_API_KEY, DASHSCOPE_API_KEY, DOUBAO_API_KEY, HUNYUAN_SECRET_ID / HUNYUAN_SECRET_KEY</p>
        {configs.map((cfg, idx) => (
          <div key={cfg.provider} className="config-item">
            <label>
              <input
                type="checkbox"
                checked={cfg.enabled}
                onChange={e => updateConfig(idx, 'enabled', e.target.checked)}
              />
              {cfg.provider}
            </label>
            {cfg.enabled && (
              <input
                type="text"
                placeholder={`${cfg.provider} Endpoint`}
                value={cfg.endpoint}
                onChange={e => updateConfig(idx, 'endpoint', e.target.value)}
                readOnly
                className="endpoint-readonly"
              />
            )}
          </div>
        ))}
        <button onClick={saveSettings}>保存设置</button>
      </section>

      <section className="settings-section">
        <h3>关于</h3>
        <p>桌面待办助手 v1.0.0</p>
        <p>数据存储位置: %APPDATA%/task-assistant/</p>
      </section>
    </div>
  );
}
