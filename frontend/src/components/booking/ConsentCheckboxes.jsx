import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import PolicyModal from '../legal/PolicyModal'
import {
  PrivacyPolicyContent,
  BookingTermsContent,
  HealthConsentContent,
  PhotoConsentContent,
} from '../legal/LegalContent'

const MODALS = {
  privacy: { title: 'Política de Privacidad', Content: PrivacyPolicyContent },
  booking_terms: { title: 'Condiciones de Reserva', Content: BookingTermsContent },
  health_data: { title: 'Consentimiento Datos de Salud', Content: HealthConsentContent },
  photo_consent: { title: 'Consentimiento de Imagen', Content: PhotoConsentContent },
}

export default function ConsentCheckboxes({
  consents,
  onChange,
  showHealth = false,
  showPhoto = false,
  error,
}) {
  const [openModal, setOpenModal] = useState(null)

  const toggle = (key) => {
    const next = consents.includes(key)
      ? consents.filter((c) => c !== key)
      : [...consents, key]
    onChange(next)
  }

  const items = [
    {
      key: 'privacy',
      label: 'He leído y acepto la',
      link: 'Política de Privacidad',
      required: true,
    },
    {
      key: 'booking_terms',
      label: 'Acepto las',
      link: 'Condiciones de Reserva y Cancelación',
      required: true,
    },
    ...(showHealth
      ? [{
          key: 'health_data',
          label: 'Autorizo el tratamiento de',
          link: 'datos de salud del cuestionario',
          required: true,
        }]
      : []),
    ...(showPhoto
      ? [{
          key: 'photo_consent',
          label: 'Autorizo la',
          link: 'cesión de imagen para valoración Henna',
          required: true,
        }]
      : []),
  ]

  const modalConfig = openModal ? MODALS[openModal] : null

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <label
          key={item.key}
          className="flex items-start gap-3 cursor-pointer group"
        >
          <input
            type="checkbox"
            checked={consents.includes(item.key)}
            onChange={() => toggle(item.key)}
            className="mt-1 w-4 h-4 rounded border-outline-variant/30 text-primary focus:ring-primary/30"
          />
          <span className="text-xs text-on-surface-variant leading-relaxed">
            {item.label}{' '}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                setOpenModal(item.key)
              }}
              className="text-primary underline underline-offset-2 font-medium"
            >
              {item.link}
            </button>
            {item.required && <span className="text-primary"> *</span>}
          </span>
        </label>
      ))}

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      <AnimatePresence>
        {modalConfig && (() => {
          const ModalContent = modalConfig.Content
          return (
            <PolicyModal title={modalConfig.title} onClose={() => setOpenModal(null)}>
              <ModalContent />
            </PolicyModal>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}
