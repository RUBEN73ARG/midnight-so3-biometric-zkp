/**
 * SO3 Hash Engine (browser-side)
 *
 * Simulates the SO(3)-invariant topological hash from the Python e3nn extractor,
 * using the Web Crypto API. In production, the actual e3nn network runs server-side
 * (or via WebAssembly). For this demo, we derive a deterministic hash from
 * the face's structural features (luminance histogram + edge map moments).
 */

export interface SO3HashResult {
  sHash: Uint8Array       // 32 bytes — topological fingerprint
  entropy: Uint8Array     // 32 bytes — physical entropy (crypto.getRandomValues)
  commitment: Uint8Array  // 32 bytes — Poseidon-like commitment (SHA-256)
  sHashHex: string
  entropyHex: string
  commitmentHex: string
}

/**
 * Converts Uint8Array to hex string.
 */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Extracts a luminance channel from RGBA image data.
 */
function getLuminance(imageData: ImageData): Float32Array {
  const data = imageData.data
  const lum = new Float32Array(imageData.width * imageData.height)
  for (let i = 0; i < lum.length; i++) {
    const r = data[i * 4] / 255
    const g = data[i * 4 + 1] / 255
    const b = data[i * 4 + 2] / 255
    lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b  // sRGB luminance
  }
  return lum
}

/**
 * Computes a simple Sobel edge map (rotation-stable local structure).
 */
function sobelEdge(lum: Float32Array, w: number, h: number): Float32Array {
  const edges = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x
      const gx = (
        -lum[(y-1)*w+(x-1)] + lum[(y-1)*w+(x+1)]
        -2*lum[y*w+(x-1)]   + 2*lum[y*w+(x+1)]
        -lum[(y+1)*w+(x-1)] + lum[(y+1)*w+(x+1)]
      )
      const gy = (
        -lum[(y-1)*w+(x-1)] - 2*lum[(y-1)*w+x] - lum[(y-1)*w+(x+1)]
        +lum[(y+1)*w+(x-1)] + 2*lum[(y+1)*w+x] + lum[(y+1)*w+(x+1)]
      )
      edges[idx] = Math.sqrt(gx*gx + gy*gy)
    }
  }
  return edges
}

/**
 * Computes 32 Zernike-like moments from a signal map.
 * These are rotation-invariant (SO(2) → approximating SO(3) projection).
 */
function computeMoments(signal: Float32Array, w: number, h: number): number[] {
  const moments: number[] = []
  const cx = w / 2, cy = h / 2
  const rx = w * 0.24  // Matches the UI guide oval width
  const ry = h * 0.35  // Matches the UI guide oval height

  for (let order = 0; order < 32; order++) {
    let moment = 0
    const freq = (order + 1) * Math.PI
    for (let y = 0; y < h; y += 4) {  // stride 4 for performance
      for (let x = 0; x < w; x += 4) {
        const dx = (x - cx) / rx
        const dy = (y - cy) / ry
        // Elliptical distance formula: (x/rx)^2 + (y/ry)^2
        const distSq = dx * dx + dy * dy
        if (distSq > 1) continue  // Exclude everything outside the UI guide oval
        
        const dist = Math.sqrt(distSq)
        const angle = Math.atan2(dy, dx)
        const basis = Math.cos(freq * dist) * Math.cos(order * angle)
        moment += signal[y * w + x] * basis
      }
    }
    moments.push(moment)
  }
  return moments
}

/**
 * Quantizes 32 float moments → 32 stable bytes (same logic as Python's quantize_to_bytes).
 */
function quantizeToBytes(moments: number[]): Uint8Array {
  const bytes = new Uint8Array(32)
  const max = Math.max(...moments.map(Math.abs)) || 1
  for (let i = 0; i < 32; i++) {
    // Sigmoid scaling for stability, identical to Python version
    const normalized = moments[i] / max
    const sigmoid = 1 / (1 + Math.exp(-normalized * 6))
    bytes[i] = Math.round(sigmoid * 255)
  }
  return bytes
}

/**
 * Main extraction function. Returns SO3HashResult.
 */
export async function extractSO3Hash(imageData: ImageData): Promise<SO3HashResult> {
  const { width: w, height: h } = imageData

  // 1. Luminance + Sobel edge features
  const lum = getLuminance(imageData)
  const edges = sobelEdge(lum, w, h)

  // 2. Rotation-invariant Zernike-like moments (simulates SO(3) invariance)
  const lumMoments = computeMoments(lum, w, h)
  const edgeMoments = computeMoments(edges, w, h)

  // 3. Combine: 16 lum moments + 16 edge moments = 32 dimensions
  const combined = [...lumMoments.slice(0, 16), ...edgeMoments.slice(0, 16)]
  const sHash = quantizeToBytes(combined)

  // 4. Physical entropy (Web Crypto — simulates Hall sensor noise)
  const entropy = new Uint8Array(32)
  crypto.getRandomValues(entropy)

  // 5. Commitment = SHA-256(sHash || entropy) — same as calculateSO3Commitment in TS
  const combined64 = new Uint8Array(64)
  combined64.set(sHash, 0)
  combined64.set(entropy, 32)
  const hashBuf = await crypto.subtle.digest('SHA-256', combined64)
  const commitment = new Uint8Array(hashBuf)

  return {
    sHash,
    entropy,
    commitment,
    sHashHex: toHex(sHash),
    entropyHex: toHex(entropy),
    commitmentHex: toHex(commitment),
  }
}

/**
 * Multi-capture extraction: Takes N ImageData captures, extracts moments from each,
 * averages them to reduce noise from lighting/expression variations, and produces
 * a more stable and reproducible topological hash.
 *
 * This interpolation significantly improves authentication precision because:
 * - Individual captures contain random noise from camera sensor fluctuations
 * - Averaging N captures reduces variance by a factor of √N
 * - The resulting s_hash is more representative of the true facial topology
 */
export async function extractSO3HashMulti(images: ImageData[]): Promise<SO3HashResult> {
  if (images.length === 0) throw new Error('No images provided')
  if (images.length === 1) return extractSO3Hash(images[0])

  const allMoments: number[][] = []

  for (const imageData of images) {
    const { width: w, height: h } = imageData
    const lum = getLuminance(imageData)
    const edges = sobelEdge(lum, w, h)
    const lumMoments = computeMoments(lum, w, h)
    const edgeMoments = computeMoments(edges, w, h)
    const combined = [...lumMoments.slice(0, 16), ...edgeMoments.slice(0, 16)]
    allMoments.push(combined)
  }

  // Average moments across all captures (interpolation)
  const avgMoments = new Array(32).fill(0)
  for (const moments of allMoments) {
    for (let i = 0; i < 32; i++) {
      avgMoments[i] += moments[i]
    }
  }
  for (let i = 0; i < 32; i++) {
    avgMoments[i] /= allMoments.length
  }

  const sHash = quantizeToBytes(avgMoments)

  // Physical entropy
  const entropy = new Uint8Array(32)
  crypto.getRandomValues(entropy)

  // Commitment = SHA-256(sHash || entropy)
  const combined64 = new Uint8Array(64)
  combined64.set(sHash, 0)
  combined64.set(entropy, 32)
  const hashBuf = await crypto.subtle.digest('SHA-256', combined64)
  const commitment = new Uint8Array(hashBuf)

  return {
    sHash,
    entropy,
    commitment,
    sHashHex: toHex(sHash),
    entropyHex: toHex(entropy),
    commitmentHex: toHex(commitment),
  }
}

