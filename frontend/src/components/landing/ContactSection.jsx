import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import useScrollReveal from '../../hooks/useScrollReveal'
import Icon from '../ui/Icon'
import WhatsAppIcon from '../ui/WhatsAppIcon'
import GoldButton from '../ui/GoldButton'

const PHONE = '650 86 38 42'
const WHATSAPP_URL = 'https://wa.me/34650863842'

const contactInfo = [
  {
    icon: 'location_on',
    title: 'Ubicación',
    lines: ['Dirección del estudio', '(Por confirmar)'],
  },
  {
    icon: 'schedule',
    title: 'Horario',
    lines: ['Lun - Vie: 10:00 - 20:00', 'Sáb: 10:00 - 14:00'],
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp',
    lines: [`+34 ${PHONE}`],
    action: WHATSAPP_URL,
  },
]

function RevealBlock({ children, delay = 0 }) {
  const { ref, isInView, variants } = useScrollReveal()
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={variants}
      transition={{ duration: 0.7, ease: 'easeOut', delay }}
      className="will-change-transform"
    >
      {children}
    </motion.div>
  )
}

export default function ContactSection() {
  const navigate = useNavigate()

  return (
    <section id="contact" className="py-24 px-6 bg-surface-container-low overflow-hidden">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-14"
        >
          <span className="font-label text-xs tracking-[0.3em] uppercase text-primary font-bold mb-4 block">
            Contacto
          </span>
          <h2 className="font-headline text-4xl md:text-5xl text-on-surface">
            Encuéntrame
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {contactInfo.map((info, i) => (
            <RevealBlock key={info.title} delay={i * 0.1}>
              <div
                className={`bg-surface-container-lowest rounded-2xl p-8 text-center border border-outline-variant/10 ${
                  info.action ? 'cursor-pointer hover:border-primary/20 transition-colors' : ''
                }`}
                onClick={info.action ? () => window.open(info.action, '_blank') : undefined}
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  {info.id === 'whatsapp' ? (
                    <WhatsAppIcon className="w-6 h-6 text-primary" />
                  ) : (
                    <Icon name={info.icon} className="text-primary" />
                  )}
                </div>
                <h4 className="font-headline font-bold text-on-surface mb-3">{info.title}</h4>
                {info.lines.map((line) => (
                  <p key={line} className="text-sm text-on-surface-variant">{line}</p>
                ))}
                {info.action && (
                  <p className="text-sm font-bold text-primary mt-3">Escríbeme &rarr;</p>
                )}
              </div>
            </RevealBlock>
          ))}
        </div>

        {/* Maintenance reminder — navigates to wizard */}
        <RevealBlock delay={0.3}>
          <div className="bg-primary/5 rounded-3xl p-8 md:p-10 border border-primary/10 text-center">
            <Icon name="notifications_active" className="text-primary text-3xl mb-4" />
            <h3 className="font-headline text-xl text-on-surface mb-2">
              ¿Te han gustado tus cejas?
            </h3>
            <p className="text-on-surface-variant mb-6 max-w-md mx-auto">
              Reserva tu mantenimiento para mantener el resultado siempre perfecto.
            </p>
            <GoldButton
              onClick={() => navigate('/reservar')}
              className="px-8 py-3 rounded-2xl text-sm"
            >
              Reservar mantenimiento
            </GoldButton>
          </div>
        </RevealBlock>
      </div>
    </section>
  )
}
