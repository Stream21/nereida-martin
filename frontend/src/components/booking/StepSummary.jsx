import { useState } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Icon from '../ui/Icon'

export default function StepSummary({ treatment, date, time, onConfirm, isSubmitting }) {
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [errors, setErrors] = useState({})

  if (!treatment || !date || !time) return null

  const dateLabel = format(date, "EEEE, d 'de' MMMM", { locale: es })

  const validate = () => {
    const newErrors = {}
    if (!clientName.trim() || clientName.trim().length < 2) {
      newErrors.name = 'El nombre es obligatorio'
    }
    if (!clientEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      newErrors.email = 'Introduce un email válido'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validate() || isSubmitting) return
    onConfirm({
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim().toLowerCase(),
      clientPhone: clientPhone.trim() || null,
    })
  }

  return (
    <div>
      <div className="mb-10 text-center">
        <h2 className="font-headline text-2xl md:text-3xl text-on-surface leading-tight">
          Resumen de tu Cita
        </h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          Revisa los datos antes de confirmar
        </p>
      </div>

      <div className="space-y-4">
        {/* Treatment */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Icon name="auto_awesome" className="text-primary text-lg" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-label font-bold tracking-[0.15em] uppercase text-on-surface-variant mb-1">
                Tratamiento
              </p>
              <h3 className="font-headline text-lg text-on-surface">{treatment.name}</h3>
              <p className="text-sm text-on-surface-variant mt-0.5">{treatment.tag}</p>
              <div className="flex items-center gap-1.5 mt-2">
                <Icon name="schedule" className="text-xs text-primary/70" />
                <span className="text-xs text-on-surface-variant font-medium">{treatment.duration}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Date & Time */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Icon name="calendar_today" className="text-primary text-lg" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-label font-bold tracking-[0.15em] uppercase text-on-surface-variant mb-1">
                Fecha y hora
              </p>
              <p className="font-headline text-lg text-on-surface capitalize">{dateLabel}</p>
              <p className="text-sm text-on-surface-variant mt-0.5">{time}h</p>
            </div>
          </div>
        </motion.div>

        {/* Client Info Form */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Icon name="person" className="text-primary text-lg" />
            </div>
            <p className="text-[10px] font-label font-bold tracking-[0.15em] uppercase text-on-surface-variant">
              Tus datos
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                Nombre *
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => {
                  setClientName(e.target.value)
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }))
                }}
                placeholder="Tu nombre completo"
                className={`w-full px-4 py-3 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline-variant/50 text-sm outline-none transition-all focus:ring-2 ${
                  errors.name ? 'ring-2 ring-red-400/50' : 'focus:ring-primary/30'
                }`}
              />
              {errors.name && (
                <p className="text-xs text-red-400 mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                Email *
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => {
                  setClientEmail(e.target.value)
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
                }}
                placeholder="tu@email.com"
                className={`w-full px-4 py-3 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline-variant/50 text-sm outline-none transition-all focus:ring-2 ${
                  errors.email ? 'ring-2 ring-red-400/50' : 'focus:ring-primary/30'
                }`}
              />
              {errors.email && (
                <p className="text-xs text-red-400 mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                Teléfono <span className="text-outline-variant/50">(opcional)</span>
              </label>
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+34 600 000 000"
                className="w-full px-4 py-3 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline-variant/50 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </motion.div>

        {/* Info notice */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="bg-primary/5 rounded-2xl p-5 border border-primary/10"
        >
          <div className="flex items-start gap-3">
            <Icon name="info" className="text-primary shrink-0 mt-0.5 text-lg" />
            <div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Recibirás un email de confirmación con un enlace para cancelar y un recordatorio 6 horas antes de tu cita.
                Puedes cancelar hasta el día anterior a tu cita, a la misma hora. Ejemplo: cita el sábado a las 16:00 → cancelación hasta el viernes a las 16:00.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="mt-8"
      >
        <motion.button
          whileTap={isSubmitting ? {} : { scale: 0.98 }}
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`w-full coral-gradient text-white py-4 rounded-2xl font-label text-sm tracking-widest uppercase font-bold editorial-shadow flex items-center justify-center gap-2 ${
            isSubmitting ? 'opacity-60 cursor-not-allowed' : ''
          }`}
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              <span>Reservando...</span>
            </>
          ) : (
            <span>Confirmar Reserva</span>
          )}
        </motion.button>
      </motion.div>
    </div>
  )
}
