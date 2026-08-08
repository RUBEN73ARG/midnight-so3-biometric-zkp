import { useState, useEffect } from 'react'
import type { Page } from '../App'
import { getStatus } from '../lib/api'

interface DashboardPageProps {
  onNavigate: (page: Page) => void
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [status, setStatus] = useState<{ connected: boolean; identityCount: number; contractAddress: string; network: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const storedContract = localStorage.getItem('so3_contract') || ''
  const storedCommitment = localStorage.getItem('so3_commitment') || ''

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const s = await getStatus()
      setStatus({
        connected: s.connected,
        identityCount: s.identityCount ?? 0,
        contractAddress: s.contractAddress ?? storedContract,
        network: s.network,
      })
    } catch {
      setStatus({ connected: false, identityCount: 0, contractAddress: storedContract, network: 'local' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStatus() }, [])

  const stats = [
    {
      label: 'Red',
      value: status?.network ?? 'local',
      icon: '⬡',
      color: 'var(--accent-blue)',
    },
    {
      label: 'Estado Backend',
      value: loading ? '...' : status?.connected ? 'Conectado' : 'Desconectado',
      icon: status?.connected ? '✅' : '❌',
      color: status?.connected ? 'var(--accent-green)' : 'var(--accent-red)',
    },
    {
      label: 'Identidades Registradas',
      value: loading ? '...' : String(status?.identityCount ?? 0),
      icon: '◈',
      color: 'var(--accent-purple)',
    },
    {
      label: 'Protocolo',
      value: 'Midnight ZKP',
      icon: '◎',
      color: 'var(--accent-cyan)',
    },
  ]

  const archItems = [
    { title: 'Cámara Frontend', desc: 'React + WebGL + MediaDevices API', badge: 'Browser', color: 'var(--accent-blue)' },
    { title: 'SO3 Hash Engine', desc: 'Momentos de Zernike + SHA-256', badge: 'Client-side', color: 'var(--accent-cyan)' },
    { title: 'Backend Express', desc: 'Midnight SDK + Wallet seed', badge: 'Node.js', color: 'var(--accent-purple)' },
    { title: 'Compact Circuit', desc: 'verify_and_register + verify_topological_identity', badge: 'On-chain', color: 'var(--accent-orange)' },
    { title: 'Proof Server', desc: 'ZK proof generation (local Docker)', badge: 'midnight-proof-server', color: 'var(--accent-green)' },
    { title: 'Midnight Node', desc: 'Ledger + consensus local', badge: 'midnight-node', color: 'var(--accent-blue)' },
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '3rem 2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>◇</span>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Dashboard</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Estado del sistema SO3-TCN Identity en Midnight Local.
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={fetchStatus} disabled={loading}>
          {loading ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Actualizando</> : '↻ Refrescar'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        {stats.map((s, i) => (
          <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: `${s.color}18`,
              border: `1px solid ${s.color}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.2rem', flexShrink: 0,
            }}>
              {s.icon}
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '2px' }}>{s.label}</p>
              <p style={{ fontSize: '1rem', fontWeight: 600, color: s.color }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Identity stored */}
      {(storedCommitment || storedContract) && (
        <div className="card" style={{
          marginBottom: '1.5rem',
          background: 'linear-gradient(135deg, rgba(159,122,234,0.06), rgba(99,179,237,0.06))',
          borderColor: 'var(--border-glow)',
        }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--accent-purple)' }}>◈</span> Identidad Registrada en Este Dispositivo
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {storedContract && (
              <div>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>CONTRATO</p>
                <div className="hash-display">{storedContract}</div>
              </div>
            )}
            {storedCommitment && (
              <div>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>COMMITMENT ON-CHAIN</p>
                <div className="hash-display" style={{ color: 'var(--accent-purple)' }}>{storedCommitment}</div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button className="btn btn-success btn-sm" onClick={() => onNavigate('auth')}>◎ Autenticar</button>
            <button
              className="btn btn-sm"
              style={{ background: 'transparent', color: 'var(--accent-red)', border: '1px solid rgba(252,129,129,0.3)' }}
              onClick={() => {
                localStorage.removeItem('so3_contract')
                localStorage.removeItem('so3_commitment')
                window.location.reload()
              }}
            >
              🗑 Limpiar
            </button>
          </div>
        </div>
      )}

      {/* Architecture */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem' }}>Arquitectura del Sistema</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {archItems.map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: 10,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: item.color, flexShrink: 0,
                boxShadow: `0 0 8px ${item.color}`,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>{item.title}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.desc}</p>
              </div>
              <span className="badge" style={{
                background: `${item.color}18`,
                color: item.color,
                border: `1px solid ${item.color}33`,
                flexShrink: 0,
              }}>
                {item.badge}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid-2">
        <button className="btn btn-register btn-lg" onClick={() => onNavigate('register')} style={{ width: '100%' }}>
          ◈ Nueva Identidad
        </button>
        <button className="btn btn-primary btn-lg" onClick={() => onNavigate('auth')} style={{ width: '100%' }}>
          ◎ Autenticar
        </button>
      </div>
    </div>
  )
}
