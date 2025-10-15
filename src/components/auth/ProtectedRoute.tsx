/**
 * ProtectedRoute Component
 *
 * Route guard that redirects to login if user is not authenticated.
 * Wraps protected pages and checks authentication state.
 */

import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks'

export function ProtectedRoute() {
  const { user, loading } = useAuth()

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Render child routes
  return <Outlet />
}
