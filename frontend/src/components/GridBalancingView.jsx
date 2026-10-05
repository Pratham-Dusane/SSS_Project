import React, { useState } from 'react';
import { 
  Sliders, 
  BatteryCharging, 
  Battery, 
  ShieldAlert, 
  CheckCircle, 
  Zap, 
  Gauge, 
  Flame,
  Power
} from 'lucide-react';

export default function GridBalancingView({ 
  generation = 9062, 
  demand, 
  setDemand, 
  batterySoc, 
  setBatterySoc 
}) {
  const [threshold, setThreshold] = useState(300);
  const [autoBalancing, setAutoBalancing] = useState(true);

  const netBalance = generation - demand;
  
  let decision = 'BALANCED';
  let badgeColor = 'var(--accent-green)';
  let bgBadge = 'rgba(16, 185, 129, 0.15)';
  let actionTitle = 'Grid Frequency Synchronized';
  let actionDesc = 'Renewable output matches grid demand within ±' + threshold + ' kW tolerance band.';

  if (netBalance > threshold) {
    decision = 'SURPLUS';
    badgeColor = 'var(--accent-cyan)';
    bgBadge = 'rgba(6, 182, 212, 0.15)';
    actionTitle = 'Surplus Curtailment & Storage Charging';
    actionDesc = `Excess green power of +${netBalance.toLocaleString()} kW available. Charging 10.5 MWh LiFePO4 battery array & exporting to regional interconnects.`;
  } else if (netBalance < -threshold) {
    decision = 'DEFICIT';
    badgeColor = 'var(--accent-rose)';
    bgBadge = 'rgba(244, 63, 94, 0.15)';
    actionTitle = 'Deficit Mitigation & Peaker Reserve Dispatch';
    actionDesc = `Supply shortfall of ${Math.abs(netBalance).toLocaleString()} kW. Discharging utility battery storage & signaling spinning reserve backup plants.`;
  }

  // Simulated Frequency Calculation (nominal 50.00 Hz)
  const frequency = (50.0 + (netBalance / 25000)).toFixed(2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Interactive Controls & Scenario Testing */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon" style={{ color: 'var(--accent-amber)' }}>
              <Sliders size={18} />
            </div>
            <div>
              <h2 className="card-title">Grid Balancing Simulation Sandbox (PRD Section 16)</h2>
              <p className="card-subtitle">Test surplus/deficit decision triggers under simulated electrical grid demands</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Auto Dispatch Mode:</span>
            <button
              id="btn-toggle-auto-balancing"
              onClick={() => setAutoBalancing(!autoBalancing)}
              style={{
                background: autoBalancing ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                color: autoBalancing ? 'var(--accent-green)' : 'var(--text-dim)',
                border: `1px solid ${autoBalancing ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-card)'}`,
                padding: '5px 12px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Power size={13} />
              {autoBalancing ? 'Active' : 'Manual'}
            </button>
          </div>
        </div>

        {/* Sliders Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '10px' }}>
          {/* Demand Slider */}
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Simulated Grid Demand</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', fontWeight: 700 }}>
                {demand.toLocaleString()} kW
              </span>
            </div>
            <input 
              id="slider-grid-demand"
              type="range" 
              min="3000" 
              max="14000" 
              step="100" 
              value={demand} 
              onChange={(e) => setDemand(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-amber)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              <span>Base Load (3,000 kW)</span>
              <span>Peak Load (14,000 kW)</span>
            </div>
          </div>

          {/* Threshold Slider */}
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Balancing Band Threshold (±)</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                ±{threshold} kW
              </span>
            </div>
            <input 
              id="slider-balance-threshold"
              type="range" 
              min="50" 
              max="1000" 
              step="50" 
              value={threshold} 
              onChange={(e) => setThreshold(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              <span>Tight (±50 kW)</span>
              <span>Wide (±1,000 kW)</span>
            </div>
          </div>

          {/* Battery State of Charge */}
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Battery Storage (BESS) SoC</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', fontWeight: 700 }}>
                {batterySoc}%
              </span>
            </div>
            <input 
              id="slider-battery-soc"
              type="range" 
              min="10" 
              max="100" 
              step="1" 
              value={batterySoc} 
              onChange={(e) => setBatterySoc(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-green)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              <span>Low Reserve (10%)</span>
              <span>Fully Charged (100%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Decision Engine Output */}
      <div className="charts-grid-2col">
        <div className="card" style={{ borderLeft: `5px solid ${badgeColor}` }}>
          <div className="card-header">
            <div>
              <span style={{ fontSize: '0.72rem', color: badgeColor, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                Active Evaluation Status
              </span>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                {decision} STATE
              </h3>
            </div>
            <div style={{ background: bgBadge, color: badgeColor, padding: '6px 14px', borderRadius: 'var(--radius-md)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {actionTitle}
            </div>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '18px' }}>
            {actionDesc}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Renewable Supply</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-green)', fontSize: '1.1rem' }}>
                {generation.toLocaleString()} kW
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Simulated Demand</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-amber)', fontSize: '1.1rem' }}>
                {demand.toLocaleString()} kW
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Grid Frequency</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: Math.abs(frequency - 50.0) < 0.1 ? 'var(--accent-green)' : 'var(--accent-rose)', fontSize: '1.1rem' }}>
                {frequency} Hz
              </div>
            </div>
          </div>
        </div>

        {/* Dispatch Equipment Status */}
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <div className="card-icon" style={{ color: 'var(--accent-cyan)' }}>
                <BatteryCharging size={18} />
              </div>
              <div>
                <h3 className="card-title">Dispatch Equipment State</h3>
                <p className="card-subtitle">Storage & Peaker readiness</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Battery size={18} color="var(--accent-green)" />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>BESS Inverter Rack #1-4</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>10.5 MWh LiFePO4 System</div>
                </div>
              </div>
              <span className="status-pill online">
                {netBalance > threshold ? 'Charging' : netBalance < -threshold ? 'Discharging' : 'Float Standby'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Flame size={18} color="var(--accent-rose)" />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Backup Gas Turbines</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Fast-start Peaker Capacity</div>
                </div>
              </div>
              <span className={`status-pill ${netBalance < -threshold ? 'streaming' : 'online'}`} style={{ color: netBalance < -threshold ? 'var(--accent-rose)' : 'var(--text-dim)' }}>
                {netBalance < -threshold ? 'Dispatched' : 'Warm Standby'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
