import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, RefreshCw, Trash2, Send, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useContainer, useDeleteContainer } from '@/hooks/use-containers'
import { useAllSkills } from '@/hooks/use-skills'
import { useContainerQuery } from '@/hooks/use-container-query'
import { useToast } from '@/context/toast-context'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/containers/status-badge'
import { LogViewer } from '@/components/logs/log-viewer'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'
import type { QueryOptions } from '@/lib/types'

export function ContainerDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: container, isLoading, isError } = useContainer(id)
  const deleteMutation = useDeleteContainer()
  const { data: allSkills } = useAllSkills()
  const toast = useToast()

  // Query state
  const query = useContainerQuery(id)
  const [prompt, setPrompt] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [model, setModel] = useState('')
  const [maxTurns, setMaxTurns] = useState('')

  const buildOptions = (): QueryOptions | undefined => {
    const opts: QueryOptions = {}
    if (model.trim()) opts.model = model.trim()
    if (maxTurns.trim()) opts.max_turns = parseInt(maxTurns, 10)
    return Object.keys(opts).length > 0 ? opts : undefined
  }

  const handleSend = () => {
    if (!prompt.trim()) return
    query.sendQuery(prompt.trim(), buildOptions())
  }

  const handleDelete = () => {
    if (id) {
      deleteMutation.mutate(id, {
        onSuccess: () => {
          toast.success(t('Container deleted successfully'))
          navigate('/containers')
        },
        onError: () => toast.error(t('Failed to delete container')),
      })
    }
  }

  if (isLoading) {
    return (
      <div>
        <Header title={t('Container Detail')} />
        <div className="p-6 space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (isError || !container) {
    return (
      <div>
        <Header title={t('Container Detail')} />
        <div className="flex flex-col items-center gap-4 p-16">
          <p className="text-muted-foreground">{t('Container not found')}</p>
          <Button variant="outline" onClick={() => navigate('/containers')}>
            <ArrowLeft className="h-4 w-4" /> {t('Back to list')}
          </Button>
        </div>
      </div>
    )
  }

  const repos: string[] = (() => {
    try {
      return JSON.parse(container.skill_repos)
    } catch {
      return []
    }
  })()

  const skillIds: string[] = (() => {
    try {
      return JSON.parse(container.skill_ids)
    } catch {
      return []
    }
  })()

  const skillNames = skillIds
    .map((id) => allSkills?.data.find((s) => s.id === id)?.name)
    .filter(Boolean) as string[]

  return (
    <div>
      <Header
        title={t('Container {{id}}...', { id: container.id.slice(0, 12) })}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/containers')}>
              <ArrowLeft className="h-4 w-4" /> {t('Back')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteMutation.isPending}>
              <Trash2 className="h-4 w-4" /> {t('Delete')}
            </Button>
          </div>
        }
      />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t('Status')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <StatusBadge status={container.status} />
              <dl className="space-y-1 text-xs">
                <div className="flex gap-2">
                  <dt className="w-24 text-muted-foreground">{t('Docker ID')}</dt>
                  <dd className="font-mono">{container.docker_id ?? t('N/A')}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 text-muted-foreground">{t('Created')}</dt>
                  <dd>{formatDate(container.created_at)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 text-muted-foreground">{t('Last Activity')}</dt>
                  <dd>{formatDate(container.last_activity)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t('Configuration')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs">
              <div className="flex gap-2">
                <dt className="w-28 text-muted-foreground">{t('Task')}</dt>
                <dd className="max-w-60 truncate">{container.task}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 text-muted-foreground">{t('CPU / Memory')}</dt>
                <dd>
                  {container.cpu_limit} / {container.memory_limit}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 text-muted-foreground">{t('Idle Timeout')}</dt>
                <dd>{container.idle_timeout}s</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 text-muted-foreground">{t('Max Lifetime')}</dt>
                <dd>{container.max_lifetime}s</dd>
              </div>
              {skillNames.length > 0 && (
                <div className="flex gap-2">
                  <dt className="w-28 text-muted-foreground">{t('Skills')}</dt>
                  <dd>{skillNames.join(', ')}</dd>
                </div>
              )}
              {repos.length > 0 && (
                <div className="flex gap-2">
                  <dt className="w-28 text-muted-foreground">{t('Skill Repos')}</dt>
                  <dd>
                    {repos.map((r, i) => (
                      <div key={i} className="font-mono text-xs truncate">
                        {r}
                      </div>
                    ))}
                  </dd>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Query Sidecar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('Query Sidecar')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Prompt input */}
            <Textarea
              placeholder={t('Enter your prompt...')}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSend()
                }
              }}
              disabled={query.isStreaming}
              rows={3}
            />

            {/* Advanced options toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="h-7 px-2 text-xs"
            >
              {showAdvanced ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
              {t('Advanced Options')}
            </Button>

            {/* Advanced options fields */}
            {showAdvanced && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('Model')}</label>
                  <Input
                    placeholder="claude-sonnet-4-6"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    disabled={query.isStreaming}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('Max Turns')}</label>
                  <Input
                    type="number"
                    placeholder="10"
                    value={maxTurns}
                    onChange={(e) => setMaxTurns(e.target.value)}
                    disabled={query.isStreaming}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSend}
                disabled={query.isStreaming || !prompt.trim()}
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {t('Send')}
              </Button>
              {query.isStreaming && (
                <Button variant="outline" size="sm" onClick={query.cancel}>
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  {t('Cancel')}
                </Button>
              )}
              {query.events.length > 0 && !query.isStreaming && (
                <Button variant="ghost" size="sm" onClick={query.clear}>
                  {t('Clear')}
                </Button>
              )}
            </div>

            {/* Error display */}
            {query.error && (
              <p className="text-destructive text-sm">{query.error}</p>
            )}

            {/* SSE event display */}
            <div className="h-80 overflow-y-auto rounded-md border bg-muted/50 p-3 font-mono text-xs">
              {query.events.length === 0 && !query.isStreaming && (
                <p className="text-muted-foreground text-center mt-20">
                  {t('Send a prompt to query the sidecar...')}
                </p>
              )}
              {query.events.map((ev, i) => (
                <div key={i} className="mb-2 leading-relaxed">
                  <Badge variant="outline" className="mr-1.5 text-[10px] px-1 py-0 align-middle">
                    {ev.event}
                  </Badge>
                  <span className="whitespace-pre-wrap break-all">{ev.data}</span>
                </div>
              ))}
              {query.isStreaming && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Skeleton className="h-3 w-full" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('Logs')}</CardTitle>
          </CardHeader>
          <CardContent>
            <LogViewer containerId={container.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
