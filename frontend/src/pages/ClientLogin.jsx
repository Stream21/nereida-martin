import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import GoldButton from '../components/ui/GoldButton'
import { useClientAuth } from '../hooks/useClientAuth'

export default function ClientLogin() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { loading, isAuthenticated, login } = useClientAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const nextPath = searchParams.get('next') || '/reservar'

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate(nextPath.startsWith('/') ? nextPath : '/reservar', { replace: true })
    }
  }, [loading, isAuthenticated, navigate, nextPath])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(identifier, password)
      navigate(nextPath.startsWith('/') ? nextPath : '/reservar', { replace: true })
    } catch (err) {
      setError(err.message === 'UNAUTHORIZED' ? 'Sesión no válida' : err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_30%,rgba(255,138,138,0.12),transparent_70%)]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md bg-surface-container-lowest rounded-3xl p-8 shadow-[0_8px_32px_rgba(67,61,60,0.08)] border border-outline-variant/30"
      >
        <div className="text-center mb-8">
          <img src="/logo2.png" alt="Nereida Martín" className="h-14 w-auto mx-auto mb-4" />
          <h1 className="font-headline text-2xl text-on-surface mb-2">Acceso clientas</h1>
          <p className="text-on-surface-variant text-sm">
            Entra con tu email o teléfono y tu contraseña para reservar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm text-on-surface-variant mb-1 block">Email o teléfono</span>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
              placeholder="tu@email.com o 600 00 00 00"
              className="w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-on-surface outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="text-sm text-on-surface-variant mb-1 block">Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-on-surface outline-none focus:border-primary"
            />
          </label>

          {error && (
            <p className="text-sm text-error bg-error-container rounded-xl px-3 py-2">{error}</p>
          )}

          <GoldButton
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl py-3.5 disabled:opacity-60"
          >
            {submitting ? 'Entrando…' : 'Entrar'}
          </GoldButton>
        </form>

        <p className="mt-6 text-center text-sm text-on-surface-variant">
          ¿Todavía no tienes acceso?{' '}
          <span className="text-on-surface">Pide tu enlace de invitación al estudio.</span>
        </p>
        <p className="mt-3 text-center">
          <Link to="/" className="text-sm text-primary hover:underline">
            Volver al inicio
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
