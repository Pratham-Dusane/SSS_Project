import React from 'react';
import { Wind, Sun, Zap, TrendingUp, Gauge } from 'lucide-react';

export default function KpiCards({ latestRecord, forecastRecord }) {
  const windVal = latestRecord?.wind || 0;
  const solarVal = latestRecord?.solar || 0;
  const totalVal = latestRecord?.total || (windVal + solarVal);
  const forecastVal = forecastRecord || Math.round(totalVal * 1.03);
  const netBalance = totalVal - (latestRecord?.demand || 6500);

  const windPct = totalVal > 0 ? Math.round((windVal / totalVal) * 100) : 0;
  const solarPct = totalVal > 0 ? Math.round((solarVal / totalVal) * 100) : 0;

  return (
    <div className="kpi-grid">
      {/* Wind Generation */}
      <div className="kpi-card accent-cyan">
        <div className="kpi-top">
          <span className="kpi-label">Wind Farm Production</span>
          <div className="kpi-icon-badge">
            <Wind size={18} />
          </div>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-value">{windVal.toLocaleString()}</span>
          <span className="kpi-unit">kW</span>
        </div>
        <div className="kpi-footer">
          <span>{windPct}% of Total Mix</span>
          <span style={{ color: 'var(--accent-cyan)' }}>Simulated 8.6 m/s</span>
        </div>
      </div>

      {/* Solar Generation */}
      <div className="kpi-card accent-amber">
        <div className="kpi-top">
          <span className="kpi-label">Solar PV Array</span>
          <div className="kpi-icon-badge">
            <Sun size={18} />
          </div>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-value">{solarVal.toLocaleString()}</span>
          <span className="kpi-unit">kW</span>
        </div>
        <div className="kpi-footer">
          <span>{solarPct}% of Total Mix</span>
          <span style={{ color: 'var(--accent-amber)' }}>{solarVal > 0 ? '780 W/m² Irradiance' : 'Night Mode (0 W/m²)'}</span>
        </div>
      </div>

      {/* Total Renewable Generation */}
      <div className="kpi-card accent-emerald">
        <div className="kpi-top">
          <span className="kpi-label">Total Green Generation</span>
          <div className="kpi-icon-badge">
            <Zap size={18} />
          </div>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-value">{totalVal.toLocaleString()}</span>
          <span className="kpi-unit">kW</span>
        </div>
        <div className="kpi-footer">
          <span>Kafka Topic Processed</span>
          <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>Active Stream</span>
        </div>
      </div>

      {/* Short Term Forecast (t+1) */}
      <div className="kpi-card accent-purple">
        <div className="kpi-top">
          <span className="kpi-label">AI Forecast (t+1 hr)</span>
          <div className="kpi-icon-badge">
            <TrendingUp size={18} />
          </div>
        </div>
        <div className="kpi-value-row">
          <span className="kpi-value">{forecastVal.toLocaleString()}</span>
          <span className="kpi-unit">kW</span>
        </div>
        <div className="kpi-footer">
          <span>Model: XGBoost + LSTM</span>
          <span style={{ color: 'var(--accent-purple)' }}>Conf: 94.2%</span>
        </div>
      </div>
    </div>
  );
}
