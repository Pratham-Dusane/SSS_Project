import React, { useState } from 'react';
import { TrendingUp, PieChart, Activity, Info, BarChart2 } from 'lucide-react';

export default function LiveCharts({ records = [] }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // If records is empty, fallback to safe defaults
  const displayRecords = records.length > 0 ? records.slice(-12) : [];
  
  const width = 760;
  const height = 240;
  const padding = { top: 20, right: 30, bottom: 35, left: 45 };

  // Calculate scales
  const maxVal = Math.max(
    ...displayRecords.map(r => Math.max(r.total || 0, r.forecast || 0, r.demand || 0)),
    14000
  );

  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const getX = (idx) => {
    if (displayRecords.length <= 1) return padding.left;
    return padding.left + (idx / (displayRecords.length - 1)) * innerWidth;
  };

  const getY = (val) => {
    const clamped = Math.max(0, val || 0);
    return padding.top + innerHeight - (clamped / maxVal) * innerHeight;
  };

  // Generate SVG path strings
  const createPath = (key) => {
    if (displayRecords.length === 0) return '';
    return displayRecords.reduce((acc, curr, idx) => {
      const x = getX(idx);
      const y = getY(curr[key]);
      return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  };

  const createAreaPath = (key) => {
    if (displayRecords.length === 0) return '';
    const line = createPath(key);
    const lastX = getX(displayRecords.length - 1);
    const firstX = getX(0);
    const bottomY = padding.top + innerHeight;
    return `${line} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  const windPath = createPath('wind');
  const solarPath = createPath('solar');
  const totalPath = createPath('total');
  const forecastPath = createPath('forecast');
  const totalArea = createAreaPath('total');

  const latest = displayRecords[displayRecords.length - 1] || {};
  const totalWind = latest.wind || 0;
  const totalSolar = latest.solar || 0;
  const sumTotal = latest.total || (totalWind + totalSolar) || 1;
  const windShare = Math.round((totalWind / sumTotal) * 100);
  const solarShare = Math.round((totalSolar / sumTotal) * 100);

  return (
    <div className="charts-grid-2col">
      {/* Time-Series Chart */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon" style={{ color: 'var(--accent-green)' }}>
              <Activity size={18} />
            </div>
            <div>
              <h2 className="card-title">Real-Time Renewable Stream & AI Forecast</h2>
              <p className="card-subtitle">Kafka streaming telemetry vs t+1 predictive curve</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '3px', background: 'var(--accent-cyan)', borderRadius: '2px' }} />
              <span style={{ color: 'var(--text-muted)' }}>Wind</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '3px', background: 'var(--accent-amber)', borderRadius: '2px' }} />
              <span style={{ color: 'var(--text-muted)' }}>Solar</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '3px', background: 'var(--accent-green)', borderRadius: '2px' }} />
              <span style={{ color: 'var(--text-muted)' }}>Total Green</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '3px', borderTop: '2px dashed var(--accent-purple)' }} />
              <span style={{ color: 'var(--text-muted)' }}>AI Forecast (t+1)</span>
            </div>
          </div>
        </div>

        <div className="chart-container">
          <svg 
            viewBox={`0 0 ${width} ${height}`} 
            className="chart-svg"
            onMouseLeave={() => setHoveredPoint(null)}
          >
            <defs>
              <linearGradient id="totalGreenGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const y = padding.top + innerHeight * (1 - pct);
              const val = Math.round(maxVal * pct);
              return (
                <g key={i}>
                  <line 
                    x1={padding.left} 
                    y1={y} 
                    x2={width - padding.right} 
                    y2={y} 
                    stroke="rgba(255, 255, 255, 0.06)" 
                    strokeDasharray="3 3"
                  />
                  <text 
                    x={padding.left - 8} 
                    y={y + 4} 
                    fill="var(--text-dim)" 
                    fontSize="10" 
                    textAnchor="end"
                    fontFamily="var(--font-mono)"
                  >
                    {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                  </text>
                </g>
              );
            })}

            {/* Fill Area for Total Green */}
            <path d={totalArea} fill="url(#totalGreenGlow)" />

            {/* Wind Line */}
            <path 
              d={windPath} 
              fill="none" 
              stroke="var(--accent-cyan)" 
              strokeWidth="2.2" 
              strokeLinecap="round" 
            />

            {/* Solar Line */}
            <path 
              d={solarPath} 
              fill="none" 
              stroke="var(--accent-amber)" 
              strokeWidth="2.2" 
              strokeLinecap="round" 
            />

            {/* Total Green Line */}
            <path 
              d={totalPath} 
              fill="none" 
              stroke="var(--accent-green)" 
              strokeWidth="2.8" 
              strokeLinecap="round" 
            />

            {/* AI Forecast (Dashed) */}
            <path 
              d={forecastPath} 
              fill="none" 
              stroke="var(--accent-purple)" 
              strokeWidth="2.2" 
              strokeDasharray="5 4" 
              strokeLinecap="round" 
            />

            {/* Data Points */}
            {displayRecords.map((r, idx) => {
              const cx = getX(idx);
              const cy = getY(r.total);
              const isHovered = hoveredPoint?.idx === idx;
              return (
                <g key={r.id || idx}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 6 : 4}
                    fill="#10b981"
                    stroke="#0b0f17"
                    strokeWidth="2"
                    style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                    onMouseEnter={() => setHoveredPoint({ ...r, idx, cx, cy })}
                  />
                  {/* X-axis time label */}
                  <text
                    x={cx}
                    y={height - 10}
                    fill="var(--text-dim)"
                    fontSize="10"
                    textAnchor="middle"
                    fontFamily="var(--font-mono)"
                  >
                    {r.hour !== undefined ? `${r.hour}:00` : idx}
                  </text>
                </g>
              );
            })}

            {/* Hover Tooltip in SVG */}
            {hoveredPoint && (
              <g transform={`translate(${Math.min(hoveredPoint.cx - 60, width - 150)}, ${Math.max(hoveredPoint.cy - 70, 10)})`}>
                <rect
                  width="130"
                  height="60"
                  rx="6"
                  fill="rgba(15, 23, 42, 0.95)"
                  stroke="rgba(255, 255, 255, 0.15)"
                />
                <text x="10" y="18" fill="var(--text-main)" fontSize="10" fontWeight="bold">
                  {hoveredPoint.timestamp || `Hour ${hoveredPoint.hour}:00`}
                </text>
                <text x="10" y="34" fill="var(--accent-green)" fontSize="10" fontFamily="var(--font-mono)">
                  Total: {hoveredPoint.total?.toLocaleString()} kW
                </text>
                <text x="10" y="48" fill="var(--accent-purple)" fontSize="10" fontFamily="var(--font-mono)">
                  Forecast: {hoveredPoint.forecast?.toLocaleString()} kW
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Generation Mix & Stream Health Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div className="card-header">
            <div className="card-title-group">
              <div className="card-icon" style={{ color: 'var(--accent-cyan)' }}>
                <PieChart size={18} />
              </div>
              <div>
                <h2 className="card-title">Generation Mix</h2>
                <p className="card-subtitle">Real-time resource breakdown</p>
              </div>
            </div>
          </div>

          {/* Progress Bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>Wind Energy</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{windShare}% ({totalWind.toLocaleString()} kW)</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${windShare}%`, height: '100%', background: 'var(--accent-cyan)', borderRadius: '4px' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
                <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>Solar PV Array</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{solarShare}% ({totalSolar.toLocaleString()} kW)</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${solarShare}%`, height: '100%', background: 'var(--accent-amber)', borderRadius: '4px' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Live Topic Metrics */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginTop: '20px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
            Kafka Ingestion Telemetry
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem' }}>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>Topic Lag:</span>{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>0 ms (Real-time)</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>Throughput:</span>{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>1.0 rec/sec</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>Partition:</span>{' '}
              <span style={{ fontFamily: 'var(--font-mono)' }}>P-0 / P-1</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-dim)' }}>Encoding:</span>{' '}
              <span style={{ fontFamily: 'var(--font-mono)' }}>UTF-8 JSON</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
