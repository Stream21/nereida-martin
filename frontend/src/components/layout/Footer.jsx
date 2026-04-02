import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import WhatsAppIcon from '../ui/WhatsAppIcon'

const PHONE = '650 86 38 42'
const WHATSAPP_URL = 'https://wa.me/34650863842'

export default function Footer() {
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showCookies, setShowCookies] = useState(false)

  return (
    <>
      <footer id="footer" className="bg-surface-container w-full py-12 px-8 border-t border-outline-variant/15">
        <div className="flex flex-col items-center space-y-8 max-w-7xl mx-auto text-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 w-full max-w-4xl py-8">
            <div className="space-y-3">
              <h6 className="font-label text-xs tracking-widest font-bold text-primary uppercase">
                Ubicación
              </h6>
              <p className="text-sm text-on-surface-variant">
                Dirección del estudio<br />
                (Por confirmar)
              </p>
            </div>
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
                Lun - Vie: 10:00 - 20:00<br />
                Sáb: 10:00 - 14:00
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-4 text-[11px] tracking-wider uppercase text-on-surface-variant/70">
            <button
              onClick={() => setShowPrivacy(true)}
              className="hover:text-primary transition-colors"
            >
              Política de Privacidad
            </button>
            <span className="text-outline-variant/30">|</span>
            <button
              onClick={() => setShowCookies(true)}
              className="hover:text-primary transition-colors"
            >
              Política de Cookies
            </button>
            <span className="text-outline-variant/30">|</span>
            <span>Aviso Legal</span>
          </div>

          <div className="pt-4 border-t border-outline-variant/20 w-full text-[10px] tracking-[0.2em] text-on-surface-variant/60 uppercase">
            &copy; 2026 Nereida Martín. Todos los derechos reservados.
          </div>
        </div>
      </footer>

      {/* Privacy Policy Modal */}
      <AnimatePresence>
        {showPrivacy && (
          <PolicyModal title="Política de Privacidad" onClose={() => setShowPrivacy(false)}>
            <p>En cumplimiento del Reglamento General de Protección de Datos (RGPD) y la Ley Orgánica de Protección de Datos y Garantía de los Derechos Digitales (LOPDGDD), te informamos de lo siguiente:</p>
            <h4>Responsable del tratamiento</h4>
            <p>Nereida Martín — Studio Anuelblingding<br />Teléfono: +34 {PHONE}<br />Contacto: vía WhatsApp</p>
            <h4>Finalidad del tratamiento</h4>
            <p>Los datos personales proporcionados se utilizarán exclusivamente para la gestión de citas, comunicación con clientes y envío de información relacionada con los servicios ofrecidos.</p>
            <h4>Legitimación</h4>
            <p>El tratamiento se basa en el consentimiento del interesado y/o la ejecución de un contrato de prestación de servicios.</p>
            <h4>Conservación de datos</h4>
            <p>Los datos se conservarán mientras exista una relación comercial y durante los plazos legalmente establecidos.</p>
            <h4>Derechos del usuario</h4>
            <p>Puedes ejercer tus derechos de acceso, rectificación, supresión, portabilidad, limitación y oposición contactándonos por WhatsApp o teléfono.</p>
            <h4>Destinatarios</h4>
            <p>No se cederán datos a terceros salvo obligación legal.</p>
          </PolicyModal>
        )}
      </AnimatePresence>

      {/* Cookie Policy Modal */}
      <AnimatePresence>
        {showCookies && (
          <PolicyModal title="Política de Cookies" onClose={() => setShowCookies(false)}>
            <h4>¿Qué son las cookies?</h4>
            <p>Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo al visitar un sitio web. Permiten recordar preferencias y mejorar la experiencia de navegación.</p>
            <h4>Cookies que utilizamos</h4>
            <p><strong>Cookies técnicas (necesarias):</strong> Permiten la navegación y el uso de funciones básicas del sitio. No requieren consentimiento.</p>
            <p><strong>Cookies analíticas:</strong> Nos ayudan a entender cómo se usa el sitio para mejorar nuestros servicios. Solo se activan con tu consentimiento.</p>
            <h4>¿Cómo gestionar las cookies?</h4>
            <p>Puedes configurar tu navegador para bloquear o eliminar cookies. Ten en cuenta que desactivar las cookies técnicas puede afectar al funcionamiento del sitio.</p>
            <h4>Más información</h4>
            <p>Para cualquier consulta relacionada con nuestra política de cookies, puedes contactarnos por WhatsApp al +34 {PHONE}.</p>
          </PolicyModal>
        )}
      </AnimatePresence>
    </>
  )
}

function PolicyModal({ title, onClose, children }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="bg-background rounded-3xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-headline text-xl text-on-surface">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
        <div className="prose-policy space-y-3 text-sm text-on-surface-variant leading-relaxed [&>h4]:font-headline [&>h4]:text-base [&>h4]:font-bold [&>h4]:text-on-surface [&>h4]:mt-5 [&>h4]:mb-2">
          {children}
        </div>
      </motion.div>
    </motion.div>
  )
}
