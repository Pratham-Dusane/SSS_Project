import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import KpiCards from './components/KpiCards';
import BalanceBanner from './components/BalanceBanner';
import LiveCharts from './components/LiveCharts';
import PipelineTopologyView from './components/PipelineTopologyView';
import ForecastingView from './components/ForecastingView';
import GridBalancingView from './components/GridBalancingView';
import PostgresTableView from './components/PostgresTableView';
import { initialEnergyRecords } from './data/mockData';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isStreaming, setIsStreaming] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [records, setRecords] = useState(initialEnergyRecords);
  const [demand, setDemand] = useState(7500);
  const [batterySoc, setBatterySoc] = useState(78);
  const [nextOffset, setNextOffset] = useState(14216);
  const hourCounter = useRef(23);

  // Generate a realistic consecutive record
  const generateNewRecord = () => {
    const currentHour = hourCounter.current % 24;
    hourCounter.current += 1;

    // Diurnal solar curve: solar peaks around midday (11 - 15) and is 0 during night
    let solarGen = 0;
    if (currentHour >= 6 && currentHour <= 18) {
      const solarPeak = 4600;
      const angle = ((currentHour - 6) / 12) * Math.PI;
      solarGen = Math.round(Math.sin(angle) * solarPeak + (Math.random() * 200 - 100));
      solarGen = Math.max(0, solarGen);
    }

    // Wind generation with natural stochastic variation
    const baseWind = 4800;
    const windVariation = Math.sin(currentHour / 3) * 1500 + (Math.random() * 600 - 300);
    const windGen = Math.max(1200, Math.round(baseWind + windVariation));

    const totalGreen = windGen + solarGen;
    const forecastVal = Math.round(totalGreen * (0.97 + Math.random() * 0.06));
    const partition = Math.random() > 0.5 ? 1 : 0;
    const offset = nextOffset;
    setNextOffset(prev => prev + 1);

    const net = totalGreen - demand;
    let status = 'BALANCED';
    if (net > 300) status = 'SURPLUS';
    else if (net < -300) status = 'DEFICIT';

    // Battery SoC adjustments based on surplus/deficit
    if (status === 'SURPLUS') {
      setBatterySoc(prev => Math.min(100, prev + 1));
    } else if (status === 'DEFICIT') {
      setBatterySoc(prev => Math.max(10, prev - 1));
    }

    const padHour = String(currentHour).padStart(2, '0');
    const newRecord = {
      id: Date.now() % 100000,
      timestamp: `2025-12-01 ${padHour}:00`,
      hour: currentHour,
      wind: windGen,
      solar: solarGen,
      total: totalGreen,
      forecast: forecastVal,
      demand: demand,
      offset: offset,
      partition: partition,
      status: status
    };

    setRecords(prev => [...prev.slice(-30), newRecord]);
  };

  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Connect to live FastAPI & Kafka Backend via WebSocket
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;

    const connectWebSocket = () => {
      try {
        ws = new WebSocket('ws://localhost:8000/ws/telemetry');

        ws.onopen = () => {
          console.log('[WebSocket] Connected to live backend at ws://localhost:8000/ws/telemetry');
          setIsLiveConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'INIT_HISTORY' && Array.isArray(data.records)) {
              if (data.records.length > 0) setRecords(data.records);
              if (data.grid_state?.demand) setDemand(data.grid_state.demand);
              if (data.grid_state?.battery_soc) setBatterySoc(data.grid_state.battery_soc);
            } else if (data.timestamp && data.total !== undefined) {
              setRecords(prev => [...prev.slice(-30), data]);
              if (data.status === 'SURPLUS') {
                setBatterySoc(prev => Math.min(100, Math.round((prev + 0.3) * 10) / 10));
              } else if (data.status === 'DEFICIT') {
                setBatterySoc(prev => Math.max(10, Math.round((prev - 0.3) * 10) / 10));
              }
            }
          } catch (err) {
            console.error('[WebSocket] Error parsing telemetry payload:', err);
          }
        };

        ws.onerror = () => {
          setIsLiveConnected(false);
        };

        ws.onclose = () => {
          setIsLiveConnected(false);
          reconnectTimeout = setTimeout(connectWebSocket, 4000);
        };
      } catch (err) {
        setIsLiveConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Streaming ticker (active as fallback simulator when live backend WebSocket is not connected)
  useEffect(() => {
    if (!isStreaming || isLiveConnected) return;
    const intervalTime = Math.max(600, Math.round(2500 / speed));
    const timer = setInterval(() => {
      generateNewRecord();
    }, intervalTime);
    return () => clearInterval(timer);
  }, [isStreaming, speed, demand, nextOffset, isLiveConnected]);

  const latestRecord = records[records.length - 1] || initialEnergyRecords[0];

  return (
    <div className="app-container">
      {/* Fixed Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isStreaming={isStreaming}
        liveRecordCount={records.length + 51865}
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        <TopHeader 
          activeTab={activeTab}
          isStreaming={isStreaming}
          setIsStreaming={setIsStreaming}
          speed={speed}
          setSpeed={setSpeed}
          onSimulateTick={generateNewRecord}
          isLiveConnected={isLiveConnected}
        />

        <main className="content-body">
          {/* Always Visible High-Level Summary for Operations & Telemetry */}
          {activeTab === 'overview' && (
            <>
              <KpiCards 
                latestRecord={latestRecord} 
                forecastRecord={latestRecord.forecast} 
              />

              <BalanceBanner 
                generation={latestRecord.total}
                demand={demand}
                batterySoc={batterySoc}
                threshold={300}
              />

              <LiveCharts records={records} />

              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Latest Streaming Ingestion Feed</h3>
                    <p className="card-subtitle">Kafka topic: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>renewable-energy-processed</span></p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('database')} 
                    className="control-btn"
                    style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                  >
                    View All in PostgreSQL
                  </button>
                </div>
                <div className="data-table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Offset</th>
                        <th>Source Timestamp</th>
                        <th>Wind Production</th>
                        <th>Solar Production</th>
                        <th>Total Renewable</th>
                        <th>Grid State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.slice(-5).reverse().map(r => (
                        <tr key={r.id}>
                          <td style={{ color: 'var(--accent-purple)' }}>#{r.offset}</td>
                          <td style={{ fontWeight: 600 }}>{r.timestamp}</td>
                          <td style={{ color: 'var(--accent-cyan)' }}>{r.wind?.toLocaleString()} kW</td>
                          <td style={{ color: 'var(--accent-amber)' }}>{r.solar?.toLocaleString()} kW</td>
                          <td style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{r.total?.toLocaleString()} kW</td>
                          <td>
                            <span className={`status-pill ${r.status === 'SURPLUS' ? 'streaming' : r.status === 'DEFICIT' ? 'deficit' : 'online'}`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Topology Tab */}
          {activeTab === 'topology' && <PipelineTopologyView />}

          {/* Forecasting Tab */}
          {activeTab === 'forecasting' && <ForecastingView latestRecord={latestRecord} />}

          {/* Grid Balancing Tab */}
          {activeTab === 'balancing' && (
            <GridBalancingView 
              generation={latestRecord.total}
              demand={demand}
              setDemand={setDemand}
              batterySoc={batterySoc}
              setBatterySoc={setBatterySoc}
            />
          )}

          {/* PostgreSQL Database Tab */}
          {activeTab === 'database' && <PostgresTableView records={records} />}
        </main>
      </div>
    </div>
  );
}
