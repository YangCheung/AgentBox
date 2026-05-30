import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/auth-context'
import { RootLayout } from '@/components/layout/root-layout'
import { LoginPage } from '@/pages/login'
import { DashboardPage } from '@/pages/dashboard'
import { ContainerListPage } from '@/pages/container-list'
import { CreateContainerPage } from '@/pages/container-create'
import { ContainerDetailPage } from '@/pages/container-detail'
import { SkillListPage } from '@/pages/skill-list'
import { SkillCreatePage } from '@/pages/skill-create'
import { SkillEditPage } from '@/pages/skill-edit'

function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <RootLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: '/containers', element: <ContainerListPage /> },
          { path: '/containers/new', element: <CreateContainerPage /> },
          { path: '/containers/:id', element: <ContainerDetailPage /> },
          { path: '/skills', element: <SkillListPage /> },
          { path: '/skills/new', element: <SkillCreatePage /> },
          { path: '/skills/:id/edit', element: <SkillEditPage /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
