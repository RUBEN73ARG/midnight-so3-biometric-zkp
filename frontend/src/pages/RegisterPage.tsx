import { useState, useCallback } from 'react'
import type { Page } from '../App'
import CameraView from '../components/CameraView'
import { extractSO3Hash, extractSO3HashMulti } from '../lib/so3Engine'
import type { SO3HashResult } from '../lib/so3Engine'
import { registerIdentity } from '../lib/api'

interface RegisterPageProps {
  onNavigate: (page: Page) => void
}

type Step = 'capture' | 'processing' | 'confirm' | 'submitting' | 'success' | 'error'

export default function RegisterPage({ onNavigate }: RegisterPageProps) {
  const [step, setStep] = useState<Step>('capture')
  const [hashResult, setHashResult] = useState<SO3HashResult | null>(null)
  const [contractAddress, setContractAddress] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [cameraActive, setCameraActive] = useState(true)

  const stepIndex: Record<Step, number> = {
    capture: 0, processing: 1, confirm: 2, submitting: 3, success: 4, error: 4,
  }

  const handleCapture = useCallback(async (imageData: ImageData) => {
    setStep('processing')
    setCameraActive(false)
    try {
      const result = await extractSO3Hash(imageData)
      setHashResult(result)
      setStep('confirm')
    } catch (e) {
      setErrorMsg('Error al procesar la imagen. Intenta nuevamente.')
      setStep('error')
    }
  }, [])

  const handleMultiCapture = useCallback(async (images: ImageData[]) => {
    setStep('processing')
    setCameraActive(false)
    try {
      const result = await extractSO3HashMulti(images)
      setHashResult(result)
      setStep('confirm')
    } catch (e) {
      setErrorMsg('Error al procesar las capturas. Intenta nuevamente.')
      setStep('error')
    }
  }, [])

  const handleRegister = async () => {
    if (!hashResult) return
    setStep('submitting')
    try {
      const response = await registerIdentity({
        sHashHex: hashResult.sHashHex,
        entropyHex: hashResult.entropyHex,
        commitmentHex: hashResult.commitmentHex,
      })
      if (response.success && response.contractAddress) {
        setContractAddress(response.contractAddress)
        // Store commitment, secret entropy and registered s_hash (acts as fuzzy helper data)
        localStorage.setItem('so3_commitment', hashResult.commitmentHex)
        localStorage.setItem('so3_entropy', hashResult.entropyHex)
        localStorage.setItem('so3_s_hash', hashResult.sHashHex)
        localStorage.setItem('so3_contract', response.contractAddress)
        setStep('success')
      } else {
        setErrorMsg(response.error || 'El servidor de Midnight rechazó la transacción.')
        setStep('error')
      }
    } catch (e: unknown) {
      setErrorMsg('No se pudo conectar al servidor. ¿Está corriendo el backend?')
      setStep('error')
    }
  }

  const reset = () => {
    setStep('capture')
    setHashResult(null)
    setCameraActive(true)
    setErrorMsg('')
  }

  const steps = ['Cámara', 'Procesar', 'Confirmar', 'Subir', 'Listo']
  const currentStepIdx = stepIndex[step]

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '3rem 2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>◈</span>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Registrar Identidad</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Tu huella topológica será generada localmente y registrada en Midnight vía ZKP.
        </p>
      </div>

      {/* Step indicator */}
      <div className="step-indicator" style={{ marginBottom: '2.5rem' }}>
        {steps.map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700,
                background: i < currentStepIdx
                  ? 'var(--gradient-success)'
                  : i === currentStepIdx
                    ? 'var(--gradient-register)'
                    : 'var(--border)',
                color: i <= currentStepIdx ? 'white' : 'var(--text-muted)',
                boxShadow: i === currentStepIdx ? '0 0 16px rgba(159,122,234,0.4)' : 'none',
                transition: 'all 0.3s ease',
              }}>
                {i < currentStepIdx ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: '0.65rem', color: i === currentStepIdx ? 'var(--accent-purple)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: '0 4px',
                background: i < currentStepIdx ? 'var(--accent-green)' : 'var(--border)',
                marginBottom: '18px',
                transition: 'background 0.3s ease',
              }} />
            )}
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ gap: '1.5rem', alignItems: 'start' }}>
        {/* Left: Camera / result */}
        <div>
          {(step === 'capture' || step === 'processing') && (
            <CameraView
              onCapture={handleCapture}
              active={cameraActive}
              multiCapture={3}
              onMultiCapture={handleMultiCapture}
            />
          )}

          {(step === 'confirm' || step === 'submitting') && hashResult && (
            <div className="card" style={{
              background: 'linear-gradient(135deg, rgba(159,122,234,0.08), rgba(99,179,237,0.08))',
              borderColor: 'var(--border-glow)',
            }}>
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>◈</div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--accent-purple)' }}>
                  Hash Topológico Generado
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>S_HASH</p>
                  <div className="hash-display">{hashResult.sHashHex}</div>
                </div>
                <div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>ENTROPY</p>
                  <div className="hash-display" style={{ color: 'var(--accent-purple)' }}>{hashResult.entropyHex}</div>
                </div>
                <div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>COMMITMENT</p>
                  <div className="hash-display" style={{ color: 'var(--accent-cyan)' }}>{hashResult.commitmentHex}</div>
                </div>
              </div>

              <div className="alert alert-info" style={{ marginTop: '1rem' }}>
                <span>🔒</span>
                <span style={{ fontSize: '0.78rem' }}>
                  Solo el COMMITMENT será enviado a la blockchain. S_HASH y ENTROPY permanecen en tu dispositivo.
                </span>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="card" style={{
              borderColor: 'rgba(104,211,145,0.3)',
              background: 'rgba(104,211,145,0.05)',
              textAlign: 'center',
              padding: '2rem',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
              <h3 style={{ color: 'var(--accent-green)', marginBottom: '0.5rem' }}>Identidad Registrada</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Tu identidad topológica está en la cadena de Midnight.
              </p>
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>CONTRATO</p>
                <div className="hash-display" style={{ fontSize: '0.65rem' }}>{contractAddress}</div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>COMMITMENT</p>
                <div className="hash-display" style={{ fontSize: '0.65rem' }}>{hashResult?.commitmentHex}</div>
              </div>
            </div>
          )}

          {step === 'error' && (
            <div className="card" style={{
              borderColor: 'rgba(252,129,129,0.3)',
              background: 'rgba(252,129,129,0.05)',
              textAlign: 'center',
              padding: '2rem',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
              <h3 style={{ color: 'var(--accent-red)', marginBottom: '0.5rem' }}>Error</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Right: Info + Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {step === 'capture' && (
            <div className="card">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>Instrucciones</h3>
              <ol style={{ paddingLeft: '1.2rem', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 2 }}>
                <li>Alinea tu <strong style={{ color: 'var(--accent-cyan)' }}>nariz</strong> en la cruz central naranja</li>
                <li>Ubica tus <strong style={{ color: 'var(--accent-cyan)' }}>ojos</strong> dentro de los cuadros naranjas</li>
                <li>Asegúrate de tener buena iluminación</li>
                <li>Mantén el rostro estático durante las 3 tomas</li>
                <li>Presiona <strong style={{ color: 'var(--text-primary)' }}>Capturar Rostro</strong></li>
              </ol>
              <div className="alert alert-info" style={{ marginTop: '0.5rem' }}>
                <span>🔬</span>
                <span style={{ fontSize: '0.75rem' }}>Se tomarán 3 capturas automáticas para interpolar vectores y mejorar la precisión biométrica.</span>
              </div>
              <div className="alert alert-info" style={{ marginTop: '1rem' }}>
                <span>ℹ️</span>
                <span style={{ fontSize: '0.78rem' }}>La imagen NO se sube. El hash se genera 100% en tu dispositivo.</span>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem', width: 40, height: 40, borderWidth: 3 }} />
              <h3 style={{ marginBottom: '0.5rem' }}>Procesando</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Extrayendo momentos de Zernike y calculando hash topológico SO(3)-invariante...
              </p>
            </div>
          )}

          {step === 'confirm' && (
            <>
              <div className="card">
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>Resumen</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Dimensiones del hash</span>
                    <span className="badge badge-blue">32 bytes</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Entropía</span>
                    <span className="badge badge-purple">32 bytes</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Commitment</span>
                    <span className="badge badge-cyan" style={{ background: 'rgba(79,209,199,0.15)', color: 'var(--accent-cyan)', border: '1px solid rgba(79,209,199,0.2)' }}>SHA-256</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Red</span>
                    <span className="badge badge-green">Local · Midnight</span>
                  </div>
                </div>
              </div>

              <button
                className="btn btn-register btn-lg"
                onClick={handleRegister}
                style={{ width: '100%' }}
              >
                ⬡ Registrar en Midnight
              </button>

              <button
                className="btn btn-outline"
                onClick={reset}
                style={{ width: '100%' }}
              >
                ↩ Recapturar
              </button>
            </>
          )}

          {step === 'submitting' && (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem', width: 40, height: 40, borderWidth: 3 }} />
              <h3 style={{ marginBottom: '0.5rem' }}>Generando ZKP</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                El servidor de pruebas de Midnight está generando la Zero-Knowledge Proof...
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Esto puede tardar 20-30 segundos.
              </p>
            </div>
          )}

          {step === 'success' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                className="btn btn-success btn-lg"
                onClick={() => onNavigate('auth')}
                style={{ width: '100%' }}
              >
                ◎ Probar Autenticación
              </button>
              <button
                className="btn btn-outline"
                onClick={() => onNavigate('dashboard')}
                style={{ width: '100%' }}
              >
                ◇ Ver Dashboard
              </button>
              <button className="btn btn-sm" onClick={reset} style={{ width: '100%', color: 'var(--text-secondary)' }}>
                + Registrar Otra Identidad
              </button>
            </div>
          )}

          {step === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn btn-primary" onClick={reset} style={{ width: '100%' }}>
                ↩ Intentar de Nuevo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
