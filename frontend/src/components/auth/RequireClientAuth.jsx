import { Navigate, useLocation } from 'react-router-dom'
import { useClientAuth } from '../../hooks/useClientAuth'

export default function RequireClientAuth({ children }) {
  const { loading, isAuthenticated } = useClientAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    const next = `${location.pathname}${location.search || ''}`
    return <Navigate to={`/entrar?next=${encodeURIComponent(next)}`} replace />
  }

  return children
}
