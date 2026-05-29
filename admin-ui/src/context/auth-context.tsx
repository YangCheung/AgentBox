import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface AuthState {
  apiKey: string | null
  isAuthenticated: boolean
  login: (key: string, remember: boolean) => void
  logout: () => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(() => {
    return localStorage.getItem('agentbox_api_key') ?? sessionStorage.getItem('agentbox_api_key') ?? null
  })

  useEffect(() => {
    const handler = () => {
      setApiKey(null)
    }
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [])

  const login = (key: string, remember: boolean) => {
    if (remember) {
      localStorage.setItem('agentbox_api_key', key)
      sessionStorage.removeItem('agentbox_api_key')
    } else {
      sessionStorage.setItem('agentbox_api_key', key)
      localStorage.removeItem('agentbox_api_key')
    }
    setApiKey(key)
  }

  const logout = () => {
    localStorage.removeItem('agentbox_api_key')
    sessionStorage.removeItem('agentbox_api_key')
    setApiKey(null)
  }

  return (
    <AuthContext.Provider value={{ apiKey, isAuthenticated: apiKey !== null, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
