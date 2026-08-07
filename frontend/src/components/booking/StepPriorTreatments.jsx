import { useMemo } from 'react'
import { motion } from 'framer-motion'
import Icon from '../ui/Icon'
import { buildPriorTreatmentOptions } from '../../utils/browDesign'

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.05 + i * 0.04, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

export default function StepPriorTreatments({
  treatments,
  studioHabitual,
  onStudioHabitualChange,
  selectedIds,
  onSelectedIdsChange,
  error,
}) {
  const options = useMemo(() => buildPriorTreatmentOptions(treatments), [treatments])

  const toggleId = (id) => {
    if (selectedIds.includes(id)) {
      onSelectedIdsChange(selectedIds.filter((x) => x !== id))
    } else {
      onSelectedIdsChange([...selectedIds, id])
    }
  }

  return (
    <div>
      <section className="mb-8 text-center">
        <span className="font-label text-[10px] tracking-[0.2em] uppercase text-primary font-bold block mb-2">
          Tu historial
        </span>
        <h2 className="font-headline text-2xl md:text-3xl text-on-surface leading-tight">
          ¿Has visitado el estudio antes?
        </h2>
        <p className="mt-3 text-sm text-on-surface-variant max-w-sm mx-auto">
          Así te mostramos solo los tratamientos que te corresponden
        </p>
      </section>

      <div className="grid grid-cols-1 gap-3 mb-8">
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => onStudioHabitualChange(false)}
          className={`flex items-center gap-3 p-5 rounded-2xl border text-left transition-all ${
            studioHabitual === false
              ? 'border-primary/40 bg-primary/5'
              : 'border-outline-variant/15 bg-surface-container-lowest hover:border-primary/20'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon name="spa" className="text-lg" />
          </div>
          <div>
            <p className="text-sm font-semibold text-on-surface">No, es mi primera visita</p>
            <p className="text-xs text-on-surface-variant mt-0.5">Te guiaremos desde el tratamiento inicial</p>
          </div>
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => onStudioHabitualChange(true)}
          className={`flex items-center gap-3 p-5 rounded-2xl border text-left transition-all ${
            studioHabitual === true
              ? 'border-primary/40 bg-primary/5'
              : 'border-outline-variant/15 bg-surface-container-lowest hover:border-primary/20'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon name="history" className="text-lg" />
          </div>
          <div>
            <p className="text-sm font-semibold text-on-surface">Sí, ya he venido antes</p>
            <p className="text-xs text-on-surface-variant mt-0.5">Indica qué tratamientos has realizado</p>
          </div>
        </motion.button>
      </div>

      {studioHabitual === true && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <p className="text-[10px] font-label font-bold tracking-[0.15em] uppercase text-on-surface-variant mb-1">
            Tratamientos realizados anteriormente
          </p>
          <p className="text-xs text-on-surface-variant mb-4">
            Selecciona todos los que apliquen. Si has hecho Brow Design, te mostraremos mantenimiento y Define.
            Para el resto de tratamientos, te mostraremos solo lo que te corresponde según tu historial.
          </p>

          {options.map((opt, i) => {
            const selected = selectedIds.includes(opt.id)
            return (
              <motion.button
                key={opt.id}
                type="button"
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleId(opt.id)}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border text-left transition-all ${
                  selected
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-outline-variant/10 bg-surface-container-lowest hover:border-primary/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selected ? 'border-primary bg-primary' : 'border-outline-variant/40'
                  }`}
                >
                  {selected && <Icon name="check" className="text-white text-sm" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface">{opt.label}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5 truncate">{opt.tag}</p>
                </div>
              </motion.button>
            )
          })}
        </motion.div>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
  )
}
