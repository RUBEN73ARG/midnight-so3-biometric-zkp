/**
 * API client for the Midnight backend.
 * The backend runs the actual Compact circuit transactions.
 */

const API_BASE = '/api'

export interface RegisterRequest {
  sHashHex: string
  entropyHex: string
  commitmentHex: string
}

export interface RegisterResponse {
  success: boolean
  contractAddress?: string
  commitment?: string
  txHash?: string
  error?: string
}

export interface AuthRequest {
  sHashHex: string
  entropyHex: string
  commitmentHex: string
  contractAddress: string
}

export interface AuthResponse {
  success: boolean
  verified?: boolean
  error?: string
}

export interface StatusResponse {
  connected: boolean
  contractAddress?: string
  network: string
  identityCount?: number
}

export async function getStatus(): Promise<StatusResponse> {
  const res = await fetch(`${API_BASE}/status`)
  if (!res.ok) throw new Error(`Status error: ${res.statusText}`)
  return res.json()
}

export async function registerIdentity(req: RegisterRequest): Promise<RegisterResponse> {
  const res = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  return res.json()
}

export async function authenticateIdentity(req: AuthRequest): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  return res.json()
}
