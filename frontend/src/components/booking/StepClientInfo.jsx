import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import Icon from '../ui/Icon'
import ConsentCheckboxes from './ConsentCheckboxes'
import { loadClientProfile } from '../../utils/clientSession'
import { useAutofillSync } from '../../hooks/useAutofillSync'

const fieldVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.1 + i * 0.08, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

export default function StepClientInfo({
  clientInfo,
  onChange,
  consents,
  onConsentsChange,
  onLookup,
  lookupData,
  isLookingUp,
  showConsents,
  consentError,
}) {
  const [lookupHint, setLookupHint] = useState(null)
  const emailRef = useRef(null)
  const nameRef = useRef(null)
  const phoneRef = useRef(null)

  const syncAutofill = useCallback((dom) => {
    onChange({
      email: dom.email || clientInfo.email,
      name: dom.name || clientInfo.name,
      phone: dom.phone || clientInfo.phone,
    })
  }, [clientInfo, onChange])

  useAutofillSync({
    fields: { email: emailRef, name: nameRef, phone: phoneRef },
    onSync: syncAutofill,
    onEmailReady: onLookup,
  })

  useEffect(() => {
    const saved = loadClientProfile()
    if (saved && !clientInfo.email) {
      onChange({
        name: saved.name || '',
        email: saved.email || '',
        phone: saved.phone || '',
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!lookupData) {
      setLookupHint(null)
      return
    }

    if (lookupData.hasAllBaseConsents && lookupData.acceptedConsents?.length) {
      onConsentsChange(lookupData.acceptedConsents)
    }

    if (lookupData.isKnownClient || lookupData.visitCount > 0) {
      setLookupHint('¡Hola de nuevo! Hemos rellenado tus datos.')
      if (lookupData.client) {
        onChange({
          ...clientInfo,
          name: lookupData.client.name || clientInfo.name,
          phone: lookupData.client.phone || clientInfo.phone,
        })
      }
    } else if (lookupData.client) {
      setLookupHint('Hemos encontrado tu email. Revisa tus datos si hace falta.')
      if (lookupData.client) {
        onChange({
          ...clientInfo,
          name: lookupData.client.name || clientInfo.name,
          phone: lookupData.client.phone || clientInfo.phone,
        })
      }
    } else {
      setLookupHint(null)
    }
  }, [lookupData]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (field) => (e) => {
    onChange({ ...clientInfo, [field]: e.target.value })
  }

  const handleInput = () => {
    const email = emailRef.current?.value?.trim() || ''
    const name = nameRef.current?.value?.trim() || ''
    const phone = phoneRef.current?.value?.trim() || ''
    if (email !== clientInfo.email || name !== clientInfo.name || phone !== clientInfo.phone) {
      onChange({ email, name, phone })
    }
  }

  const handleEmailBlur = useCallback(() => {
    const email = (emailRef.current?.value || clientInfo.email)?.trim()
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (email !== clientInfo.email) {
        onChange({ ...clientInfo, email })
      }
      onLookup(email)
    }
  }, [clientInfo, onChange, onLookup])

  return (
    <div>
      <section className="mb-8 text-center">
        <span className="font-label text-[10px] tracking-[0.2em] uppercase text-primary font-bold block mb-2">
          Paso 1
        </span>
        <h2 className="font-headline text-3xl md:text-4xl text-on-surface">Identificación</h2>
        <p className="mt-3 text-sm text-on-surface-variant max-w-xs mx-auto">
          Tus datos de contacto para gestionar la reserva
        </p>
      </section>

      <div className="space-y-5" autoComplete="on">
        <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
          <label className="block mb-2">
            <span className="text-[10px] font-label font-bold tracking-[0.15em] uppercase text-on-surface-variant">
              Correo electrónico *
            </span>
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <Icon name="mail" className="text-primary/60 text-lg" />
            </div>
            <input
              ref={emailRef}
              type="email"
              name="email"
              value={clientInfo.email}
              onChange={handleChange('email')}
              onInput={handleInput}
              onBlur={handleEmailBlur}
              placeholder="tu@email.com"
              autoComplete="email"
              required
              className="w-full pl-12 pr-5 py-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 text-on-surface placeholder:text-outline-variant/50 font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
            />
            {isLookingUp && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            )}
          </div>
          {lookupHint && (
            <p className="mt-2 text-xs text-primary font-medium">{lookupHint}</p>
          )}
        </motion.div>

        <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
          <label className="block mb-2">
            <span className="text-[10px] font-label font-bold tracking-[0.15em] uppercase text-on-surface-variant">
              Nombre completo *
            </span>
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <Icon name="person" className="text-primary/60 text-lg" />
            </div>
            <input
              ref={nameRef}
              type="text"
              name="name"
              value={clientInfo.name}
              onChange={handleChange('name')}
              onInput={handleInput}
              placeholder="Tu nombre y apellidos"
              autoComplete="name"
              required
              className="w-full pl-12 pr-5 py-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 text-on-surface placeholder:text-outline-variant/50 font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
            />
          </div>
        </motion.div>

        <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible">
          <label className="block mb-2">
            <span className="text-[10px] font-label font-bold tracking-[0.15em] uppercase text-on-surface-variant">
              Teléfono *
            </span>
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <Icon name="phone" className="text-primary/60 text-lg" />
            </div>
            <input
              ref={phoneRef}
              type="tel"
              name="phone"
              value={clientInfo.phone}
              onChange={handleChange('phone')}
              onInput={handleInput}
              placeholder="Ej: 612 345 678"
              autoComplete="tel"
              required
              className="w-full pl-12 pr-5 py-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 text-on-surface placeholder:text-outline-variant/50 font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
            />
          </div>
        </motion.div>

        {showConsents && (
          <motion.div
            custom={3}
            variants={fieldVariants}
            initial="hidden"
            animate="visible"
            className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10"
          >
            <p className="text-[10px] font-label font-bold tracking-[0.15em] uppercase text-on-surface-variant mb-4">
              Consentimientos
            </p>
            <ConsentCheckboxes
              consents={consents}
              onChange={onConsentsChange}
              showHealth={false}
              showPhoto={false}
              error={consentError}
            />
          </motion.div>
        )}

        {!showConsents && lookupData?.hasAllBaseConsents && (
          <motion.div
            custom={3}
            variants={fieldVariants}
            initial="hidden"
            animate="visible"
            className="bg-primary/5 rounded-2xl p-4 border border-primary/10 flex items-start gap-3"
          >
            <Icon name="verified" className="text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Ya tenemos tus consentimientos registrados. No necesitas volver a aceptarlos.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
