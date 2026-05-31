import type { AgentBoxConfig, ContainerResponse, Message, QueryOptions } from './types.js'
import { ApiError } from './errors.js'
import { parseSseStream } from './sse.js'

export class AgentBox {
  public readonly id: string

  private readonly server: string
  private readonly token: string

  private constructor(id: string, server: string, token: string) {
    this.id = id
    this.server = server
    this.token = token
  }

  /**
   * Create a new agent container and return an AgentBox instance.
   */
  static async create(config: AgentBoxConfig): Promise<AgentBox> {
    const { agentServer, token, ...body } = config

    const res = await fetch(`${agentServer}/api/containers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new ApiError(res.status, text || res.statusText)
    }

    const data = (await res.json()) as ContainerResponse
    return new AgentBox(data.id, agentServer, token)
  }

  /**
   * Send a prompt to the agent container and stream back messages.
   * Returns an AsyncGenerator that yields Message objects.
   *
   * @example
   * ```ts
   * for await (const msg of agent.query('hello')) {
   *   if (msg.type === 'assistant') { ... }
   * }
   * ```
   */
  async *query(
    prompt: string,
    options?: QueryOptions,
    signal?: AbortSignal
  ): AsyncGenerator<Message> {
    const res = await fetch(`${this.server}/api/containers/${this.id}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({ prompt, options }),
      signal,
    })

    yield* parseSseStream(res, signal)
  }

  /**
   * Delete the container. Idempotent — 404 is not an error.
   */
  async delete(): Promise<void> {
    const res = await fetch(`${this.server}/api/containers/${this.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    })

    if (!res.ok && res.status !== 404) {
      const text = await res.text()
      throw new ApiError(res.status, text || res.statusText)
    }
  }
}
