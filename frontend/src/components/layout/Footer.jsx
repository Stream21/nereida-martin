import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import WhatsAppIcon from '../ui/WhatsAppIcon'
import PolicyModal from '../legal/PolicyModal'
import {
  PrivacyPolicyContent,
  LegalNoticeContent,
  BookingTermsContent,
  HealthConsentContent,
  PhotoConsentContent,
  CookiePolicyContent,
} from '../legal/LegalContent'

const PHONE = '641 61 36 14'
const WHATSAPP_URL = 'https://wa.me/34641613614'

export default function Footer() {
  const [activeModal, setActiveModal] = useState(null)

  const modals = {
    privacy: { title: 'Política de Privacidad', Content: PrivacyPolicyContent },
    cookies: { title: 'Política de Cookies', Content: CookiePolicyContent },
    legal: { title: 'Aviso Legal', Content: LegalNoticeContent },
    booking: { title: 'Condiciones de Reserva', Content: BookingTermsContent },
    health: { title: 'Consentimiento Datos de Salud', Content: HealthConsentContent },
    photo: { title: 'Consentimiento de Imagen', Content: PhotoConsentContent },
  }

  const modalConfig = activeModal ? modals[activeModal] : null

  return (
    <>
      <footer id="footer" className="bg-surface-container w-full py-12 px-8 border-t border-outline-variant/15">
        <div className="flex flex-col items-center space-y-8 max-w-7xl mx-auto text-center">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full max-w-2xl py-8">
            <div className="space-y-3">
              <h6 className="font-label text-xs tracking-widest font-bold text-primary uppercase">
                Contacto
              </h6>
              <a
                href={`tel:+34${PHONE.replace(/\s/g, '')}`}
                className="text-sm text-on-surface-variant hover:text-primary transition-colors block"
              >
                +34 {PHONE}
              </a>
              <button
                onClick={() => window.open(WHATSAPP_URL, '_blank')}
                className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:opacity-80 transition-opacity"
              >
                <WhatsAppIcon className="w-5 h-5" />
                WhatsApp
              </button>
            </div>
            <div className="space-y-3">
              <h6 className="font-label text-xs tracking-widest font-bold text-primary uppercase">
                Horario
              </h6>
              <p className="text-sm text-on-surface-variant">
                Lun–Jue: 10:00–14:00 y 15:00–18:00<br />
                Vie: 10:00–14:00 y 15:00–17:00<br />
                Sáb y Dom: cerrado
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[11px] tracking-wider uppercase text-on-surface-variant/70">
            <button onClick={() => setActiveModal('privacy')} className="hover:text-primary transition-colors">
              Privacidad
            </button>
            <span className="text-outline-variant/30 hidden sm:inline">|</span>
            <button onClick={() => setActiveModal('booking')} className="hover:text-primary transition-colors">
              Condiciones de Reserva
            </button>
            <span className="text-outline-variant/30 hidden sm:inline">|</span>
            <button onClick={() => setActiveModal('health')} className="hover:text-primary transition-colors">
              Datos de Salud
            </button>
            <span className="text-outline-variant/30 hidden sm:inline">|</span>
            <button onClick={() => setActiveModal('photo')} className="hover:text-primary transition-colors">
              Imagen
            </button>
            <span className="text-outline-variant/30 hidden sm:inline">|</span>
            <button onClick={() => setActiveModal('legal')} className="hover:text-primary transition-colors">
              Aviso Legal
            </button>
            <span className="text-outline-variant/30 hidden sm:inline">|</span>
            <button onClick={() => setActiveModal('cookies')} className="hover:text-primary transition-colors">
              Cookies
            </button>
          </div>

          <div className="pt-4 border-t border-outline-variant/20 w-full text-[10px] tracking-[0.2em] text-on-surface-variant/60 uppercase">
            &copy; 2026 Nereida Martín. Todos los derechos reservados.
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {modalConfig && (() => {
          const ModalContent = modalConfig.Content
          return (
            <PolicyModal title={modalConfig.title} onClose={() => setActiveModal(null)}>
              <ModalContent />
            </PolicyModal>
          )
        })()}
      </AnimatePresence>
    </>
  )
}
