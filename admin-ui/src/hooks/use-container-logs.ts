import { useState, useEffect, useRef, useCallback } from 'react'
import { wsUrl } from '@/lib/api-client'

export function useContainerLogs(containerId: string | undefined) {
  const [lines, setLines] = useState<string[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<number>(0)
  const reconnectDelay = useRef(1000)

  const connect = useCallback(() => {
    if (!containerId) return

    const url = wsUrl(`/api/containers/${containerId}/logs`)
    const ws = new WebSocket(url)

    ws.onopen = () => {
      setIsConnected(true)
      reconnectDelay.current = 1000
    }

    ws.onmessage = (event) => {
      setLines((prev) => {
        const next = [...prev, event.data]
        return next.length > 5000 ? next.slice(-5000) : next
      })
    }

    ws.onclose = () => {
      setIsConnected(false)
      wsRef.current = null
      reconnectTimer.current = window.setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000)
        connect()
      }, reconnectDelay.current)
    }

    ws.onerror = () => {
      ws.close()
    }

    wsRef.current = ws
  }, [containerId])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const clear = () => setLines([])

  return { lines, isConnected, clear }
}
