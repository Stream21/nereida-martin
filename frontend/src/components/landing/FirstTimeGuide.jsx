import { motion } from 'framer-motion'
import useScrollReveal from '../../hooks/useScrollReveal'
import Icon from '../ui/Icon'
import GoldButton from '../ui/GoldButton'

const WHATSAPP_URL = 'https://wa.me/34600000000'

const recommendations = [
  {
    need: 'Si quieres mejorar la forma de tus cejas',
    treatment: 'Brow Design',
    detail: 'Perfilado de cejas con visagismo',
    description: 'Es la mejor opción para empezar. Analizo tu rostro y trabajo tu ceja respetando tu forma natural.',
    icon: 'auto_fix_high',
  },
  {
    need: 'Si además quieres más intensidad o rellenar huecos',
    treatment: 'Brow Define o Brow Henna',
    detail: 'Diseño + perfilado + tinte/henna',
    description: 'Perfecto si tienes zonas despobladas o quieres un efecto más marcado.',
    icon: 'palette',
  },
  {
    need: 'Si tus cejas son rebeldes o sin forma',
    treatment: 'Brow Lami',
    detail: 'Laminado de cejas + perfilado + diseño',
    description: 'Ayuda a peinar, fijar y dar forma a la ceja.',
    icon: 'straighten',
  },
  {
    need: 'Si quieres un efecto más completo',
    treatment: 'Brow Lami Define',
    detail: 'Laminado + tinte + perfilado y diseño',
    description: 'Es el resultado más definido y duradero.',
    icon: 'star',
  },
  {
    need: 'Si sientes tu piel apagada o necesitas limpieza',
    treatment: 'Skin Reset',
    detail: 'Limpieza facial coreana',
    description: 'Ideal para empezar a cuidar tu piel desde cero.',
    icon: 'spa',
  },
  {
    need: 'Si quieres un efecto glow inmediato',
    treatment: 'Ritual Glow',
    detail: 'Tratamiento facial avanzado',
    description: 'Perfecto antes de eventos o para verte mejor desde la primera sesión.',
    icon: 'light_mode',
  },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

export default function FirstTimeGuide() {
  const { ref, isInView, prefersReducedMotion } = useScrollReveal()

  return (
    <section id="first-time" className="py-24 px-6 bg-surface-container overflow-hidden">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-14"
        >
          <span className="font-label text-xs tracking-[0.3em] uppercase text-primary font-bold mb-4 block">
            Te ayudo a elegir
          </span>
          <h2 className="font-headline text-4xl md:text-5xl text-on-surface mb-4">
            ¿Es tu <span className="italic">primera vez</span>?
          </h2>
          <p className="font-body text-on-surface-variant max-w-lg mx-auto">
            Si es tu primera vez, es normal no saber qué tratamiento elegir. Aquí te ayudo:
          </p>
        </motion.div>

        <motion.div
          ref={ref}
          variants={prefersReducedMotion ? {} : containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="grid md:grid-cols-2 gap-4"
        >
          {recommendations.map((rec) => (
            <motion.div
              key={rec.treatment}
              variants={prefersReducedMotion ? {} : cardVariants}
              className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10 hover:border-primary/20 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon name={rec.icon} className="text-primary text-sm" />
                </div>
                <div>
                  <p className="text-sm text-on-surface-variant mb-2">{rec.need}</p>
                  <h4 className="font-headline font-bold text-on-surface mb-1">{rec.treatment}</h4>
                  <p className="text-xs text-primary font-label font-bold mb-2">{rec.detail}</p>
                  <p className="text-sm text-on-surface-variant">{rec.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="text-center mt-12 space-y-4"
        >
          <p className="text-on-surface-variant">
            Si tienes dudas, puedes escribirme y te recomiendo el tratamiento ideal para ti
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <GoldButton
              onClick={() => window.open(WHATSAPP_URL, '_blank')}
              className="px-8 py-4 rounded-2xl text-sm"
            >
              Escríbeme por WhatsApp
            </GoldButton>
            <button
              onClick={() => window.open(WHATSAPP_URL, '_blank')}
              className="text-sm font-label font-bold text-primary hover:underline underline-offset-4"
            >
              Pedir cita de valoración (30 min)
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
