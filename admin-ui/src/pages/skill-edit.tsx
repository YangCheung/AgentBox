import { useState, type FormEvent, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSkill, useUpdateSkill } from '@/hooks/use-skills'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

export function SkillEditPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { data: skill, isLoading } = useSkill(id)
  const mutation = useUpdateSkill()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (skill) {
      setName(skill.name)
      setDescription(skill.description)
    }
  }, [skill])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError(t('Skill name is required'))
      return
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name.trim())) {
      setError(t('Name must be alphanumeric with hyphens or underscores'))
      return
    }

    if (!id) return

    mutation.mutate(
      { id, body: { name: name.trim(), description: description.trim() } },
      {
        onSuccess: () => navigate('/skills'),
        onError: (err) => setError(err.message),
      },
    )
  }

  if (isLoading) {
    return (
      <div>
        <Header title={t('Edit Skill')} />
        <div className="mx-auto max-w-2xl p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (!skill) {
    return (
      <div>
        <Header title={t('Edit Skill')} />
        <div className="p-6 text-center">
          <p className="text-muted-foreground">{t('Skill not found')}</p>
          <Button variant="link" onClick={() => navigate('/skills')}>
            {t('Back to skills')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title={t('Edit Skill')} />
      <div className="mx-auto max-w-2xl p-6">
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('Skill Name')} *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('Description')}</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {mutation.isError && !error && (
                <p className="text-sm text-destructive">{mutation.error.message}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" type="button" onClick={() => navigate('/skills')}>
                  {t('Cancel')}
                </Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? t('Saving...') : t('Save')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
