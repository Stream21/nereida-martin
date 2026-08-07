import { motion } from 'framer-motion'
import Icon from '../ui/Icon'

export default function StepTreatmentConfirm({ treatment, onConfirm }) {
  return (
    <div>
      <section className="mb-8 text-center">
        <h2 className="font-headline text-2xl md:text-3xl text-on-surface leading-tight">
          ¿Primera vez con este tratamiento?
        </h2>
        <p className="mt-3 text-sm text-on-surface-variant max-w-sm mx-auto">
          Nos ayuda a preparar tu cita en el estudio
        </p>
      </section>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10 mb-6 text-center"
      >
        <p className="font-headline text-lg text-on-surface">{treatment.name}</p>
        <p className="text-sm text-on-surface-variant mt-1">{treatment.tag}</p>
      </motion.div>

      <div className="grid grid-cols-1 gap-3">
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => onConfirm(true)}
          className="flex items-center gap-3 p-5 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest hover:border-primary/30 text-left transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon name="spa" className="text-lg" />
          </div>
          <div>
            <p className="text-sm font-semibold text-on-surface">Sí, es mi primera vez</p>
            <p className="text-xs text-on-surface-variant mt-0.5">Responderé un breve cuestionario de aptitud</p>
          </div>
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => onConfirm(false)}
          className="flex items-center gap-3 p-5 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest hover:border-primary/30 text-left transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon name="history" className="text-lg" />
          </div>
          <div>
            <p className="text-sm font-semibold text-on-surface">No, ya lo he hecho antes</p>
            <p className="text-xs text-on-surface-variant mt-0.5">Continuar directamente a fecha y hora</p>
          </div>
        </motion.button>
      </div>
    </div>
  )
}
