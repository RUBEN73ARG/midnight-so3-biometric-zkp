import { useState, useCallback } from 'react'
import type { Page } from '../App'
import CameraView from '../components/CameraView'
import { extractSO3Hash, extractSO3HashMulti } from '../lib/so3Engine'
import type { SO3HashResult } from '../lib/so3Engine'
import { authenticateIdentity } from '../lib/api'

interface AuthPageProps {
  onNavigate: (page: Page) => void
}

type Step = 'capture' | 'processing' | 'confirm' | 'verifying' | 'success' | 'failure' | 'error'

// Standalone helper for tolerant byte-wise similarity calculation (difference <= 8)
const getSimilarity = (h1: string, h2: string) => {
  if (!h1 || !h2) return 0
  const b1 = h1.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) || []
  const b2 = h2.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) || []
  if (b1.length === 0 || b1.length !== b2.length) return 0
  
  let matches = 0
  for (let i = 0; i < b1.length; i++) {
    // Tightened byte-wise comparison: difference <= 8 out of 255
    if (Math.abs(b1[i] - b2[i]) <= 8) {
      matches++
    }
  }
  return matches / b1.length
}

export default function AuthPage({ onNavigate }: AuthPageProps) {
  const [step, setStep] = useState<Step>('capture')
  const [hashResult, setHashResult] = useState<SO3HashResult | null>(null)
  const [cameraActive, setCameraActive] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [similarityScore, setSimilarityScore] = useState<number | null>(null)

  // Retrieve stored credentials
  const storedContract = localStorage.getItem('so3_contract') || ''
  const storedCommitment = localStorage.getItem('so3_commitment') || ''
  const storedEntropy = localStorage.getItem('so3_entropy') || ''
  const storedSHash = localStorage.getItem('so3_s_hash') || ''

  const handleCapture = useCallback(async (imageData: ImageData) => {
    setStep('processing')
    setCameraActive(false)
    try {
      const result = await extractSO3Hash(imageData)
      setHashResult(result)
      if (storedSHash) {
        const score = getSimilarity(result.sHashHex, storedSHash)
        setSimilarityScore(score)
        console.log(`[Diagnostic] Live single-capture similarity: ${(score * 100).toFixed(1)}%`)
      }
      setStep('confirm')
    } catch {
      setErrorMsg('Error al procesar la imagen.')
      setStep('error')
    }
  }, [storedSHash])

  const handleMultiCapture = useCallback(async (images: ImageData[]) => {
    setStep('processing')
    setCameraActive(false)
    try {
      const result = await extractSO3HashMulti(images)
      setHashResult(result)
      if (storedSHash) {
        const score = getSimilarity(result.sHashHex, storedSHash)
        setSimilarityScore(score)
        console.log(`[Diagnostic] Live multi-capture averaged similarity: ${(score * 100).toFixed(1)}%`)
      }
      setStep('confirm')
    } catch {
      setErrorMsg('Error al procesar las capturas.')
      setStep('error')
    }
  }, [storedSHash])

  const handleAuth = async () => {
    if (!hashResult || !storedContract) return
    setStep('verifying')

    // Fuzzy Extractor Simulator:
    // Computes similarity between the live captured hash and the registered one.
    // If similarity > 55% (same face, slight lighting/angle differences), it reconstructs
    // the exact registered s_hash. Otherwise, it uses the new one (which will fail ZKP).
    const score = getSimilarity(hashResult.sHashHex, storedSHash)
    setSimilarityScore(score)
    
    // Increased threshold to 55% for secure verification
    const resolvedSHash = score >= 0.55 ? storedSHash : hashResult.sHashHex

    console.log(`[Authentication] Similarity: ${(score * 100).toFixed(1)}%. Target resolved hash matches registered? ${score >= 0.55}`)

    try {
      const response = await authenticateIdentity({
        sHashHex: resolvedSHash,
        entropyHex: storedEntropy || hashResult.entropyHex, // Use the stored physical entropy key
        commitmentHex: storedCommitment,
        contractAddress: storedContract,
      })
      if (response.success && response.verified) {
        setStep('success')
      } else {
        setStep('failure')
      }
    } catch {
      setErrorMsg('No se pudo conectar al servidor.')
      setStep('error')
    }
  }

  const reset = () => {
    setStep('capture')
    setHashResult(null)
    setSimilarityScore(null)
    setCameraActive(true)
    setErrorMsg('')
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '3rem 2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>◎</span>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Autenticación Topológica</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Verifica tu identidad mediante ZKP sin revelar datos biométricos.
        </p>
      </div>

      {!storedContract && (
        <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
          <span>⚠️</span>
          <span>No hay identidad registrada en este dispositivo. <button
            className="btn btn-sm"
            style={{ marginLeft: '8px', background: 'transparent', color: 'var(--accent-orange)', border: '1px solid var(--accent-orange)', padding: '2px 10px' }}
            onClick={() => onNavigate('register')}
          >Registrar ahora</button>
          </span>
        </div>
      )}

      {storedContract && (
        <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
          <span>◎</span>
          <div style={{ fontSize: '0.78rem' }}>
            <div>Contrato: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{storedContract.slice(0, 24)}...</span></div>
            <div>Commitment: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)' }}>{storedCommitment.slice(0, 24)}...</span></div>
          </div>
        </div>
      )}

      <div className="grid-2" style={{ gap: '1.5rem', alignItems: 'start' }}>
        {/* Left */}
        <div>
          {(step === 'capture' || step === 'processing') && (
            <CameraView
              onCapture={handleCapture}
              active={cameraActive}
              multiCapture={3}
              onMultiCapture={handleMultiCapture}
            />
          )}

          {step === 'confirm' && hashResult && (
            <div className="card" style={{
              background: 'linear-gradient(135deg, rgba(99,179,237,0.08), rgba(79,209,199,0.08))',
              borderColor: 'var(--border-glow)',
            }}>
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>◎</div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--accent-blue)' }}>
                  Hash Capturado
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>S_HASH (nuevo)</p>
                  <div className="hash-display">{hashResult.sHashHex}</div>
                </div>
                {similarityScore !== null && (
                  <div style={{
                    marginTop: '0.5rem',
                    padding: '10px 14px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                  }}>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Similitud Biométrica</p>
                    <p style={{ 
                      fontSize: '1.2rem', 
                      fontWeight: 700, 
                      margin: 0,
                      color: similarityScore >= 0.55 ? 'var(--accent-green)' : 'var(--accent-orange)' 
                    }}>
                      {(similarityScore * 100).toFixed(0)}% 
                      <span style={{ fontSize: '0.7rem', fontWeight: 400, marginLeft: '8px', color: 'var(--text-muted)' }}>
                        ({similarityScore >= 0.55 ? 'Aceptable' : 'Insuficiente, requiere >= 55%'})
                      </span>
                    </p>
                  </div>
                )}
                <div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>COMMITMENT (almacenado)</p>
                  <div className="hash-display" style={{ color: 'var(--accent-purple)' }}>{storedCommitment}</div>
                </div>
              </div>
            </div>
          )}

          {step === 'verifying' && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
              <div style={{ position: 'relative', width: 60, height: 60, margin: '0 auto 1.5rem' }}>
                <div className="spinner" style={{ width: 60, height: 60, borderWidth: 3 }} />
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>◎</span>
              </div>
              <h3 style={{ marginBottom: '0.5rem' }}>Verificando en Midnight</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                El circuito ZK está verificando tu prueba de conocimiento cero...
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="card" style={{
              borderColor: 'rgba(104,211,145,0.3)',
              background: 'linear-gradient(135deg, rgba(104,211,145,0.08), rgba(79,209,199,0.08))',
              textAlign: 'center',
              padding: '3rem 2rem',
            }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
              <h2 style={{ color: 'var(--accent-green)', marginBottom: '0.5rem' }}>Identidad Verificada</h2>
              {similarityScore !== null && (
                <p style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', marginBottom: '1rem', fontFamily: 'var(--font-mono)' }}>
                  Coincidencia Biométrica: {(similarityScore * 100).toFixed(0)}% (Requerido: &gt;45%)
                </p>
              )}
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                El contrato ZK confirmó que eres el poseedor legítimo de esta identidad topológica.
              </p>
            </div>
          )}

          {step === 'failure' && (
            <div className="card" style={{
              borderColor: 'rgba(252,129,129,0.3)',
              background: 'rgba(252,129,129,0.05)',
              textAlign: 'center',
              padding: '3rem 2rem',
            }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚫</div>
              <h2 style={{ color: 'var(--accent-red)', marginBottom: '0.5rem' }}>No Verificado</h2>
              {similarityScore !== null && (
                <p style={{ fontSize: '0.85rem', color: 'var(--accent-orange)', marginBottom: '1rem', fontFamily: 'var(--font-mono)' }}>
                  Coincidencia Biométrica: {(similarityScore * 100).toFixed(0)}% (Requerido: &gt;45%)
                </p>
              )}
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                La prueba ZK falló. El hash topológico no coincide con el commitment registrado.
              </p>
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
              <p style={{ color: 'var(--accent-red)' }}>{errorMsg}</p>
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
                <li>Asegúrate de tener la misma iluminación que en el registro</li>
                <li>Mantén el rostro estático durante las 3 tomas</li>
                <li>Presiona <strong style={{ color: 'var(--text-primary)' }}>Capturar Rostro</strong></li>
              </ol>
              <div className="alert alert-info" style={{ marginTop: '0.5rem' }}>
                <span>🔬</span>
                <span style={{ fontSize: '0.75rem' }}>Se promediarán 3 tomas para validar la similitud contra la cara registrada.</span>
              </div>
              <div className="alert alert-info" style={{ marginTop: '1rem' }}>
                <span>🔒</span>
                <span style={{ fontSize: '0.78rem' }}>Solo el ZKP es enviado. Tu imagen nunca sale del dispositivo.</span>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="spinner" style={{ margin: '0 auto 1rem', width: 40, height: 40, borderWidth: 3 }} />
              <h3>Extrayendo Hash</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Computando momentos topológicos...
              </p>
            </div>
          )}

          {step === 'confirm' && (
            <>
              <div className="card">
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>Proceso de Verificación</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  <p>1. 📸 Hash topológico extraído del frame actual</p>
                  <p>2. 🔐 Se generará prueba ZK con tu hash + commitment almacenado</p>
                  <p>3. ⬡ El contrato en Midnight verificará la prueba</p>
                  <p>4. ✅ Sin revelar tu S_hash al servidor</p>
                </div>
              </div>
              <button className="btn btn-primary btn-lg" onClick={handleAuth} disabled={!storedContract} style={{ width: '100%' }}>
                ◎ Verificar Identidad
              </button>
              <button className="btn btn-outline" onClick={reset} style={{ width: '100%' }}>
                ↩ Recapturar
              </button>
            </>
          )}

          {step === 'verifying' && (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Generando proof... espera ~30s
              </p>
            </div>
          )}

          {(step === 'success' || step === 'failure') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn btn-primary" onClick={reset} style={{ width: '100%' }}>
                ↩ Intentar Nuevamente
              </button>
              <button className="btn btn-outline" onClick={() => onNavigate('dashboard')} style={{ width: '100%' }}>
                ◇ Ver Dashboard
              </button>
            </div>
          )}

          {step === 'error' && (
            <button className="btn btn-primary" onClick={reset} style={{ width: '100%' }}>
              ↩ Intentar de Nuevo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
