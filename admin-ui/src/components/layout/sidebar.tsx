import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Container, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/auth-context'
import { Button } from '@/components/ui/button'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/containers', label: 'Containers', icon: Container },
]

export function Sidebar() {
  const { logout, apiKey } = useAuth()

  return (
    <aside className="flex h-full w-56 flex-col border-r bg-sidebar-background">
      <div className="flex h-14 items-center border-b px-4">
        <h1 className="text-lg font-bold text-sidebar-accent-foreground">AgentBox</h1>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
              )
            }
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </NavLink>
        ))}
      </nav>
      {apiKey && (
        <div className="border-t p-2">
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </Button>
        </div>
      )}
    </aside>
  )
}
