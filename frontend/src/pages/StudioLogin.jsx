import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import GoldButton from '../components/ui/GoldButton'
import StudioLogo from '../components/studio/StudioLogo'
import { useOwnerAuth } from '../hooks/useOwnerAuth'

export default function StudioLogin() {
  const navigate = useNavigate()
  const { user, loading, login, isAuthenticated } = useOwnerAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/studio/panel', { replace: true })
    }
  }, [loading, isAuthenticated, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/studio/panel', { replace: true })
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_30%,rgba(183,139,125,0.1),transparent_70%)]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md bg-surface-container-lowest rounded-3xl p-8 shadow-[0_8px_32px_rgba(28,25,23,0.08)] border border-outline-variant/30"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <StudioLogo variant="login" className="mb-5" />
          <p className="text-on-surface-variant text-sm">
            Acceso exclusivo para gestión del estudio.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm text-on-surface-variant mb-1 block">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
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
      </motion.div>
    </div>
  )
}
