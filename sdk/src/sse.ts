import { ApiError, StreamError } from './errors.js'
import type { Message } from './types.js'

/**
 * Parse an SSE stream from a fetch Response into an AsyncGenerator of Messages.
 * Adapted from admin-ui/src/lib/api-client.ts postSseStream.
 */
export async function* parseSseStream(
  response: Response,
  signal?: AbortSignal
): AsyncGenerator<Message> {
  if (!response.ok) {
    const text = await response.text()
    throw new ApiError(response.status, text || response.statusText)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new StreamError('No response body')

  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = ''
  let currentData = ''

  try {
    while (true) {
      if (signal?.aborted) {
        throw new StreamError('Stream aborted', signal.reason)
      }

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7)
        } else if (line.startsWith('data: ')) {
          currentData = line.slice(6)
        } else if (line === '') {
          if (currentData) {
            yield parseMessage(currentEvent || 'message', currentData)
          }
          currentEvent = ''
          currentData = ''
        }
        // Keep-alive comments (lines starting with ':') are ignored
      }
    }
  } catch (err) {
    if (err instanceof StreamError) throw err
    throw new StreamError('Stream read error', err)
  } finally {
    reader.cancel()
  }

  // Flush any remaining event
  if (currentData) {
    yield parseMessage(currentEvent || 'message', currentData)
  }
}

function parseMessage(event: string, data: string): Message {
  try {
    const parsed = JSON.parse(data)
    // The SSE event name determines the message type
    if (event && (!parsed.type || parsed.type === 'message')) {
      parsed.type = event
    }
    return parsed as Message
  } catch {
    return { type: 'error', message: `Failed to parse SSE data: ${data}` }
  }
}
