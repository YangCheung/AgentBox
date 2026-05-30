import { useState, useRef, useCallback } from 'react'
import { postSseStream } from '@/lib/api-client'
import type { QueryOptions, SseEvent } from '@/lib/types'

export function useContainerQuery(containerId: string | undefined) {
  const [events, setEvents] = useState<SseEvent[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const sendQuery = useCallback(
    async (prompt: string, options?: QueryOptions) => {
      if (!containerId || !prompt.trim()) return

      // Cancel any in-progress query
      abortControllerRef.current?.abort()

      const controller = new AbortController()
      abortControllerRef.current = controller

      setEvents([])
      setError(null)
      setIsStreaming(true)

      try {
        await postSseStream(
          `/api/containers/${containerId}/query`,
          { prompt, options },
          (event) => {
            setEvents((prev) => [...prev, event])
          },
          controller.signal
        )
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError((err as Error).message || 'Query failed')
      } finally {
        setIsStreaming(false)
      }
    },
    [containerId]
  )

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
  }, [])

  const clear = useCallback(() => {
    setEvents([])
    setError(null)
  }, [])

  return { events, isStreaming, error, sendQuery, cancel, clear }
}
