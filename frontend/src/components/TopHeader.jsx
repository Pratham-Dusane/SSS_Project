import React, { useState, useEffect } from 'react';
import { Play, Pause, FastForward, PlusCircle, RefreshCw, Clock } from 'lucide-react';

export default function TopHeader({ 
  activeTab, 
  isStreaming, 
  setIsStreaming, 
  speed, 
  setSpeed, 
  onSimulateTick 
}) {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-US', { hour12: false }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const titles = {
    overview: { title: 'Live Grid Telemetry & Ingestion', desc: 'Real-time sensor stream from simulated Wokwi Arduino to Kafka' },
    topology: { title: 'Kafka 4.3.1 Pipeline Topology', desc: 'End-to-end event-driven architecture view & topic partitions' },
    forecasting: { title: 'AI Short-Term Forecast (t+1)', desc: 'Predicting renewable energy output using lag features & ML regressors' },
    balancing: { title: 'Intelligent Grid Balancing Engine', desc: 'Real-time surplus absorption, BESS battery dispatch & deficit mitigation' },
    database: { title: 'PostgreSQL Historical Store', desc: 'Real-time SQL persistence into renewable_energy database' }
  };

  const current = titles[activeTab] || titles.overview;

  return (
    <header className="top-header">
      <div className="header-left">
        <div className="header-title">
          {current.title}
        </div>
        <div className="header-desc">{current.desc}</div>
      </div>

      <div className="header-controls">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <Clock size={14} color="var(--accent-cyan)" />
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>{timeStr}</span>
        </div>

        {/* Speed Selector */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', padding: '2px', border: '1px solid var(--border-subtle)' }}>
          {[1, 2, 5].map((s) => (
            <button
              key={s}
              id={`speed-btn-${s}x`}
              onClick={() => setSpeed(s)}
              style={{
                background: speed === s ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                color: speed === s ? 'var(--accent-green)' : 'var(--text-dim)',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)'
              }}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Manual Tick Generator */}
        <button
          id="btn-simulate-tick"
          onClick={onSimulateTick}
          className="control-btn"
          title="Simulate 1 incoming sensor event over Kafka"
        >
          <PlusCircle size={15} color="var(--accent-cyan)" />
          <span>Stream Event</span>
        </button>

        {/* Stream Toggle */}
        <button
          id="btn-toggle-stream"
          onClick={() => setIsStreaming(!isStreaming)}
          className={`control-btn ${isStreaming ? 'danger' : 'primary'}`}
        >
          {isStreaming ? (
            <>
              <Pause size={15} />
              <span>Pause Stream</span>
            </>
          ) : (
            <>
              <Play size={15} />
              <span>Start Stream</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
