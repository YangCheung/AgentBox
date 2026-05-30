import { useState, type FormEvent, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Upload, FileCheck, FileX, Loader2 } from 'lucide-react'
import { useCreateSkill } from '@/hooks/use-skills'
import { parseSkillManifest } from '@/lib/skill-manifest'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

type ManifestStatus = 'idle' | 'parsing' | 'found' | 'not-found'

export function SkillCreatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const mutation = useCreateSkill()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [manifestStatus, setManifestStatus] = useState<ManifestStatus>('idle')
  const [dragging, setDragging] = useState(false)

  const processFile = useCallback(async (f: File) => {
    setFile(f)
    setManifestStatus('parsing')
    try {
      const manifest = await parseSkillManifest(f)
      if (manifest) {
        if (manifest.name) setName(manifest.name)
        if (manifest.description) setDescription(manifest.description)
        setManifestStatus('found')
      } else {
        setManifestStatus('not-found')
      }
    } catch {
      setManifestStatus('not-found')
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && f.name.endsWith('.zip')) {
      processFile(f)
    }
  }, [processFile])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!file) {
      setError(t('Please upload a ZIP file'))
      return
    }

    const formData = new FormData()
    if (name.trim()) formData.append('name', name.trim())
    if (description.trim()) formData.append('description', description.trim())
    formData.append('file', file)

    mutation.mutate(formData, {
      onSuccess: () => navigate('/skills'),
      onError: (err) => setError(err.message),
    })
  }

  return (
    <div>
      <Header title={t('Create Skill')} />
      <div className="mx-auto max-w-2xl p-6">
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('Skill ZIP File')} *</Label>
                <div
                  className={`flex flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6 cursor-pointer transition-colors ${
                    dragging ? 'border-primary bg-primary/5' : 'hover:border-primary'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {file ? (
                    <>
                      <FileCheck className="h-8 w-8 text-green-500" />
                      <p className="text-sm">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {t('Drop ZIP file here or click to upload')}
                      </p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) processFile(f)
                    }}
                  />
                </div>
                {manifestStatus === 'parsing' && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t('Parsing manifest...')}
                  </p>
                )}
                {manifestStatus === 'found' && (
                  <p className="flex items-center gap-1.5 text-xs text-green-600">
                    <FileCheck className="h-3 w-3" />
                    {t('Auto-detected from skill.md')}
                  </p>
                )}
                {manifestStatus === 'not-found' && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileX className="h-3 w-3" />
                    {t('No skill.md found, please fill in manually')}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">{t('Skill Name')} *</Label>
                <Input
                  id="name"
                  placeholder={t('e.g. code-review, test-generator')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t('Alphanumeric, hyphens, and underscores only')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('Description')}</Label>
                <Textarea
                  id="description"
                  placeholder={t('Brief description of this skill')}
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
                  {mutation.isPending ? t('Creating...') : t('Create Skill')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
