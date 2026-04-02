import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from '../ui/Icon'

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

const checkPathVariants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.3, ease: 'easeOut', delay: 0.1 },
  },
}

function AnimatedCheck({ isSelected }) {
  return (
    <div
      className={`relative w-7 h-7 rounded-full shrink-0 transition-all duration-300 ${
        isSelected
          ? 'bg-linear-to-br from-primary to-primary/80 shadow-[0_2px_8px_rgba(255,138,138,0.4)] scale-105'
          : 'border-2 border-outline-variant/30 group-hover:border-primary/40'
      }`}
    >
      <AnimatePresence>
        {isSelected && (
          <motion.svg
            key="check"
            viewBox="0 0 24 24"
            fill="none"
            className="absolute inset-0 w-full h-full p-1.5"
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <motion.path
              d="M5 13l4 4L19 7"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              variants={checkPathVariants}
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function StepTreatments({ treatments, categories, selectedTreatment, onSelect }) {
  const [activeCategory, setActiveCategory] = useState(categories[0].id)
  const tabsRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const filteredTreatments = treatments.filter((t) => t.category === activeCategory)

  const checkScroll = useCallback(() => {
    const el = tabsRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useEffect(() => {
    if (selectedTreatment) {
      setActiveCategory(selectedTreatment.category)
    }
  }, [])

  useEffect(() => {
    const el = tabsRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [checkScroll])

  const scrollToTab = (catId) => {
    setActiveCategory(catId)
    const container = tabsRef.current
    const activeBtn = container?.querySelector(`[data-cat="${catId}"]`)
    if (activeBtn && container) {
      const offset = activeBtn.offsetLeft - container.offsetWidth / 2 + activeBtn.offsetWidth / 2
      container.scrollTo({ left: offset, behavior: 'smooth' })
    }
  }

  return (
    <div>
      <section className="mb-6 text-center">
        <h2 className="font-headline text-2xl md:text-3xl text-on-surface leading-tight">
          ¿Qué tratamiento te interesa?
        </h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          Selecciona una categoría y elige tu tratamiento
        </p>
      </section>

      <div className="relative mb-6">
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-linear-to-r from-background to-transparent z-10 pointer-events-none" />
        )}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-linear-to-l from-background to-transparent z-10 pointer-events-none" />
        )}
        <div
          ref={tabsRef}
          className="flex gap-2 overflow-x-auto no-scrollbar pb-1 snap-x snap-mandatory scroll-px-1 -mx-1 px-1"
        >
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id
            const count = treatments.filter((t) => t.category === cat.id).length
            return (
              <motion.button
                key={cat.id}
                data-cat={cat.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => scrollToTab(cat.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-label font-bold whitespace-nowrap transition-all duration-300 shrink-0 snap-start ${
                  isActive
                    ? 'bg-primary text-white editorial-shadow'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <Icon name={cat.icon} className="text-base" />
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20' : 'bg-outline-variant/15'
                  }`}
                >
                  {count}
                </span>
              </motion.button>
            )
          })}
          <div className="shrink-0 w-4" aria-hidden="true" />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategory}
          variants={listVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="space-y-3"
        >
          {filteredTreatments.map((treatment) => {
            const isSelected = selectedTreatment?.id === treatment.id

            return (
              <motion.button
                key={treatment.id}
                variants={cardVariants}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelect(treatment)}
                className={`group w-full text-left px-5 py-4 rounded-2xl transition-colors duration-300 ${
                  isSelected
                    ? 'bg-primary/8 ring-2 ring-primary/25 shadow-[0_2px_12px_rgba(255,138,138,0.12)]'
                    : 'bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant/10'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-headline text-base text-on-surface font-semibold leading-snug">
                      {treatment.name}
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                      {treatment.tag}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <Icon name="schedule" className="text-xs text-primary/70" />
                      <span className="text-xs text-on-surface-variant font-medium">
                        {treatment.duration}
                      </span>
                    </div>
                  </div>

                  <AnimatedCheck isSelected={isSelected} />
                </div>
              </motion.button>
            )
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
