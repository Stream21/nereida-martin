import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import GoldButton from '../components/ui/GoldButton'
import { fetchResetPreview, resetPassword } from '../utils/clientAuth'

export default function ResetPassword() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchResetPreview(token)
      .then((data) => {
        if (!cancelled) setPreview(data.reset)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    setSubmitting(true)
    try {
      await resetPassword(token, password)
      navigate('/entrar', { replace: true, state: { passwordReset: true } })
    } catch (err) {
      setError(err.message)
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
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md bg-surface-container-lowest rounded-3xl p-8 shadow-[0_8px_32px_rgba(67,61,60,0.08)] border border-outline-variant/30"
      >
        <div className="text-center mb-8">
          <img src="/logo2.png" alt="Nereida Martín" className="h-14 w-auto mx-auto mb-4" />
          <h1 className="font-headline text-2xl text-on-surface mb-2">Nueva contraseña</h1>
          {preview ? (
            <p className="text-on-surface-variant text-sm">
              Hola {preview.name}, elige una contraseña nueva para tu cuenta.
            </p>
          ) : (
            <p className="text-on-surface-variant text-sm">Este enlace no es válido o ha caducado.</p>
          )}
        </div>

        {preview ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-sm text-on-surface-variant mb-1 block">Nueva contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-on-surface outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="text-sm text-on-surface-variant mb-1 block">Repetir contraseña</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
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
              {submitting ? 'Guardando…' : 'Guardar contraseña'}
            </GoldButton>
          </form>
        ) : (
          error && (
            <p className="text-sm text-error bg-error-container rounded-xl px-3 py-2 mb-4">{error}</p>
          )
        )}

        <p className="mt-6 text-center">
          <Link to="/entrar" className="text-sm text-primary hover:underline">
            Volver a entrar
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
