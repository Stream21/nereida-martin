import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import GoldButton from '../components/ui/GoldButton'
import { requestPasswordReset } from '../utils/clientAuth'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const data = await requestPasswordReset(email)
      setSuccess(data.message)
      setEmail('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
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
          <h1 className="font-headline text-2xl text-on-surface mb-2">Recuperar contraseña</h1>
          <p className="text-on-surface-variant text-sm">
            Te enviaremos un enlace a tu email si existe una cuenta asociada.
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
              autoComplete="email"
              placeholder="tu@email.com"
              className="w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-on-surface outline-none focus:border-primary"
            />
          </label>

          {error && (
            <p className="text-sm text-error bg-error-container rounded-xl px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="text-sm text-on-surface bg-primary-container/40 rounded-xl px-3 py-2">
              {success}
            </p>
          )}

          <GoldButton
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl py-3.5 disabled:opacity-60"
          >
            {submitting ? 'Enviando…' : 'Enviar enlace'}
          </GoldButton>
        </form>

        <p className="mt-6 text-center">
          <Link to="/entrar" className="text-sm text-primary hover:underline">
            Volver a entrar
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
