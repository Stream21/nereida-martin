import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import useScrollReveal from '../../hooks/useScrollReveal'
import Icon from '../ui/Icon'
import GoldButton from '../ui/GoldButton'

const badges = [
  { icon: 'person', text: 'Atención personalizada' },
  { icon: 'bolt', text: 'Respuesta rápida' },
  { icon: 'handshake', text: 'Asesoría gratuita' },
]

export default function BookingCTA() {
  const { ref, isInView, prefersReducedMotion } = useScrollReveal()
  const navigate = useNavigate()

  return (
    <section id="booking-cta" className="py-24 px-6">
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.97 }}
        animate={isInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="max-w-5xl mx-auto rounded-3xl overflow-hidden editorial-shadow relative"
      >
        <div className="grid md:grid-cols-2">
          {/* Image side */}
          <div className="relative h-64 md:h-auto">
            <img
              src="/nereida-casual.jpeg"
              alt="Nereida Martín"
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-t md:bg-linear-to-r from-surface-container-highest/90 via-surface-container-highest/40 to-transparent md:from-transparent md:via-transparent md:to-surface-container-highest/90" />
          </div>

          {/* Content side */}
          <div className="bg-surface-container-highest p-10 md:p-14 flex flex-col justify-center relative">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />

            <h2 className="font-headline text-3xl md:text-4xl mb-4 text-on-surface relative z-10">
              ¿Lista para <span className="italic text-primary">brillar</span>?
            </h2>
            <p className="font-body text-on-surface-variant mb-8 text-base relative z-10">
              Reserva tu cita y te ayudo a elegir el tratamiento perfecto para ti.
            </p>

            <div className="relative z-10 mb-10">
              <GoldButton
                onClick={() => navigate('/reservar')}
                className="px-10 py-5 rounded-2xl text-sm"
              >
                Reservar Cita
              </GoldButton>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-outline-variant/20 relative z-10">
              {badges.map((b) => (
                <div key={b.text} className="flex flex-col items-center gap-2 text-center">
                  <Icon name={b.icon} className="text-primary" />
                  <span className="text-[10px] font-label font-bold tracking-wider uppercase text-on-surface">
                    {b.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
