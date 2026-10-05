import React from 'react';
import { 
  Activity, 
  Cpu, 
  TrendingUp, 
  Sliders, 
  Database, 
  Zap, 
  Radio, 
  CheckCircle2, 
  Layers
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, isStreaming, liveRecordCount }) {
  const menuItems = [
    { id: 'overview', label: 'Grid Telemetry', icon: Activity, badge: 'Live' },
    { id: 'topology', label: 'Kafka Pipeline', icon: Layers, badge: '4.3.1' },
    { id: 'forecasting', label: 'AI Forecasting (t+1)', icon: TrendingUp, badge: 'ML' },
    { id: 'balancing', label: 'Grid Balancing', icon: Sliders, badge: 'Auto' },
    { id: 'database', label: 'PostgreSQL Store', icon: Database, badge: 'SQL' },
  ];

  return (
    <aside className="sidebar" aria-label="System Navigation">
      <div className="brand-section">
        <div className="brand-icon-wrapper">
          <Zap size={22} />
        </div>
        <div>
          <h1 className="brand-title">AetherGrid</h1>
          <p className="brand-subtitle">Energy Stream Engine</p>
        </div>
      </div>

      <nav className="nav-menu">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-btn-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} className="nav-icon" />
              <span>{item.label}</span>
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="pipeline-status-card">
          <div className="pipeline-status-row">
            <span style={{ color: 'var(--text-muted)' }}>Kafka Broker</span>
            <span className="status-pill online">
              <span className="dot pulse" /> localhost:9092
            </span>
          </div>
          <div className="pipeline-status-row">
            <span style={{ color: 'var(--text-muted)' }}>Stream State</span>
            <span className={`status-pill ${isStreaming ? 'streaming' : ''}`}>
              <Radio size={12} /> {isStreaming ? 'Ingesting' : 'Standby'}
            </span>
          </div>
          <div className="pipeline-status-row" style={{ marginBottom: 0 }}>
            <span style={{ color: 'var(--text-muted)' }}>Ingested Events</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-green)' }}>
              {liveRecordCount.toLocaleString()}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
          <CheckCircle2 size={13} color="var(--accent-green)" />
          <span>PostgreSQL & Kafka Sync Ready</span>
        </div>
      </div>
    </aside>
  );
}
