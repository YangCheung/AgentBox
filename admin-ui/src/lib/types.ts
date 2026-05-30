export interface Container {
  id: string
  task: string
  status: string
  docker_id: string | null
  skill_repos: string
  skill_ids: string
  cpu_limit: string
  memory_limit: string
  idle_timeout: number
  max_lifetime: number
  created_at: string
  last_activity: string
}

export type ContainerStatus = 'Creating' | 'Running' | 'Idle' | 'Stopping' | 'Stopped' | 'Failed'

export interface ContainerResponse {
  id: string
  status: ContainerStatus
  created_at: string
  docker_id: string | null
}

export interface CreateContainerRequest {
  task: string
  skill_repos?: string[]
  skill_ids?: string[]
  skill_branch?: string
  cpu_limit?: string
  memory_limit?: string
  idle_timeout?: number
  max_lifetime?: number
  env?: Record<string, string>
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface StatsResponse {
  total: number
  by_status: Record<string, number>
}

export interface Skill {
  id: string
  name: string
  description: string
  created_at: string
  updated_at: string
}

export interface UpdateSkillRequest {
  name?: string
  description?: string
}

export interface SetupStatus {
  docker_connected: boolean
  agent_image_ready: boolean
  agent_image_name: string
  api_key_configured: boolean
  all_ready: boolean
  project_root: string
}

export interface UpdateConfigResponse {
  api_key_updated: boolean
  new_api_key: string | null
}

// Sidecar query types

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

export interface QueryRequest {
  prompt: string
  options?: QueryOptions
}

export interface SseEvent {
  event: string
  data: string
}
