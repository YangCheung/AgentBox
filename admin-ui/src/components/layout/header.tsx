import { Separator } from '@/components/ui/separator'

interface HeaderProps {
  title: string
  actions?: React.ReactNode
}

export function Header({ title, actions }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
      <Separator className="absolute bottom-0 left-0 right-0" />
    </header>
  )
}
