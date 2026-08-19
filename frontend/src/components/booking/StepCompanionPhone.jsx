import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import Icon from '../ui/Icon'
import { isValidPhone } from '../../utils/validation'
import { getClientToken } from '../../utils/clientAuth'

const API_URL = import.meta.env.VITE_API_URL || ''

function authHeaders(extra = {}) {
  const token = getClientToken()
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export default function StepCompanionPhone({ companionInfo, onValidated, error: externalError }) {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const lookup = useCallback(async () => {
    const trimmed = phone.trim()
    if (!isValidPhone(trimmed)) {
      setError('Introduce un teléfono válido')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `${API_URL}/api/clients/lookup-companion?phone=${encodeURIComponent(trimmed)}`,
        { headers: authHeaders() }
      )
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || 'No encontramos una clienta con ese teléfono')
        return
      }

      onValidated({ ...data, phone: trimmed })
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [phone, onValidated])

  const displayError = externalError || error

  return (
    <div>
      <section className="mb-8 text-center">
        <h2 className="font-headline text-2xl md:text-3xl text-on-surface leading-tight">
          Teléfono de tu acompañante
        </h2>
        <p className="mt-3 text-sm text-on-surface-variant max-w-sm mx-auto">
          Debe tener cuenta activa en la web del estudio
        </p>
      </section>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <label className="block">
          <span className="text-[10px] font-label font-bold tracking-[0.15em] uppercase text-on-surface-variant">
            Teléfono móvil
          </span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              setError(null)
            }}
            placeholder="+34 600 000 000"
            className="mt-2 w-full rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-4 text-base text-on-surface outline-none focus:border-primary transition-colors"
            autoComplete="tel"
          />
        </label>

        {!companionInfo && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={lookup}
            disabled={loading || !phone.trim()}
            className="w-full coral-gradient text-white rounded-2xl py-4 font-label text-sm tracking-widest uppercase font-bold editorial-shadow disabled:opacity-40"
          >
            {loading ? 'Buscando…' : 'Validar acompañante'}
          </motion.button>
        )}

        {displayError && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
            <Icon name="error" className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{displayError}</p>
          </div>
        )}

        {companionInfo && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-primary/8 border border-primary/20 p-5"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Icon name="check_circle" className="text-primary text-lg" />
              </div>
              <div className="min-w-0">
                <p className="font-headline text-lg text-on-surface">{companionInfo.name}</p>
                <p className="text-sm text-on-surface-variant mt-1">
                  Tratamiento: {companionInfo.companionTreatmentName}
                  {companionInfo.companionPrice != null ? ` · ${companionInfo.companionPrice} €` : ''}
                </p>
                {companionInfo.primaryTreatmentName && companionInfo.primaryPrice != null && (
                  <p className="text-sm text-on-surface-variant mt-1">
                    Tu tratamiento: {companionInfo.primaryTreatmentName} · {companionInfo.primaryPrice} €
                  </p>
                )}
                {companionInfo.primaryPrice != null && companionInfo.companionPrice != null && (
                  <p className="text-sm font-bold text-primary mt-2">
                    Total conjunto: {companionInfo.primaryPrice + companionInfo.companionPrice} €
                  </p>
                )}
                <p className="text-xs text-on-surface-variant/80 mt-2">
                  Recibirá un email para confirmar su cita en un plazo de 24 horas
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
