import React, { useState } from 'react';
import { Database, Search, Filter, Code, Terminal, CheckCircle } from 'lucide-react';

export default function PostgresTableView({ records = [] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const filtered = records.filter(r => {
    const matchesSearch = (r.timestamp || '').includes(searchTerm) || String(r.id).includes(searchTerm);
    const matchesStatus = filterStatus === 'ALL' || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Table Metadata Header */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon" style={{ color: 'var(--accent-blue)' }}>
              <Database size={18} />
            </div>
            <div>
              <h2 className="card-title">PostgreSQL Historical Vault (PRD Section 11 & 12)</h2>
              <p className="card-subtitle">
                Schema: <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>renewable_energy.public.energy_readings</code>
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="status-pill online">
              <CheckCircle size={12} /> Sync Active
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Total Rows: {records.length}
            </span>
          </div>
        </div>

        {/* Filter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', marginTop: '10px' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              id="input-search-records"
              type="text"
              placeholder="Search by timestamp or reading ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-card)',
                borderRadius: 'var(--radius-md)',
                padding: '9px 12px 9px 36px',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                outline: 'none',
                fontFamily: 'var(--font-sans)'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {['ALL', 'SURPLUS', 'BALANCED', 'DEFICIT'].map((st) => (
              <button
                key={st}
                id={`filter-btn-${st}`}
                onClick={() => setFilterStatus(st)}
                style={{
                  background: filterStatus === st ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.03)',
                  color: filterStatus === st ? 'var(--accent-blue)' : 'var(--text-dim)',
                  border: `1px solid ${filterStatus === st ? 'rgba(59, 130, 246, 0.4)' : 'var(--border-subtle)'}`,
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        <div className="data-table-container" style={{ marginTop: '16px' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Source Timestamp</th>
                <th>Wind (kW)</th>
                <th>Solar (kW)</th>
                <th>Total Green (kW)</th>
                <th>Partition : Offset</th>
                <th>Balancing Decision</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 20).map((r) => (
                <tr key={r.id}>
                  <td style={{ color: 'var(--text-dim)' }}>#{r.id}</td>
                  <td style={{ fontWeight: 600 }}>{r.timestamp}</td>
                  <td style={{ color: 'var(--accent-cyan)' }}>{(r.wind || 0).toLocaleString()}</td>
                  <td style={{ color: 'var(--accent-amber)' }}>{(r.solar || 0).toLocaleString()}</td>
                  <td style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{(r.total || 0).toLocaleString()}</td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    P-{r.partition ?? 0} : <span style={{ color: 'var(--accent-purple)' }}>{r.offset ?? 14200}</span>
                  </td>
                  <td>
                    <span 
                      className={`status-pill ${
                        r.status === 'SURPLUS' ? 'streaming' : r.status === 'DEFICIT' ? 'deficit' : 'online'
                      }`}
                      style={{ fontSize: '0.7rem' }}
                    >
                      {r.status || 'BALANCED'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SQL Parameterized Query Guardrail Card (PRD Section 18) */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon" style={{ color: 'var(--accent-green)' }}>
              <Terminal size={18} />
            </div>
            <div>
              <h3 className="card-title">SQL Guardrails & Persistence Query (PRD Section 18)</h3>
              <p className="card-subtitle">Parameterized INSERT statements preventing SQL injection</p>
            </div>
          </div>
        </div>

        <pre style={{ 
          background: 'rgba(0, 0, 0, 0.4)', 
          padding: '16px', 
          borderRadius: 'var(--radius-md)', 
          border: '1px solid var(--border-subtle)', 
          fontFamily: 'var(--font-mono)', 
          fontSize: '0.8rem', 
          color: '#a7f3d0', 
          overflowX: 'auto' 
        }}>
{`-- Verified Python Subscriber Parameterized Persistence Query
INSERT INTO energy_readings (
    timestamp,
    wind_production,
    solar_production,
    total_renewable
) VALUES (%s, %s, %s, %s);`}
        </pre>
      </div>
    </div>
  );
}
