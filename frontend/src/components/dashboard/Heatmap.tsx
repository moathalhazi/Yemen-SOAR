'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { dashboardApi } from '@/lib/api';
import { useTheme } from 'next-themes';
import { useTranslationStore } from '@/stores/i18nStore';

// ========================================
// Types
// ========================================

interface TimeHeatmapData {
  period_days: number;
  days: string[];
  hours: number[];
  alerts: {
    matrix: number[][];
    max_value: number;
    total: number;
  };
  incidents: {
    matrix: number[][];
    max_value: number;
    total: number;
  };
  severity_breakdown: Record<string, {
    matrix: number[][];
    max_value: number;
  }>;
}

interface DailyHeatmapData {
  period_days: number;
  alerts: Record<string, { total: number; by_severity: Record<string, number> }>;
  incidents: Record<string, { total: number; by_status: Record<string, number> }>;
  summary: {
    total_alerts: number;
    total_incidents: number;
    peak_alerts_date: string | null;
    peak_incidents_date: string | null;
  };
}

interface SourceHeatmapData {
  period_days: number;
  sources: string[];
  severities: string[];
  matrix: Array<{
    source: string;
    values: number[];
    total: number;
  }>;
}

interface ClassificationHeatmapData {
  period_days: number;
  classifications: Record<string, {
    total: number;
    by_severity: Record<string, number>;
    avg_confidence: number;
    avg_priority: number;
  }>;
  top_threats: Array<{
    name: string;
    total: number;
    by_severity: Record<string, number>;
    avg_confidence: number;
  }>;
}

type HeatmapType = 'time' | 'daily' | 'source' | 'classification';

// ========================================
// Color Utilities
// ========================================

const getHeatColor = (value: number, maxValue: number, type: 'default' | 'severity' = 'default', isLight: boolean = false): string => {
  if (maxValue === 0 || value === 0) return isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';

  const intensity = Math.min(value / maxValue, 1);

  if (type === 'severity') {
    return isLight ? `rgba(220, 38, 38, ${0.3 + intensity * 0.7})` : `rgba(239, 68, 68, ${0.2 + intensity * 0.8})`;
  }

  if (isLight) {
    return `rgba(0, 0, 0, ${0.4 + intensity * 0.6})`;
  }

  // Blue-purple gradient for default
  const r = Math.round(59 + intensity * 180);
  const g = Math.round(130 - intensity * 80);
  const b = Math.round(246 - intensity * 50);
  return `rgba(${r}, ${g}, ${b}, ${0.3 + intensity * 0.7})`;
};

const severityColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  info: '#3b82f6',
};

// ========================================
// Time Heatmap Component (24h x 7 days)
// ========================================

interface TimeHeatmapProps {
  data: TimeHeatmapData | null;
  loading?: boolean;
}

