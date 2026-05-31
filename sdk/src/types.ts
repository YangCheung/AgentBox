// ─── Container API ───────────────────────────────────────────

export type ContainerStatus = 'Creating' | 'Running' | 'Idle' | 'Stopping' | 'Stopped' | 'Failed'

export interface ContainerResponse {
  id: string
  status: ContainerStatus
  created_at: string
  docker_id: string | null
}

export interface AgentBoxConfig {
  /** Control Plane URL, e.g. "http://localhost:8080" */
  agentServer: string
  /** Control Plane API key for Authorization header */
  token: string
  /** Agent task description */
  task: string
  /** Uploaded skill IDs to copy into the container */
  skill_ids?: string[]
  /** Git URLs of skill repos */
  skill_repos?: string[]
  /** Branch for skill repos */
  skill_branch?: string
  /** CPU limit, e.g. "2" */
  cpu_limit?: string
  /** Memory limit, e.g. "4Gi" */
  memory_limit?: string
  /** Idle timeout in seconds */
  idle_timeout?: number
  /** Max lifetime in seconds */
  max_lifetime?: number
  /** Environment variables injected into the container (e.g. ANTHROPIC_API_KEY, MODEL) */
  env?: Record<string, string>
}

// ─── Query Options (matches sidecar/src/query.rs) ───────────

export interface QueryOptions {
  model?: string
  fallback_model?: string
  system_prompt?: string
  append_system_prompt?: string
  max_turns?: number
  max_output_tokens?: number
  max_thinking_tokens?: number
  allowed_tools?: string[]
  disallowed_tools?: string[]
  cwd?: string
  session_id?: string
  resume?: string
  continue_conversation?: boolean
  include_partial_messages?: boolean
  max_budget_usd?: number
}

// ─── ContentBlock types (wire format, no type discriminant) ──

export interface TextContent {
  text: string
}

export interface ThinkingContent {
  thinking: string
  signature: string
}

export interface ToolUseContent {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResultContent {
  tool_use_id: string
  content?: string | unknown[]
  is_error?: boolean
}

export type ContentBlock = TextContent | ThinkingContent | ToolUseContent | ToolResultContent

export function isTextContent(block: ContentBlock): block is TextContent {
  return 'text' in block
}

export function isThinkingContent(block: ContentBlock): block is ThinkingContent {
  return 'thinking' in block
}

export function isToolUseContent(block: ContentBlock): block is ToolUseContent {
  return 'id' in block && 'name' in block && 'input' in block
}

export function isToolResultContent(block: ContentBlock): block is ToolResultContent {
  return 'tool_use_id' in block
}

// ─── Message types (discriminated by SSE event name) ─────────

export interface AssistantMessage {
  type: 'assistant'
  message: {
    content: ContentBlock[]
    model?: string
    usage?: Record<string, unknown>
  }
}

export interface UserMessage {
  type: 'user'
  message: {
    content: string
  }
}

export interface SystemMessage {
  type: 'system'
  subtype: string
  data: unknown
}

export interface ResultMessage {
  type: 'result'
  subtype: string
  duration_ms: number
  duration_api_ms?: number
  is_error: boolean
  num_turns: number
  session_id: string
  total_cost_usd?: number
  usage?: Record<string, unknown>
  result?: string
  structured_output?: unknown
  stop_reason?: string
}

export interface StreamEventMessage {
  type: 'stream_event'
  uuid: string
  session_id: string
  event: StreamEvent
  parent_tool_use_id?: string
}

export type StreamEvent =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageDeltaEvent
  | MessageStopEvent

export interface MessageStartEvent {
  type: 'message_start'
  message: { id: string; model: string; role: string }
}

export interface ContentBlockStartEvent {
  type: 'content_block_start'
  index: number
  content_block: { type: string; text?: string; thinking?: string }
}

export interface ContentBlockDeltaEvent {
  type: 'content_block_delta'
  index: number
  delta: TextDelta | ThinkingDelta | SignatureDelta
}

export interface TextDelta {
  type: 'text_delta'
  text: string
}

export interface ThinkingDelta {
  type: 'thinking_delta'
  thinking: string
}

export interface SignatureDelta {
  type: 'signature_delta'
  signature: string
}

export interface ContentBlockStopEvent {
  type: 'content_block_stop'
  index: number
}

export interface MessageDeltaEvent {
  type: 'message_delta'
  delta: { stop_reason?: string }
  usage?: Record<string, unknown>
}

export interface MessageStopEvent {
  type: 'message_stop'
}

export function isTextDelta(delta: ContentBlockDeltaEvent['delta']): delta is TextDelta {
  return delta.type === 'text_delta'
}

export function isThinkingDelta(delta: ContentBlockDeltaEvent['delta']): delta is ThinkingDelta {
  return delta.type === 'thinking_delta'
}

export interface RateLimitMessage {
  type: 'rate_limit'
  rate_limit_info: {
    status: string
    resets_at?: string
    rate_limit_type?: string
    utilization?: number
    overage_status?: string
    overage_resets_at?: string
    overage_disabled_reason?: string
    raw?: unknown
  }
  uuid: string
  session_id: string
}

export interface ErrorMessage {
  type: 'error'
  message: string
}

export type Message =
  | AssistantMessage
  | UserMessage
  | SystemMessage
  | ResultMessage
  | StreamEventMessage
  | RateLimitMessage
  | ErrorMessage
