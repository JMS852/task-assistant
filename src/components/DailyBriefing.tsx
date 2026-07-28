import React from 'react';
import './DailyBriefing.css';

interface BriefingData {
  date?: string;
  top_priorities?: Array<{ title: string; priority: string; deadline: string }>;
  recently_completed?: Array<{ title: string; completed_at: string }>;
  expiring_soon?: Array<{ title: string; deadline: string; days_left: number }>;
  stats?: { pending: number; high: number; due_today: number; completed_recently: number };
  ai_advice?: string;
  error?: string;
}

interface Props {
  data: BriefingData | null;
  loading: boolean;
  onRefresh: () => void;
}

export function DailyBriefing({ data, loading, onRefresh }: Props) {
  if (!data && !loading) return null;

  return (
    <div className="db-card">
      <div className="db-header">
        <h3>📊 今日简报</h3>
        <div className="db-header-right">
          <span className="db-date">{data?.date || ''}</span>
          <button className="db-refresh" onClick={onRefresh} disabled={loading}>
            {loading ? '⏳' : '🔄'}
          </button>
        </div>
      </div>

      {loading && !data && <div className="db-loading">正在生成简报...</div>}

      {data && (
        <>
          {data.top_priorities && data.top_priorities.length > 0 && (
            <div className="db-section">
              <h4>📌 优先处理</h4>
              {data.top_priorities.map((t, i) => (
                <div key={i} className="db-item">
                  <span className={`db-prio-dot ${t.priority}`} />
                  <span>{t.title}</span>
                  {t.deadline && <span className="db-deadline">截止 {t.deadline}</span>}
                </div>
              ))}
            </div>
          )}

          {data.expiring_soon && data.expiring_soon.length > 0 && (
            <div className="db-section">
              <h4>⚠️ 即将过期</h4>
              {data.expiring_soon.map((t, i) => (
                <div key={i} className="db-item db-item-warn">
                  <span>{t.title}</span>
                  <span className="db-days-left">剩 {t.days_left} 天</span>
                </div>
              ))}
            </div>
          )}

          {data.recently_completed && data.recently_completed.length > 0 && (
            <div className="db-section">
              <h4>✅ 最近完成</h4>
              {data.recently_completed.map((t, i) => (
                <div key={i} className="db-item db-item-done">
                  <span>{t.title}</span>
                </div>
              ))}
            </div>
          )}

          {data.ai_advice && (
            <div className="db-advice">
              <h4>💡 AI 建议</h4>
              <p>{data.ai_advice}</p>
            </div>
          )}

          <div className="db-stats">
            <div className="db-stat"><strong>{data.stats?.pending || 0}</strong> 待办</div>
            <div className="db-stat high"><strong>{data.stats?.high || 0}</strong> 紧急</div>
            <div className="db-stat today"><strong>{data.stats?.due_today || 0}</strong> 今日到期</div>
          </div>
        </>
      )}
    </div>
  );
}
