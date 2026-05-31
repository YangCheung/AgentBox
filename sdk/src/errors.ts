export class AgentBoxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentBoxError'
  }
}

export class ApiError extends AgentBoxError {
  public readonly status: number
  public readonly body: string

  constructor(status: number, body: string) {
    super(`API error ${status}: ${body}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export class StreamError extends AgentBoxError {
  public readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'StreamError'
    this.cause = cause
  }
}
