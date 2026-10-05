import React, { useState } from 'react';
import { 
  Cpu, 
  Send, 
  Layers, 
  Workflow, 
  Radio, 
  Database, 
  BrainCircuit, 
  Sliders, 
  CheckCircle, 
  ArrowRight,
  Shield,
  Activity
} from 'lucide-react';
import { pipelineNodes } from '../data/mockData';

export default function PipelineTopologyView() {
  const [selectedNode, setSelectedNode] = useState(pipelineNodes[0]);

  const nodeIcons = {
    source: Cpu,
    bridge: Send,
    broker: Layers,
    processor: Workflow,
    topic: Radio,
    consumer: Activity,
    storage: Database
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Topology Pipeline Visualizer */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon" style={{ color: 'var(--accent-cyan)' }}>
              <Layers size={18} />
            </div>
            <div>
              <h2 className="card-title">Live Kafka 4.3.1 Pipeline Topology</h2>
              <p className="card-subtitle">End-to-end stream flow as defined in PRD Section 5 & 24</p>
            </div>
          </div>
          <span className="status-pill online">
            <span className="dot pulse" /> Architecture Healthy
          </span>
        </div>

        {/* Nodes Flow */}
        <div className="pipeline-diagram">
          {pipelineNodes.map((node, index) => {
            const Icon = nodeIcons[node.type] || Layers;
            const isSelected = selectedNode?.id === node.id;
            return (
              <React.Fragment key={node.id}>
                <div
                  id={`pipeline-node-${node.id}`}
                  onClick={() => setSelectedNode(node)}
                  className="node-box"
                  style={{
                    borderColor: isSelected ? 'var(--accent-green)' : 'var(--border-card)',
                    background: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer'
                  }}
                >
                  <div 
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255,255,255,0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isSelected ? 'var(--accent-green)' : 'var(--text-muted)'
                    }}
                  >
                    <Icon size={18} />
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {node.name}
                  </div>
                  <span className="node-tag">{node.tech}</span>
                  <div style={{ fontSize: '0.7rem', color: 'var(--accent-green)', fontWeight: 500 }}>
                    ● {node.status}
                  </div>
                </div>

                {index < pipelineNodes.length - 1 && (
                  <div className="node-arrow">
                    <ArrowRight size={18} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Node Deep-Dive Inspection Panel */}
      {selectedNode && (
        <div className="card" style={{ borderLeft: '4px solid var(--accent-green)' }}>
          <div className="card-header">
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--accent-green)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                Selected Component Inspector
              </span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                {selectedNode.name}
              </h3>
            </div>
            <span className="status-pill streaming">
              {selectedNode.tech}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', fontSize: '0.85rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.75rem', textTransform: 'uppercase' }}>Configuration & Spec</div>
              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
                {selectedNode.metrics}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.75rem', textTransform: 'uppercase' }}>Guardrail Compliance</div>
              <div style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={15} />
                <span>Zero NaN/Inf published • Schema validated</span>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.75rem', textTransform: 'uppercase' }}>Log Signature</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
                [{selectedNode.id.toUpperCase()}] Verified stream handshake
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guardrails & Testing Matrix */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon" style={{ color: 'var(--accent-purple)' }}>
              <Shield size={18} />
            </div>
            <div>
              <h2 className="card-title">System Testing Matrix (PRD Section 21)</h2>
              <p className="card-subtitle">End-to-end verification checklist</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          {[
            { test: 'Test 1: Kafka Availability', desc: 'Broker listening on localhost:9092 in KRaft mode', status: 'Passed' },
            { test: 'Test 2: Producer Emission', desc: 'Sequential JSON publication with source timestamps', status: 'Passed' },
            { test: 'Test 3: Stream Processing', desc: 'Real-time transformation to renewable-energy-processed', status: 'Passed' },
            { test: 'Test 4: SQL Storage', desc: 'Parameterized INSERT into energy_readings table', status: 'Passed' },
            { test: 'Test 5: Full End-to-End', desc: 'Wokwi -> Producer -> Broker -> Streams -> Sub -> DB', status: 'Passed' }
          ].map((t, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t.test}</span>
                <span className="status-pill online" style={{ fontSize: '0.65rem' }}>{t.status}</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
