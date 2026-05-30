import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, Search, ChevronLeft, ChevronRight, Trash2, Pencil } from 'lucide-react'
import { useSkills, useDeleteSkill } from '@/hooks/use-skills'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils'

export function SkillListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useSkills({
    search: search || undefined,
    page,
    per_page: 20,
  })
  const deleteMutation = useDeleteSkill()

  const totalPages = data?.total_pages ?? 1

  return (
    <div>
      <Header
        title={t('Skills')}
        actions={
          <Button size="sm" onClick={() => navigate('/skills/new')}>
            <Plus className="h-4 w-4" />
            {t('Create')}
          </Button>
        }
      />
      <div className="p-6 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('Search skills...')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : data && data.data.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Name')}</TableHead>
                  <TableHead>{t('Description')}</TableHead>
                  <TableHead>{t('Created')}</TableHead>
                  <TableHead className="w-[100px]">{t('Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((skill) => (
                  <TableRow key={skill.id}>
                    <TableCell className="font-medium">{skill.name}</TableCell>
                    <TableCell className="max-w-60 truncate text-muted-foreground">
                      {skill.description || '-'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(skill.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/skills/${skill.id}/edit`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(skill.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t('Page {{page}} of {{totalPages}} ({{total}} total)', {
                  page,
                  totalPages,
                  total: data.total,
                })}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" /> {t('Prev')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('Next')} <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {search ? t('No skills match your search.') : t('No skills yet.')}
            </p>
            <Button variant="link" onClick={() => navigate('/skills/new')}>
              {t('Create your first skill')}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogClose onClick={() => setDeleteId(null)} />
        <DialogHeader>
          <DialogTitle>{t('Delete Skill')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('Are you sure you want to delete this skill?')}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteId(null)}>
            {t('Cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (deleteId) {
                deleteMutation.mutate(deleteId)
                setDeleteId(null)
              }
            }}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? t('Deleting...') : t('Delete')}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
