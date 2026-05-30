import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, put, del, upload } from '@/lib/api-client'
import type { Skill, UpdateSkillRequest, PaginatedResponse } from '@/lib/types'

interface ListParams {
  search?: string
  page?: number
  per_page?: number
}

export function useSkills(params: ListParams = {}) {
  const searchParams = new URLSearchParams()
  if (params.search) searchParams.set('search', params.search)
  if (params.page) searchParams.set('page', String(params.page))
  if (params.per_page) searchParams.set('per_page', String(params.per_page))
  const qs = searchParams.toString()

  return useQuery<PaginatedResponse<Skill>>({
    queryKey: ['skills', params],
    queryFn: () => get(`/api/skills${qs ? `?${qs}` : ''}`),
  })
}

export function useSkill(id: string | undefined) {
  return useQuery<Skill>({
    queryKey: ['skill', id],
    queryFn: () => get(`/api/skills/${id}`),
    enabled: !!id,
  })
}

export function useAllSkills() {
  return useQuery<PaginatedResponse<Skill>>({
    queryKey: ['skills', 'all'],
    queryFn: () => get('/api/skills?per_page=100'),
  })
}

export function useCreateSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (formData: FormData) => upload('/api/skills', formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
  })
}

export function useUpdateSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSkillRequest }) =>
      put(`/api/skills/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
  })
}

export function useDeleteSkill() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => del(`/api/skills/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] })
    },
  })
}
