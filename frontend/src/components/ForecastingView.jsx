import React from 'react';
import { 
  TrendingUp, 
  Cpu, 
  Layers, 
  Target, 
  CheckCircle2, 
  Sliders, 
  Sparkles,
  BarChart3
} from 'lucide-react';
import { mlModelMeta } from '../data/mockData';

export default function ForecastingView({ latestRecord }) {
  const currentTotal = latestRecord?.total || 7500;
  
  // Simulated next 6 hours forecast horizon
  const forecastHorizon = [
    { hourOffset: '+1 hr (Target t+1)', predicted: Math.round(currentTotal * 1.04), conf: '96.2%', trend: 'Rising' },
    { hourOffset: '+2 hr', predicted: Math.round(currentTotal * 1.08), conf: '94.8%', trend: 'Peak' },
    { hourOffset: '+3 hr', predicted: Math.round(currentTotal * 0.95), conf: '92.1%', trend: 'Declining' },
    { hourOffset: '+4 hr', predicted: Math.round(currentTotal * 0.82), conf: '89.4%', trend: 'Declining' },
    { hourOffset: '+5 hr', predicted: Math.round(currentTotal * 0.70), conf: '86.7%', trend: 'Low Solar' },
    { hourOffset: '+6 hr', predicted: Math.round(currentTotal * 0.65), conf: '84.0%', trend: 'Wind Dominant' },
  ];

  const featureWeights = [
    { name: 'wind_t-1 (1h lag)', weight: 32 },
    { name: 'solar_t-1 (1h lag)', weight: 26 },
    { name: 'rolling_solar_3h', weight: 14 },
    { name: 'rolling_wind_3h', weight: 12 },
    { name: 'start_hour (sin/cos)', weight: 9 },
    { name: 'day_of_year / season', weight: 7 }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ML Architecture Header Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon" style={{ color: 'var(--accent-purple)' }}>
              <TrendingUp size={18} />
            </div>
            <div>
              <h2 className="card-title">Short-Term AI Forecasting Engine (PRD Section 14-15)</h2>
              <p className="card-subtitle">Next-hour renewable power prediction model trained on Kaggle GPU</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="status-pill streaming">
              <Sparkles size={12} /> Model Active (t+1)
            </span>
            <span className="status-pill online">
              Kaggle GPU Trained
            </span>
          </div>
        </div>

        {/* Model Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '10px' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Target Objective</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-purple)', marginTop: '4px' }}>Generation at t + 1</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '2px' }}>Next-hour total green kW</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>R² Coefficient</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', marginTop: '4px' }}>
              {mlModelMeta.r2Score}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '2px' }}>High predictive variance</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mean Absolute Error</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', marginTop: '4px' }}>
              {mlModelMeta.mae}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '2px' }}>~1.8% average error</div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Training Dataset</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-main)', marginTop: '4px' }}>
              {mlModelMeta.trainingDatasetRows.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '2px' }}>Hourly historical records (2020-2025)</div>
          </div>
        </div>
      </div>

      <div className="charts-grid-2col">
        {/* Next 6-Hour Forecast Horizon Table */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <div className="card-icon" style={{ color: 'var(--accent-green)' }}>
                <Target size={18} />
              </div>
              <div>
                <h3 className="card-title">Forecast Horizon (t+1 through t+6)</h3>
                <p className="card-subtitle">Real-time inference pipeline output</p>
              </div>
            </div>
          </div>

          <div className="data-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Horizon Window</th>
                  <th>Predicted Generation</th>
                  <th>Confidence</th>
                  <th>Trend Profile</th>
                </tr>
              </thead>
              <tbody>
                {forecastHorizon.map((f, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: i === 0 ? 700 : 500, color: i === 0 ? 'var(--accent-purple)' : 'var(--text-main)' }}>
                      {f.hourOffset}
                    </td>
                    <td style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                      {f.predicted.toLocaleString()} kW
                    </td>
                    <td>
                      <span className="status-pill online" style={{ fontSize: '0.7rem' }}>
                        {f.conf}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: f.trend.includes('Rising') || f.trend.includes('Peak') ? 'var(--accent-cyan)' : 'var(--accent-amber)' }}>
                        {f.trend}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Feature Importance Card */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <div className="card-icon" style={{ color: 'var(--accent-cyan)' }}>
                <BarChart3 size={18} />
              </div>
              <div>
                <h3 className="card-title">Lag Feature Importance</h3>
                <p className="card-subtitle">SHAP / Feature weights</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
            {featureWeights.map((feat, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{feat.name}</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent-purple)' }}>{feat.weight}%</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${feat.weight * 2.5}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent-purple), var(--accent-cyan))', borderRadius: '3px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
