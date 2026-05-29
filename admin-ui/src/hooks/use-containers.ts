import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post, del } from '@/lib/api-client'
import type { Container, PaginatedResponse, CreateContainerRequest, ContainerResponse } from '@/lib/types'

interface ListParams {
  status?: string
  search?: string
  sort_by?: string
  sort_order?: string
  page?: number
  per_page?: number
}

function buildQuery(params: ListParams): string {
  const sp = new URLSearchParams()
  if (params.status) sp.set('status', params.status)
  if (params.search) sp.set('search', params.search)
  if (params.sort_by) sp.set('sort_by', params.sort_by)
  if (params.sort_order) sp.set('sort_order', params.sort_order)
  if (params.page) sp.set('page', String(params.page))
  if (params.per_page) sp.set('per_page', String(params.per_page))
  const qs = sp.toString()
  return qs ? `?${qs}` : ''
}

export function useContainers(params: ListParams = {}) {
  return useQuery<PaginatedResponse<Container>>({
    queryKey: ['containers', params],
    queryFn: () => get(`/api/containers${buildQuery(params)}`),
  })
}

export function useContainer(id: string | undefined) {
  return useQuery<Container>({
    queryKey: ['container', id],
    queryFn: () => get(`/api/containers/${id}`),
    enabled: !!id,
  })
}

export function useCreateContainer() {
  const qc = useQueryClient()
  return useMutation<ContainerResponse, Error, CreateContainerRequest>({
    mutationFn: (body) => post('/api/containers', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['containers'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useDeleteContainer() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (id) => del(`/api/containers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['containers'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}
