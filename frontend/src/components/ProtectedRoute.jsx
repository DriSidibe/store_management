import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-4">Chargement...</div>
  if (!user) return <Navigate to="/vitrine" replace />
  return <Outlet />
}

export function StaffRoute() {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-4">Chargement...</div>
  if (!user) return <Navigate to="/vitrine" replace />
  if (!user.is_staff) return <Navigate to="/" replace />
  return <Outlet />
}

export function SuperuserRoute() {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-4">Chargement...</div>
  if (!user) return <Navigate to="/vitrine" replace />
  if (!user.is_superuser) return <Navigate to="/" replace />
  return <Outlet />
}
