import { useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useContainerLogs } from '@/hooks/use-container-logs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

interface LogViewerProps {
  containerId: string
}

export function LogViewer({ containerId }: LogViewerProps) {
  const { t } = useTranslation()
  const { lines, isConnected, clear } = useContainerLogs(containerId)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={isConnected ? 'default' : 'secondary'}>
            {isConnected ? t('Connected') : t('Disconnected')}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {t('{{count}} lines', { count: lines.length })}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={clear} disabled={lines.length === 0}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div className="h-80 overflow-y-auto rounded-md border bg-muted/50 p-3 font-mono text-xs">
        {lines.length === 0 ? (
          <p className="text-muted-foreground">{t('No logs yet...')}</p>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              {line}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}
