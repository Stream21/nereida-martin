import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from '../ui/Icon'
import {
  BROW_DESIGN_PRIMERA,
  BROW_DESIGN_SEGUIMIENTO,
  filterTreatmentsForClient,
  hasBrowDesignHistoryInDb,
  sortTreatmentsForDisplay,
} from '../../utils/browDesign'
import { requiresPhotoAssessment } from '../../utils/photoAssessment'

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

export default function StepTreatments({ treatments, categories, onSelect, clientProfile }) {
  const [activeCategory, setActiveCategory] = useState(categories[0].id)
  const tabsRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const treatmentIds = clientProfile?.treatmentIds || []
  const declaredPriorTreatments = clientProfile?.declaredPriorTreatments || []
  const dbDoneIds = new Set(treatmentIds)
  const declaredOnlyIds = new Set(
    declaredPriorTreatments.filter((id) => !dbDoneIds.has(id) && id !== 'brow-design')
  )

  const visibleTreatments = useMemo(
    () => filterTreatmentsForClient(treatments, { treatmentIds }),
    [treatments, treatmentIds]
  )

  const filteredTreatments = visibleTreatments.filter((t) => t.category === activeCategory)

  const sortedTreatments = useMemo(
    () => sortTreatmentsForDisplay(filteredTreatments, treatments),
    [filteredTreatments, treatments]
  )

  const isKnownReturning = clientProfile?.isKnownClient || (clientProfile?.visitCount > 0)
  const hasBrowHistory = hasBrowDesignHistoryInDb(treatmentIds)
  const isFirstBrowVisit = !hasBrowHistory

  const getTreatmentMeta = (treatment) => {
    const badges = []
    if (dbDoneIds.has(treatment.id)) {
      badges.push({ label: 'Ya lo has reservado antes', tone: 'muted' })
    } else if (
      declaredOnlyIds.has(treatment.id)
      || (treatment.id === BROW_DESIGN_SEGUIMIENTO && declaredPriorTreatments.includes('brow-design'))
    ) {
      badges.push({ label: 'Indicaste que ya lo hiciste', tone: 'muted' })
    }
    if (isFirstBrowVisit && treatment.id === BROW_DESIGN_PRIMERA) {
      badges.push({ label: 'Recomendado primera vez', tone: 'primary' })
    }
    if (hasBrowHistory && treatment.id === BROW_DESIGN_SEGUIMIENTO) {
      badges.push({ label: 'Ideal para ti', tone: 'primary' })
    }
    if (requiresPhotoAssessment(treatment.id, { treatmentIds })) {
      badges.push({ label: 'Requiere valoración con foto', tone: 'warn' })
    }
    return badges
  }

  const checkScroll = useCallback(() => {
    const el = tabsRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
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
  }, [checkScroll, activeCategory, visibleTreatments.length])

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
          {isFirstBrowVisit && !isKnownReturning
            ? 'Te guiamos para elegir el tratamiento ideal en tu primera visita'
            : 'Selecciona una categoría y elige tu tratamiento'}
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
            const count = visibleTreatments.filter((t) => t.category === cat.id).length
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
          {sortedTreatments.length === 0 ? (
            <motion.div
              variants={cardVariants}
              className="text-center py-12 px-4 rounded-2xl bg-surface-container-low border border-outline-variant/10"
            >
              <Icon name="spa" className="text-3xl text-on-surface-variant/40 mb-3" />
              <p className="text-sm text-on-surface-variant">
                No hay tratamientos en esta categoría
              </p>
            </motion.div>
          ) : sortedTreatments.map((treatment) => {
              const badges = getTreatmentMeta(treatment)
              return (
              <motion.button
                key={treatment.id}
                variants={cardVariants}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelect(treatment)}
                className="group w-full text-left px-5 py-4 rounded-2xl transition-colors duration-300 border hover:border-primary/20 bg-surface-container-lowest hover:bg-surface-container-low border-outline-variant/10"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-headline text-base text-on-surface font-semibold leading-snug">
                      {treatment.name}
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                      {treatment.tag}
                    </p>
                    {badges.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {badges.map((b) => (
                          <span
                            key={b.label}
                            className={`text-[10px] px-2 py-0.5 rounded-full font-label font-bold tracking-wide ${
                              b.tone === 'primary'
                                ? 'bg-primary/15 text-primary'
                                : b.tone === 'warn'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-outline-variant/15 text-on-surface-variant'
                            }`}
                          >
                            {b.label}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mt-2">
                      <Icon name="schedule" className="text-xs text-primary/70" />
                      <span className="text-xs text-on-surface-variant font-medium">
                        {treatment.duration}
                      </span>
                    </div>
                  </div>

                  <Icon name="chevron_right" className="text-primary/60 shrink-0" />
                </div>
              </motion.button>
            )})}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
