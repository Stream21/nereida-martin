import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useScrollReveal from '../../hooks/useScrollReveal'
import Icon from '../ui/Icon'

const reviews = [
  {
    initial: 'A',
    name: 'Alejandra R.',
    label: 'Clienta habitual',
    text: '"No dejo mis cejas en otras manos. Nere tiene un don para encontrar la forma perfecta sin que parezca artificial."',
  },
  {
    initial: 'M',
    name: 'Marta S.',
    label: 'Clienta habitual',
    text: '"Resultado súper natural. Fui por primera vez y salí encantada. El espacio es precioso y te sientes como en casa."',
  },
  {
    initial: 'L',
    name: 'Laura G.',
    label: 'Clienta habitual',
    text: '"Llevo años confiando en Nere para mis cejas. Siempre sale perfecta. La recomiendo al 100%."',
  },
  {
    initial: 'C',
    name: 'Carmen P.',
    label: 'Primera visita',
    text: '"Fue mi primera vez con micropigmentación y la experiencia fue increíble. Muy profesional y atenta a cada detalle."',
  },
  {
    initial: 'S',
    name: 'Sofía T.',
    label: 'Clienta habitual',
    text: '"El lifting de pestañas me cambió la rutina de maquillaje. Me levanto y ya tengo los ojos preciosos. ¡No puedo estar más contenta!"',
  },
  {
    initial: 'P',
    name: 'Patricia M.',
    label: 'Primera visita',
    text: '"Tenía mucho miedo de la micropigmentación, pero Nere me explicó todo con calma. El resultado es tan natural que parece que he nacido así."',
  },
  {
    initial: 'R',
    name: 'Rocío D.',
    label: 'Clienta habitual',
    text: '"Siempre salgo feliz del estudio. El ambiente es súper relajante y Nere cuida hasta el último detalle. Mi sitio favorito."',
  },
]

const slideVariants = {
  enter: (direction) => ({ x: direction > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction > 0 ? -300 : 300, opacity: 0 }),
}

export default function ReviewsCarousel() {
  const [[current, direction], setCurrent] = useState([0, 0])
  const { ref, isInView, prefersReducedMotion } = useScrollReveal()

  const paginate = useCallback((newDirection) => {
    setCurrent(([prev]) => {
      const next = prev + newDirection
      if (next < 0 || next >= reviews.length) return [prev, 0]
      return [next, newDirection]
    })
  }, [])

  const isFirst = current === 0
  const isLast = current === reviews.length - 1
  const r = reviews[current]

  return (
    <section id="reviews" className="py-24 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <span className="font-label text-xs tracking-[0.3em] uppercase text-primary font-bold mb-4 block">
              Opiniones reales
            </span>
            <h2 className="font-headline text-4xl text-on-surface">
              Voces de <br />
              <span className="italic">confianza</span>
            </h2>
          </motion.div>

          <div className="flex gap-3">
            <button
              onClick={() => paginate(-1)}
              disabled={isFirst}
              className="w-11 h-11 rounded-full border border-outline-variant flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/10 disabled:hover:bg-transparent"
            >
              <Icon name="chevron_left" />
            </button>
            <button
              onClick={() => paginate(1)}
              disabled={isLast}
              className="w-11 h-11 rounded-full border border-outline-variant flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/10 disabled:hover:bg-transparent"
            >
              <Icon name="chevron_right" />
            </button>
          </div>
        </div>

        <div ref={ref} className="relative">
          <div className="overflow-hidden">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={current}
                custom={direction}
                variants={prefersReducedMotion ? {} : slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="w-full"
              >
                <div className="max-w-2xl mx-auto bg-surface-container-low p-8 md:p-12 rounded-3xl border border-outline-variant/10">
                  <div className="flex gap-1 mb-6">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Icon key={i} name="star" filled className="text-primary text-sm" />
                    ))}
                  </div>
                  <p className="font-headline italic text-lg md:text-xl text-on-surface leading-relaxed mb-10">
                    {r.text}
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center font-bold text-primary text-sm">
                      {r.initial}
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-on-surface">{r.name}</h5>
                      <p className="text-xs text-on-surface-variant">{r.label}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex justify-center gap-2 mt-8">
            {reviews.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent([i, i > current ? 1 : -1])}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === current
                    ? 'w-6 bg-primary'
                    : 'w-2 bg-outline-variant/40 hover:bg-outline-variant'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
