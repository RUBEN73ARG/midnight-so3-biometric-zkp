import { useRef, useEffect, useState, useCallback } from 'react'

interface CameraViewProps {
  onCapture: (imageData: ImageData) => void
  active: boolean
  multiCapture?: number
  onMultiCapture?: (images: ImageData[]) => void
}

export default function CameraView({ onCapture, active, multiCapture = 3, onMultiCapture }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animRef = useRef<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [captureCount, setCaptureCount] = useState(0)
  const [isCapturing, setIsCapturing] = useState(false)

  // Animated scan lines overlay
  const drawOverlay = useCallback((t: number) => {
    const canvas = overlayRef.current
    const video = videoRef.current
    if (!canvas || !video || !ready) return
    const ctx = canvas.getContext('2d')!
    canvas.width = video.videoWidth || 320
    canvas.height = video.videoHeight || 240

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Scan line
    const scanY = ((t * 0.0008) % 1) * canvas.height
    const gradient = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30)
    gradient.addColorStop(0, 'rgba(79, 209, 199, 0)')
    gradient.addColorStop(0.5, 'rgba(79, 209, 199, 0.6)')
    gradient.addColorStop(1, 'rgba(79, 209, 199, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, scanY - 30, canvas.width, 60)

    // Draw semi-transparent dark overlay outside the oval to focus on the face
    ctx.fillStyle = 'rgba(5, 8, 16, 0.55)'
    ctx.beginPath()
    ctx.rect(0, 0, canvas.width, canvas.height)
    const rx = canvas.width * 0.24
    const ry = canvas.height * 0.35
    ctx.ellipse(canvas.width / 2, canvas.height / 2, rx, ry, 0, 0, Math.PI * 2, true)
    ctx.fill()

    // Draw central face alignment oval (glowing dashed line)
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)'
    ctx.lineWidth = 2.5
    ctx.setLineDash([8, 6])
    ctx.beginPath()
    ctx.ellipse(canvas.width / 2, canvas.height / 2, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])

    // Glowing frame effect
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.ellipse(canvas.width / 2, canvas.height / 2, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()

    // --- TELESCOPIC RETICLE & CROSSHAIR ALIGNMENT ---
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)'
    ctx.lineWidth = 1.5

    // Vertical nose guide line (dashed)
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(canvas.width / 2, canvas.height / 2 - ry)
    ctx.lineTo(canvas.width / 2, canvas.height / 2 + ry)
    ctx.stroke()

    // Horizontal eye guide line (dashed)
    const eyeY = canvas.height / 2 - ry * 0.25
    ctx.beginPath()
    ctx.moveTo(canvas.width / 2 - rx, eyeY)
    ctx.lineTo(canvas.width / 2 + rx, eyeY)
    ctx.stroke()
    ctx.setLineDash([])

    // Center crosshair "+" (Strong Neon Orange)
    ctx.strokeStyle = 'rgba(255, 85, 0, 0.95)'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(canvas.width / 2, canvas.height / 2 - 14)
    ctx.lineTo(canvas.width / 2, canvas.height / 2 + 14)
    ctx.moveTo(canvas.width / 2 - 14, canvas.height / 2)
    ctx.lineTo(canvas.width / 2 + 14, canvas.height / 2)
    ctx.stroke()

    // Left and Right Eye target boxes
    ctx.strokeStyle = 'rgba(255, 85, 0, 0.95)'
    ctx.lineWidth = 2
    const eyeWidth = 36
    const eyeHeight = 20
    const eyeOffsetX = rx * 0.45
    ctx.strokeRect(canvas.width / 2 - eyeOffsetX - eyeWidth / 2, eyeY - eyeHeight / 2, eyeWidth, eyeHeight)
    ctx.strokeRect(canvas.width / 2 + eyeOffsetX - eyeWidth / 2, eyeY - eyeHeight / 2, eyeWidth, eyeHeight)

    // Center circle of the reticle
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(canvas.width / 2, canvas.height / 2, 25, 0, Math.PI * 2)
    ctx.stroke()

    // Corner markers
    const size = 20
    const margin = 16
    ctx.strokeStyle = 'rgba(79, 209, 199, 0.8)'
    ctx.lineWidth = 2

    const corners = [
      [margin, margin], [canvas.width - margin, margin],
      [margin, canvas.height - margin], [canvas.width - margin, canvas.height - margin],
    ]
    corners.forEach(([x, y], i) => {
      ctx.beginPath()
      if (i === 0) { ctx.moveTo(x, y + size); ctx.lineTo(x, y); ctx.lineTo(x + size, y) }
      if (i === 1) { ctx.moveTo(x - size, y); ctx.lineTo(x, y); ctx.lineTo(x, y + size) }
      if (i === 2) { ctx.moveTo(x, y - size); ctx.lineTo(x, y); ctx.lineTo(x + size, y) }
      if (i === 3) { ctx.moveTo(x - size, y); ctx.lineTo(x, y); ctx.lineTo(x, y - size) }
      ctx.stroke()
    })

    // Grid dots
    ctx.fillStyle = 'rgba(99, 179, 237, 0.15)'
    for (let gx = 30; gx < canvas.width; gx += 30) {
      for (let gy = 30; gy < canvas.height; gy += 30) {
        ctx.beginPath()
        ctx.arc(gx, gy, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Multi-capture indicator
    if (isCapturing && captureCount > 0) {
      ctx.fillStyle = 'rgba(255, 85, 0, 0.9)'
      ctx.font = 'bold 18px "Space Grotesk", sans-serif'
      ctx.textAlign = 'center'
      ctx.shadowColor = 'black'
      ctx.shadowBlur = 6
      ctx.fillText(`Captura ${captureCount}/${multiCapture}`, canvas.width / 2, 30)
      ctx.shadowBlur = 0
    }

    animRef.current = requestAnimationFrame(drawOverlay)
  }, [ready, isCapturing, captureCount, multiCapture])

  // Simple Camera Start (no keepalives, no loops, no device selection to prevent locks)
  useEffect(() => {
    if (!active) return
    let isMounted = true

    const startCamera = async () => {
      try {
        let constraints: MediaStreamConstraints = {
          video: { facingMode: 'user' }
        }

        // Silently search for the physical BisonCam NB Pro hardware in the system
        try {
          const devices = await navigator.mediaDevices.enumerateDevices()
          const bison = devices.find(d => 
            d.kind === 'videoinput' && 
            d.label.toLowerCase().includes('bison')
          )
          if (bison && bison.deviceId) {
            console.log("Directly targeting BisonCam NB Pro hardware ID:", bison.deviceId)
            constraints = {
              video: { deviceId: { exact: bison.deviceId } }
            }
          }
        } catch (e) {
          console.warn("Could not pre-enumerate devices:", e)
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)

        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            if (isMounted) {
              setReady(true)
              setError(null)
            }
          }
        }
      } catch (e: unknown) {
        if (!isMounted) return
        const errMsg = e instanceof Error ? e.message : String(e)
        setError(`Error al iniciar la cámara: ${errMsg}. Comprueba que la cámara no esté en uso por otra app.`)
      }
    }

    startCamera()

    return () => {
      isMounted = false
      cancelAnimationFrame(animRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      setReady(false)
    }
  }, [active])

  useEffect(() => {
    if (ready) {
      animRef.current = requestAnimationFrame(drawOverlay)
    }
    return () => cancelAnimationFrame(animRef.current)
  }, [ready, drawOverlay])

  // Multi-capture function
  const captureMultipleFrames = useCallback(async () => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')!

    setIsCapturing(true)
    setCaptureCount(0)
    const captures: ImageData[] = []

    for (let i = 0; i < multiCapture; i++) {
      setCaptureCount(i + 1)
      // Wait 600ms to allow the user to settle and let the canvas redraw the count
      await new Promise(r => setTimeout(r, 600))
      ctx.drawImage(video, 0, 0)
      captures.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
    }

    setIsCapturing(false)
    setCaptureCount(0)

    // Show progress animation
    setScanProgress(0)
    let p = 0
    const interval = setInterval(() => {
      p += 5
      setScanProgress(p)
      if (p >= 100) {
        clearInterval(interval)
        if (onMultiCapture) {
          onMultiCapture(captures)
        } else {
          onCapture(captures[captures.length - 1])
        }
      }
    }, 30)
  }, [onCapture, onMultiCapture, multiCapture])

  // Single capture function (legacy fallback)
  const captureFrame = useCallback(() => {
    if (onMultiCapture) {
      captureMultipleFrames()
      return
    }
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)

    setScanProgress(0)
    let p = 0
    const interval = setInterval(() => {
      p += 5
      setScanProgress(p)
      if (p >= 100) {
        clearInterval(interval)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        onCapture(imageData)
      }
    }, 30)
  }, [onCapture, onMultiCapture, captureMultipleFrames])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = 640
        canvas.height = 480
        const ctx = canvas.getContext('2d')!
        
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, 640, 480)
        
        const hRatio = 640 / img.width
        const vRatio = 480 / img.height
        const ratio  = Math.min(hRatio, vRatio)
        const shiftX = (640 - img.width * ratio) / 2
        const shiftY = (480 - img.height * ratio) / 2
        
        ctx.drawImage(img, 0, 0, img.width, img.height, shiftX, shiftY, img.width * ratio, img.height * ratio)
        
        setScanProgress(0)
        let p = 0
        const interval = setInterval(() => {
          p += 5
          setScanProgress(p)
          if (p >= 100) {
            clearInterval(interval)
            const imageData = ctx.getImageData(0, 0, 640, 480)
            onCapture(imageData)
          }
        }, 30)
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }, [onCapture])

  return (
    <div>
      {/* Camera container */}
      <div style={{
        position: 'relative',
        borderRadius: 'var(--radius)',
        overflow: error ? 'visible' : 'hidden',
        background: '#000',
        border: '1px solid var(--border)',
        aspectRatio: error ? undefined : '4/3',
        minHeight: error ? '340px' : undefined,
        width: '100%',
      }}>
        {error ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', padding: '1rem', textAlign: 'center',
            flexDirection: 'column', gap: '0.75rem',
            background: 'rgba(5,8,16,0.96)',
          }}>
            <span style={{ fontSize: '2rem' }}>📷</span>
            <div>
              <p style={{ color: 'var(--accent-red)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>{error}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', maxWidth: '280px', margin: '0 auto', lineHeight: 1.35 }}>
                Nota: Los navegadores bloquean la cámara si no usas <strong>localhost</strong> o <strong>HTTPS</strong>. Si estás usando una IP o red local, usa el port forwarding de VS Code.
              </p>
            </div>
            
            <div style={{
              borderTop: '1px solid var(--border)',
              paddingTop: '0.75rem',
              width: '90%',
              marginTop: '0.25rem',
            }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', marginBottom: '8px', fontWeight: 500 }}>
                Alternativa: Sube una foto de tu rostro
              </p>
              <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', padding: '6px 14px', fontSize: '0.78rem' }}>
                📁 Seleccionar Foto
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileUpload} 
                  style={{ display: 'none' }} 
                />
              </label>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <canvas
              ref={overlayRef}
              style={{
                position: 'absolute', top: 0, left: 0,
                width: '100%', height: '100%', pointerEvents: 'none',
              }}
            />

            {/* Scan progress */}
            {scanProgress > 0 && scanProgress < 100 && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '8px 12px',
                background: 'rgba(0,0,0,0.7)',
              }}>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${scanProgress}%` }} />
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', marginTop: '4px' }}>
                  Extrayendo hash topológico... {scanProgress}%
                </p>
              </div>
            )}

            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {!ready && !error && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.6)',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div className="spinner" style={{ margin: '0 auto 12px' }} />
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Iniciando cámara...</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Capture button - BELOW camera container */}
      {ready && scanProgress === 0 && !isCapturing && (
        <div style={{
          textAlign: 'center',
          marginTop: '12px',
        }}>
          <button
            className="btn btn-primary"
            onClick={captureFrame}
            style={{ 
              padding: '10px 28px', 
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            📸 Capturar Rostro {onMultiCapture ? `(${multiCapture} tomas)` : ''}
          </button>
        </div>
      )}

      {/* Multi-capture in progress indicator */}
      {isCapturing && (
        <div style={{
          textAlign: 'center',
          marginTop: '12px',
        }}>
          <div className="spinner" style={{ margin: '0 auto 8px', width: 24, height: 24 }} />
          <p style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
            Capturando toma {captureCount}/{multiCapture}... Mantén el rostro estático
          </p>
        </div>
      )}
    </div>
  )
}
