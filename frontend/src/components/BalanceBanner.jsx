import React from 'react';
import { ShieldCheck, BatteryCharging, AlertTriangle, ArrowRight, Zap, RefreshCw } from 'lucide-react';

export default function BalanceBanner({ 
  generation = 9062, 
  demand = 7500, 
  batterySoc = 78,
  threshold = 300 
}) {
  const netBalance = generation - demand;
  
  let decision = 'BALANCED';
  let actionText = 'Nominal equilibrium. Maintaining frequency synchronization at 50.00 Hz.';
  let badgeClass = 'balanced';
  let icon = <ShieldCheck size={20} />;

  if (netBalance > threshold) {
    decision = 'SURPLUS';
    badgeClass = 'surplus';
    actionText = `Surplus of +${netBalance.toLocaleString()} kW detected. Channeling excess energy to Battery Storage (BESS) & green hydrogen electrolyzers.`;
    icon = <BatteryCharging size={20} />;
  } else if (netBalance < -threshold) {
    decision = 'DEFICIT';
    badgeClass = 'deficit';
    actionText = `Deficit of ${Math.abs(netBalance).toLocaleString()} kW detected. Dispatching stored BESS capacity & spinning reserves to safeguard grid frequency.`;
    icon = <AlertTriangle size={20} />;
  }

  const supplyCoveragePct = demand > 0 ? Math.min(150, Math.round((generation / demand) * 100)) : 100;

  return (
    <div className="balance-banner">
      {/* Decision Status */}
      <div className="balance-state-box">
        <div className={`balance-status-badge ${badgeClass}`}>
          {icon}
          <span>{decision}</span>
        </div>
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
            Grid Balancing Engine
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            PRD Section 16 Decision Rule
          </div>
        </div>
      </div>

      {/* Generation vs Demand */}
      <div className="metric-column">
        <span className="metric-column-label">Supply vs Demand</span>
        <div className="metric-column-val" style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span>{generation.toLocaleString()}</span>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)', fontWeight: 400 }}>/ {demand.toLocaleString()} kW</span>
        </div>
        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden', marginTop: '4px' }}>
          <div 
            style={{ 
              width: `${Math.min(100, supplyCoveragePct)}%`, 
              height: '100%', 
              background: decision === 'SURPLUS' ? 'var(--accent-cyan)' : decision === 'DEFICIT' ? 'var(--accent-rose)' : 'var(--accent-green)',
              borderRadius: '4px',
              transition: 'width 0.4s ease'
            }} 
          />
        </div>
      </div>

      {/* Net Balance */}
      <div className="metric-column">
        <span className="metric-column-label">Net Power Differential</span>
        <div 
          className="metric-column-val" 
          style={{ 
            color: netBalance > 0 ? 'var(--accent-cyan)' : netBalance < 0 ? 'var(--accent-rose)' : 'var(--accent-green)' 
          }}
        >
          {netBalance > 0 ? `+${netBalance.toLocaleString()}` : netBalance.toLocaleString()} kW
        </div>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
          Threshold: ±{threshold} kW
        </span>
      </div>

      {/* BESS Battery Storage */}
      <div className="metric-column">
        <span className="metric-column-label">BESS Storage State</span>
        <div className="metric-column-val" style={{ color: 'var(--accent-green)' }}>
          {batterySoc}% SoC
        </div>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
          10.5 MWh LiFePO4 Reserve
        </span>
      </div>

      {/* Sub-bar describing exact grid action */}
      <div style={{ gridColumn: '1 / -1', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <Zap size={14} color="var(--accent-amber)" />
        <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>Automated Protocol:</span>
        <span>{actionText}</span>
      </div>
    </div>
  );
}
