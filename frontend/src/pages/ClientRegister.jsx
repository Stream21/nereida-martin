import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import GoldButton from '../components/ui/GoldButton'
import { fetchInvite, registerWithInvite } from '../utils/clientAuth'
import { useClientAuth } from '../hooks/useClientAuth'
import { isValidPhone } from '../utils/validation'

export default function ClientRegister() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { acceptSession, isAuthenticated, loading: authLoading } = useClientAuth()

  const [loadingInvite, setLoadingInvite] = useState(true)
  const [inviteError, setInviteError] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/reservar', { replace: true })
    }
  }, [authLoading, isAuthenticated, navigate])

  useEffect(() => {
    let cancelled = false
    setLoadingInvite(true)
    fetchInvite(token)
      .then((data) => {
        if (cancelled) return
        setName(data.invite.name || '')
        setEmail(data.invite.email || '')
        setPhone(data.invite.phone || '')
      })
      .catch((err) => {
        if (!cancelled) setInviteError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoadingInvite(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Introduce un email válido')
      return
    }
    if (!isValidPhone(phone)) {
      setError('Introduce un teléfono válido (mínimo 9 dígitos)')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== password2) {
      setError('Las contraseñas no coinciden')
      return
    }

    setSubmitting(true)
    try {
      const data = await registerWithInvite(token, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
      })
      acceptSession(data.token, data.user)
      navigate('/reservar', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingInvite || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (inviteError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="font-headline text-2xl text-on-surface">Invitación no válida</h1>
          <p className="text-on-surface-variant">{inviteError}</p>
          <Link to="/entrar" className="text-primary hover:underline text-sm">
            Ir a iniciar sesión
          </Link>
        </div>
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
          <h1 className="font-headline text-2xl text-on-surface mb-2">Crea tu acceso</h1>
          <p className="text-on-surface-variant text-sm">
            Completa tus datos. Podrás entrar con el email o el teléfono.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm text-on-surface-variant mb-1 block">Nombre</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className="w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-on-surface outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="text-sm text-on-surface-variant mb-1 block">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-on-surface outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="text-sm text-on-surface-variant mb-1 block">Teléfono</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="tel"
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
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-on-surface outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="text-sm text-on-surface-variant mb-1 block">Repetir contraseña</span>
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
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
            {submitting ? 'Creando cuenta…' : 'Crear cuenta y reservar'}
          </GoldButton>
        </form>
      </motion.div>
    </div>
  )
}
