import { useState, useEffect, useRef } from 'react'
import type { Page } from '../App'

interface LandingPageProps {
  onNavigate: (page: Page) => void
}

// Animated 3D node canvas
function NodeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Generate nodes
    const nodes = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 2 + 1,
    }))

    const draw = () => {
      if (!canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Update positions
      nodes.forEach(n => {
        n.x += n.vx
        n.y += n.vy
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1
      })

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx*dx + dy*dy)
          if (dist < 100) {
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.strokeStyle = `rgba(99, 179, 237, ${0.15 * (1 - dist / 100)})`
            ctx.lineWidth = 1
            ctx.stroke()
          }
        }
      }

      // Draw nodes
      nodes.forEach(n => {
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(99, 179, 237, 0.6)'
        ctx.fill()
      })

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  )
}

const features = [
  {
    icon: '◈',
    title: 'SO(3)-Equivariante',
    desc: 'La red neuronal e3nn garantiza invarianza rotacional — tu huella topológica es idéntica desde cualquier ángulo.',
    color: 'var(--accent-blue)',
  },
  {
    icon: '⬡',
    title: 'Zero-Knowledge Proof',
    desc: 'Tu dato biométrico NUNCA sale del dispositivo. Solo el commitment Poseidon se registra en la blockchain de Midnight.',
    color: 'var(--accent-purple)',
  },
  {
    icon: '◎',
    title: 'Privacy-First',
    desc: 'Autenticación sin contraseñas, sin servidores centralizados. Tu identidad vive en el protocolo ZK.',
    color: 'var(--accent-cyan)',
  },
]

const steps = [
  { num: '01', title: 'Captura', desc: 'Cámara frontal extrae tu huella estructural' },
  { num: '02', title: 'Hash SO(3)', desc: 'Red neuronal genera S_hash invariante a rotaciones' },
  { num: '03', title: 'ZKP', desc: 'Prueba de conocimiento cero generada localmente' },
  { num: '04', title: 'On-Chain', desc: 'Solo el commitment se registra en Midnight L2' },
]

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <div style={{ minHeight: '100vh', overflow: 'hidden' }}>
      {/* Hero */}
      <section style={{
        position: 'relative',
        minHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,179,237,0.08) 0%, transparent 70%)',
        overflow: 'hidden',
      }}>
        <NodeCanvas />

        {/* Glow orbs */}
        <div style={{
          position: 'absolute', width: 400, height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(159,122,234,0.12) 0%, transparent 70%)',
          top: '10%', left: '15%',
          pointerEvents: 'none',
          filter: 'blur(40px)',
        }} />
        <div style={{
          position: 'absolute', width: 300, height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,179,237,0.1) 0%, transparent 70%)',
          bottom: '20%', right: '10%',
          pointerEvents: 'none',
          filter: 'blur(40px)',
        }} />

        <div style={{ position: 'relative', textAlign: 'center', maxWidth: 680, zIndex: 1 }}>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <span className="badge badge-blue">Midnight L2</span>
            <span className="badge badge-purple">SO(3) Equivariante</span>
            <span className="badge badge-green">Zero-Knowledge</span>
          </div>

          <h1 style={{
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            marginBottom: '1.5rem',
          }}>
            Identidad{' '}
            <span style={{
              background: 'linear-gradient(135deg, #63b3ed, #9f7aea)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Topológica
            </span>
            <br />
            en la Blockchain
          </h1>

          <p style={{
            fontSize: '1.1rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            marginBottom: '2.5rem',
          }}>
            Tu huella 3D, invariante a rotaciones, procesada por redes SO(3)-equivariantes
            y verificada mediante Zero-Knowledge Proofs en Midnight. Sin contraseñas. Sin servidores. Solo criptografía.
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-register btn-lg"
              onClick={() => onNavigate('register')}
              style={{ minWidth: 180 }}
            >
              ◈ Registrar Identidad
            </button>
            <button
              className="btn btn-outline btn-lg"
              onClick={() => onNavigate('auth')}
              style={{ minWidth: 160 }}
            >
              ◎ Autenticarme
            </button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '4rem 2rem', maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Cómo Funciona
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '3rem' }}>
          4 pasos. 0 contraseñas. 100% privado.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          {steps.map((s, i) => (
            <div key={i} className="card" style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
              <div style={{
                fontSize: '2rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: 'var(--accent-blue)',
                opacity: 0.4,
                marginBottom: '0.5rem',
              }}>{s.num}</div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{s.title}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '2rem 2rem 6rem', maxWidth: 900, margin: '0 auto' }}>
        <div className="grid-3">
          {features.map((f, i) => (
            <div
              key={i}
              className="card"
              style={{
                cursor: 'default',
                borderColor: hovered === i ? `${f.color}44` : 'var(--border)',
                boxShadow: hovered === i ? `0 0 30px ${f.color}22` : 'none',
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div style={{ fontSize: '1.8rem', color: f.color, marginBottom: '0.75rem' }}>{f.icon}</div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem' }}>{f.title}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
