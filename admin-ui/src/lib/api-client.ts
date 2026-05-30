const API_BASE = ''

function getToken(): string | null {
  const key = localStorage.getItem('agentbox_api_key') ?? sessionStorage.getItem('agentbox_api_key')
  return key || null
}

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (res.status === 401) {
    localStorage.removeItem('agentbox_api_key')
    sessionStorage.removeItem('agentbox_api_key')
    window.dispatchEvent(new CustomEvent('auth:logout'))
    throw new ApiError('Unauthorized', 401)
  }

  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(text || res.statusText, res.status)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json()
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path)
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  })
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' })
}

export function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  })
}

export async function upload<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (res.status === 401) {
    localStorage.removeItem('agentbox_api_key')
    sessionStorage.removeItem('agentbox_api_key')
    window.dispatchEvent(new CustomEvent('auth:logout'))
    throw new ApiError('Unauthorized', 401)
  }

  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(text || res.statusText, res.status)
  }

  return res.json()
}

export function wsUrl(path: string): string {
  const token = getToken()
  const base = window.location.hostname === 'localhost'
    ? `ws://localhost:8080${path}`
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${path}`
  if (token) {
    return `${base}?token=${encodeURIComponent(token)}`
  }
  return base
}

export { ApiError }
