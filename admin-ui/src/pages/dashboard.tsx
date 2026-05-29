import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, Play, Clock, StopCircle, AlertTriangle, Box } from 'lucide-react'
import { useStats } from '@/hooks/use-stats'
import { useContainers } from '@/hooks/use-containers'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/containers/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const statCards = [
  { key: 'total', label: 'Total', icon: Box, color: 'text-blue-600' },
  { key: 'Running', label: 'Running', icon: Play, color: 'text-green-600' },
  { key: 'Idle', label: 'Idle', icon: Clock, color: 'text-yellow-600' },
  { key: 'Stopped', label: 'Stopped', icon: StopCircle, color: 'text-gray-600' },
  { key: 'Failed', label: 'Failed', icon: AlertTriangle, color: 'text-red-600' },
]

export function DashboardPage() {
  const navigate = useNavigate()
  const { data: stats, isLoading: statsLoading } = useStats()
  const { data: containers, isLoading: containersLoading } = useContainers({
    sort_by: 'created_at',
    sort_order: 'desc',
    per_page: 5,
  })

  return (
    <div>
      <Header title="Dashboard" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {statCards.map(({ key, label, icon: Icon, color }) => (
            <Card key={key}>
              <CardContent className="flex items-center gap-4 p-4">
                <Icon className={`h-8 w-8 ${color}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  {statsLoading ? (
                    <Skeleton className="h-6 w-12" />
                  ) : (
                    <p className="text-2xl font-bold">
                      {key === 'total' ? stats?.total ?? 0 : stats?.by_status?.[key] ?? 0}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Containers</CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate('/containers')}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {containersLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : containers && containers.data.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {containers.data.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/containers/${c.id}`)}
                    >
                      <TableCell className="font-mono text-xs">{c.id.slice(0, 8)}...</TableCell>
                      <TableCell className="max-w-40 truncate">{c.task}</TableCell>
                      <TableCell>
                        <StatusBadge status={c.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(c.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No containers yet.{' '}
                <button
                  className="text-primary underline"
                  onClick={() => navigate('/containers/new')}
                >
                  Create one
                </button>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