const TimeHeatmap: React.FC<TimeHeatmapProps> = ({ data, loading }) => {
  const { resolvedTheme } = useTheme();
  const { t } = useTranslationStore();
  const isLight = resolvedTheme === 'light';

  if (loading) {
    return (
      <div className="heatmap-loading text-slate-500 dark:text-slate-400">
        <div className="loading-spinner"></div>
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (!data) {
    return <div className="heatmap-empty text-slate-500 dark:text-slate-400">{t('dashboard.noData')}</div>;
  }

  const maxValue = data.alerts.max_value || 1;
  const twelveHours = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

  return (
    <div className="time-heatmap bg-white border-slate-200 dark:bg-[#1e1e2e] dark:border-[#2d2d3d]">
      <div className="heatmap-header">
        <h3 className="text-slate-900 dark:text-white">{t('dashboard.activityByDayHour')}</h3>
        <span className="period-badge">{data.period_days} {t('dashboard.days')}</span>
      </div>

      <div className="heatmap-grid" style={{ overflowX: 'auto', paddingBottom: '8px' }}>
        {/* Day labels (X-axis) */}
        <div className="day-labels">
          <div className="label-spacer"></div>
          {data.days.map(day => (
            <div key={day} className="day-label-top text-slate-500 dark:text-slate-400" title={day}>
              {data.period_days <= 7 ? day.slice(0, 3) : day.split('-').pop()}
            </div>
          ))}
        </div>

        {/* Grid rows (Y-axis: Hours) */}
        {twelveHours.map((hour) => (
          <div key={hour} className="heatmap-row">
            <div className="hour-label-side text-slate-500 dark:text-slate-400" title={`${hour}:00 - ${hour + 1}:59`}>
              {hour.toString().padStart(2, '0')}:00
            </div>
            {data.days.map((day, dayIndex) => {
              const val1 = data.alerts.matrix[dayIndex]?.[hour] || 0;
              const val2 = data.alerts.matrix[dayIndex]?.[hour + 1] || 0;
              const value = val1 + val2;

              return (
                <div
                  key={`${day}-${hour}`}
                  className="heatmap-cell"
                  style={{ backgroundColor: getHeatColor(value, maxValue * 2, 'default', isLight) }}
                  title={`${day} ${hour}:00-${hour + 1}:59 - ${value} ${t('dashboard.alerts')}`}
                >
                  {value > 0 && value >= (maxValue * 2) * 0.5 && (
                    <span className="cell-value">{value}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="heatmap-legend text-slate-500 dark:text-slate-400">
        <span>{t('dashboard.less')}</span>
        <div className={`legend-gradient ${isLight ? 'bg-gradient-to-r from-[rgba(0,0,0,0.1)] to-[rgba(0,0,0,0.9)]' : ''}`}></div>
        <span>{t('dashboard.more')}</span>
        <span className="legend-total text-slate-900 dark:text-white">{t('dashboard.total')}: {data.alerts.total}</span>
      </div>

      <style jsx>{`
        .time-heatmap {
          border-radius: 12px;
          padding: 20px;
          border-width: 1px;
          border-style: solid;
        }
        
        .heatmap-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .heatmap-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }
        
        .period-badge {
          background: var(--primary, #3b82f6);
          color: white;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
        }
        
        .heatmap-grid {
          display: flex;
          flex-direction: column;
          gap: 3px;
          overflow-x: auto;
          scrollbar-width: thin;
          padding-bottom: 8px;
        }
        
        .heatmap-grid::-webkit-scrollbar {
          height: 6px;
        }
        
        .heatmap-grid::-webkit-scrollbar-track {
          background: var(--bg-primary, #0f172a);
          border-radius: 4px;
        }
        
        .heatmap-grid::-webkit-scrollbar-thumb {
          background: var(--border-color, #334155);
          border-radius: 4px;
        }
        
        .day-labels {
          display: flex;
          gap: 3px;
          margin-bottom: 3px;
        }
        
        .label-spacer {
          width: 32px;
          flex-shrink: 0;
        }
        
        .day-label-top {
          width: 22px;
          font-size: 9px;
          color: var(--text-secondary, #888);
          text-align: center;
          flex-shrink: 0;
        }
        
        .heatmap-row {
          display: flex;
          gap: 3px;
          align-items: center;
        }
        
        .hour-label-side {
          width: 32px;
          font-size: 9px;
          color: var(--text-secondary, #888);
          text-align: right;
          padding-right: 6px;
          flex-shrink: 0;
        }
        
        .heatmap-cell {
          width: 22px;
          height: 22px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
          flex-shrink: 0;
        }
        
        .cell-value {
          font-size: 8px;
          color: rgba(255, 255, 255, 0.9);
          font-weight: 600;
        }
        
        .heatmap-cell:hover {
          transform: scale(1.2);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          z-index: 10;
        }
        
        .cell-value {
          font-size: 9px;
          color: white;
          font-weight: 600;
        }
        
        .heatmap-legend {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 16px;
          font-size: 12px;
          color: var(--text-secondary, #888);
        }
        
        .legend-gradient {
          width: 100px;
          height: 10px;
          border-radius: 5px;
          background: linear-gradient(to right, rgba(59, 130, 246, 0.3), rgba(147, 51, 234, 1));
        }
        
        .legend-total {
          margin-left: auto;
          font-weight: 500;
        }
        
        .heatmap-loading, .heatmap-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 200px;
        }
        
        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--border-color, #2d2d3d);
          border-top-color: var(--primary, #3b82f6);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// ========================================
// Classification Heatmap Component
// ========================================

interface ClassificationHeatmapProps {
  data: ClassificationHeatmapData | null;
  loading?: boolean;
}

const ClassificationHeatmap: React.FC<ClassificationHeatmapProps> = ({ data, loading }) => {
  const { t } = useTranslationStore();

  if (loading) {
    return (
      <div className="classification-heatmap loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!data || data.top_threats.length === 0) {
    return (
      <div className="classification-heatmap empty text-slate-500 dark:text-slate-400">
        <p>{t('dashboard.noClassificationData')}</p>
      </div>
    );
  }

  const maxTotal = Math.max(...data.top_threats.map(t => t.total));

  return (
    <div className="classification-heatmap bg-white border-slate-200 dark:bg-[#1e1e2e] dark:border-[#2d2d3d]">
      <div className="heatmap-header">
        <h3 className="text-slate-900 dark:text-white">{t('dashboard.threatClassification')}</h3>
        <span className="period-badge">{data.period_days} {t('dashboard.days')}</span>
      </div>

      <div className="threat-list">
        {data.top_threats.slice(0, 8).map((threat, index) => (
          <div key={threat.name} className="threat-row">
            <div className="threat-rank">#{index + 1}</div>
            <div className="threat-info">
              <div className="threat-name">{threat.name}</div>
              <div className="threat-bar-container">
                <div
                  className="threat-bar"
                  style={{
                    width: `${(threat.total / maxTotal) * 100}%`,
                    background: `linear-gradient(90deg, ${severityColors.high}, ${severityColors.critical})`
                  }}
                />
              </div>
            </div>
            <div className="threat-stats">
              <span className="threat-count">{threat.total}</span>
              {threat.avg_confidence > 0 && (
                <span className="threat-confidence">{Math.round(threat.avg_confidence * 100)}%</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .classification-heatmap {
          border-radius: 12px;
          padding: 20px;
          border-width: 1px;
          border-style: solid;
        }
        
        .heatmap-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        
        .heatmap-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }
        
        .period-badge {
          background: var(--primary, #3b82f6);
          color: white;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
        }
        
        .threat-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .threat-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .threat-rank {
          width: 30px;
          color: var(--text-secondary, #888);
          font-size: 12px;
        }
        
        .threat-info {
          flex: 1;
        }
        
        .threat-name {
          font-size: 13px;
          color: inherit;
          margin-bottom: 4px;
          text-transform: capitalize;
        }
        
        .threat-bar-container {
          height: 6px;
          background: var(--border-color, #2d2d3d);
          border-radius: 3px;
          overflow: hidden;
        }
        
        .threat-bar {
          height: 100%;
          border-radius: 3px;
          transition: width 0.3s ease;
        }
        
        .threat-stats {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          min-width: 60px;
        }
        
        .threat-count {
          font-size: 14px;
          font-weight: 600;
          color: inherit;
        }
        
        .threat-confidence {
          font-size: 11px;
          color: var(--success, #22c55e);
        }
        
        .loading, .empty {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 200px;
        }
        
        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--border-color, #2d2d3d);
          border-top-color: var(--primary, #3b82f6);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// ========================================
// Source Heatmap Component
// ========================================

interface SourceHeatmapProps {
  data: SourceHeatmapData | null;
  loading?: boolean;
}

const SourceHeatmap: React.FC<SourceHeatmapProps> = ({ data, loading }) => {
  if (loading || !data) {
    return (
      <div className="source-heatmap loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="source-heatmap">
      <div className="heatmap-header">
        <h3>Alerts by Source</h3>
      </div>

      <div className="source-grid">
        {/* Severity headers */}
        <div className="grid-header">
          <div className="source-label-header">Source</div>
          {data.severities.map(sev => (
            <div
              key={sev}
              className="severity-header"
              style={{ color: severityColors[sev] }}
            >
              {sev.charAt(0).toUpperCase()}
            </div>
          ))}
          <div className="total-header">Total</div>
        </div>

        {/* Source rows */}
        {data.matrix.slice(0, 8).map(row => (
          <div key={row.source} className="source-row">
            <div className="source-label" title={row.source}>
              {row.source.length > 15 ? row.source.slice(0, 15) + '...' : row.source}
            </div>
            {row.values.map((value, i) => (
              <div
                key={i}
                className="source-cell"
                style={{
                  backgroundColor: value > 0 ? severityColors[data.severities[i]] : 'transparent',
                  opacity: value > 0 ? 0.3 + (value / Math.max(...row.values)) * 0.7 : 0.1
                }}
              >
                {value > 0 && value}
              </div>
            ))}
            <div className="source-total">{row.total}</div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .source-heatmap {
          background: var(--card-bg, #1e1e2e);
          border-radius: 12px;
          padding: 20px;
          border: 1px solid var(--border-color, #2d2d3d);
        }
        
        .heatmap-header h3 {
          margin: 0 0 16px 0;
          color: var(--text-primary, #fff);
          font-size: 16px;
          font-weight: 600;
        }
        
        .source-grid {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .grid-header, .source-row {
          display: grid;
          grid-template-columns: 1fr repeat(5, 40px) 60px;
          gap: 4px;
          align-items: center;
        }
        
        .source-label-header, .source-label {
          font-size: 12px;
          color: var(--text-secondary, #888);
        }
        
        .source-label {
          color: var(--text-primary, #fff);
        }
        
        .severity-header {
          text-align: center;
          font-size: 11px;
          font-weight: 600;
        }
        
        .total-header {
          text-align: center;
          font-size: 11px;
          color: var(--text-secondary, #888);
        }
        
        .source-cell {
          height: 28px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          color: white;
          font-weight: 500;
        }
        
        .source-total {
          text-align: center;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary, #fff);
        }
        
        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 200px;
        }
        
        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--border-color, #2d2d3d);
          border-top-color: var(--primary, #3b82f6);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// ========================================
// Main Heatmap Dashboard Component
// ========================================

interface HeatmapDashboardProps {
  className?: string;
}

const HeatmapDashboard: React.FC<HeatmapDashboardProps> = ({ className }) => {
  const [timeData, setTimeData] = useState<TimeHeatmapData | null>(null);
  const [classificationData, setClassificationData] = useState<ClassificationHeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const { t } = useTranslationStore();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [timeRes, classRes] = await Promise.allSettled([
          dashboardApi.getHeatmapTime(days),
          dashboardApi.getHeatmapClassification(days)
        ]);

        if (timeRes.status === 'fulfilled') setTimeData(timeRes.value);
        if (classRes.status === 'fulfilled') setClassificationData(classRes.value);
      } catch (error) {
        console.error('Failed to fetch heatmap data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [days]);

  return (
    <div className={`heatmap-dashboard ${className || ''}`}>
      <div className="dashboard-header">
        <h2 className="text-slate-900 dark:text-white">{t('dashboard.incidentHeatmaps')}</h2>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="bg-white dark:bg-[#1e1e2e] text-slate-900 dark:text-white border-slate-200 dark:border-[#2d2d3d] focus:ring-soar-accent">
          <option value={7}>{t('dashboard.last7Days')}</option>
          <option value={14}>{t('dashboard.last14Days')}</option>
          <option value={30}>{t('dashboard.last30Days')}</option>
        </select>
      </div>

      <div className="heatmap-grid">
        <div className="heatmap-item large">
          <TimeHeatmap data={timeData} loading={loading} />
        </div>
        <div className="heatmap-item large">
          <ClassificationHeatmap data={classificationData} loading={loading} />
        </div>
      </div>

      <style jsx>{`
        .heatmap-dashboard {
          padding: 20px;
        }
        
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        
        .dashboard-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
        }
        
        .dashboard-header select {
          border-width: 1px;
          border-style: solid;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 14px;
          cursor: pointer;
        }
        
        .heatmap-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }
        
        .heatmap-item.large {
          grid-column: span 2;
        }
        
        @media (max-width: 1024px) {
          .heatmap-grid {
            grid-template-columns: 1fr;
          }
          
          .heatmap-item.large {
            grid-column: span 1;
          }
        }
      `}</style>
    </div>
  );
};

export { TimeHeatmap, ClassificationHeatmap, HeatmapDashboard };
export default HeatmapDashboard;
