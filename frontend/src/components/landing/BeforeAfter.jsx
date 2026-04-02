import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useScrollReveal from '../../hooks/useScrollReveal'
import Icon from '../ui/Icon'

const comparisons = [
  {
    id: 1,
    label: 'Lifting con Tinte de Pestañas',
    before: '/lifting-con-tinte-pestanas-antes.jpeg',
    after: '/lifting-con-tinte-pestanas-despues.jpeg',
    mode: 'slider',
  },
  {
    id: 2,
    label: 'Micropigmentación',
    before: '/micro-antes.jpeg',
    after: '/micro-despues.jpeg',
    mode: 'toggle',
  },
]

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
}

const SWIPE_THRESHOLD = 50

function ComparisonSlider({ before, after }) {
  const containerRef = useRef(null)
  const [position, setPosition] = useState(50)
  const [isDragging, setIsDragging] = useState(false)

  const updatePosition = useCallback((clientX) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = clientX - rect.left
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setPosition(pct)
  }, [])

  const handlePointerDown = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    containerRef.current?.setPointerCapture(e.pointerId)
    updatePosition(e.clientX)
  }, [updatePosition])

  const handlePointerMove = useCallback((e) => {
    if (!isDragging) return
    updatePosition(e.clientX)
  }, [isDragging, updatePosition])

  const handlePointerUp = useCallback((e) => {
    setIsDragging(false)
    containerRef.current?.releasePointerCapture(e.pointerId)
  }, [])

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative aspect-4/3 md:aspect-video rounded-2xl overflow-hidden cursor-col-resize select-none touch-none editorial-shadow"
    >
      <img
        src={after}
        alt="Después"
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover"
      />

      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <img
          src={before}
          alt="Antes"
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>

      <span className="absolute top-4 left-4 bg-on-surface/60 text-white text-[10px] font-label font-bold tracking-[0.15em] uppercase px-3 py-1.5 rounded-full backdrop-blur-sm pointer-events-none">
        Antes
      </span>
      <span className="absolute top-4 right-4 bg-primary/80 text-white text-[10px] font-label font-bold tracking-[0.15em] uppercase px-3 py-1.5 rounded-full backdrop-blur-sm pointer-events-none">
        Después
      </span>

      <div
        className="absolute top-0 bottom-0 w-px bg-white/80 pointer-events-none z-10"
        style={{ left: `${position}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white editorial-shadow flex items-center justify-center pointer-events-none">
          <Icon name="compare_arrows" className="text-primary text-lg" />
        </div>
      </div>
    </div>
  )
}

function ToggleCard({ before, after }) {
  const [showAfter, setShowAfter] = useState(false)

  return (
    <div className="relative aspect-3/4 sm:aspect-4/3 md:aspect-video rounded-2xl overflow-hidden editorial-shadow select-none">
      <img
        src={before}
        alt="Antes"
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <motion.img
        src={after}
        alt="Después"
        draggable={false}
        animate={{ opacity: showAfter ? 1 : 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="absolute inset-0 w-full h-full object-cover"
      />

      <span
        className={`absolute top-4 left-4 text-white text-[10px] font-label font-bold tracking-[0.15em] uppercase px-3 py-1.5 rounded-full backdrop-blur-sm pointer-events-none transition-colors duration-300 ${
          showAfter ? 'bg-primary/80' : 'bg-on-surface/60'
        }`}
      >
        {showAfter ? 'Después' : 'Antes'}
      </span>

      <div className="absolute inset-x-0 bottom-0 flex justify-center pb-5 pointer-events-none">
        <motion.button
          onClick={() => setShowAfter((v) => !v)}
          whileTap={{ scale: 0.93 }}
          whileHover={{ scale: 1.04 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          className="pointer-events-auto flex items-center gap-2 px-6 py-3 rounded-full bg-white/90 backdrop-blur-md editorial-shadow font-label text-xs sm:text-sm font-bold tracking-widest uppercase text-on-surface"
        >
          <Icon name="swap_horiz" className="text-primary text-base" />
          {showAfter ? 'Ver Antes' : 'Ver Después'}
        </motion.button>
      </div>
    </div>
  )
}

export default function BeforeAfter() {
  const { ref, isInView } = useScrollReveal()
  const [current, setCurrent] = useState(0)
  const [direction, setDirection] = useState(1)

  const goTo = useCallback((index) => {
    setDirection(index > current ? 1 : -1)
    setCurrent(index)
  }, [current])

  const goNext = useCallback(() => {
    if (current < comparisons.length - 1) {
      setDirection(1)
      setCurrent((c) => c + 1)
    }
  }, [current])

  const goPrev = useCallback(() => {
    if (current > 0) {
      setDirection(-1)
      setCurrent((c) => c - 1)
    }
  }, [current])

  const handleDragEnd = useCallback((_e, info) => {
    if (info.offset.x < -SWIPE_THRESHOLD && current < comparisons.length - 1) {
      goNext()
    } else if (info.offset.x > SWIPE_THRESHOLD && current > 0) {
      goPrev()
    }
  }, [current, goNext, goPrev])

  const item = comparisons[current]

  return (
    <section id="before-after" className="py-24 px-6 bg-surface-container-low overflow-hidden">
      <div className="max-w-4xl mx-auto">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-14"
        >
          <span className="font-label text-xs tracking-[0.3em] uppercase text-primary font-bold mb-4 block">
            Resultados
          </span>
          <h2 className="font-headline text-4xl md:text-5xl text-on-surface">
            Antes y <span className="italic">Después</span>
          </h2>
          <p className="font-body text-on-surface-variant mt-4 max-w-md mx-auto">
            Desliza para ver la transformación. Resultados reales de nuestras clientas.
          </p>
        </motion.div>

        {/* Slider */}
        <div className="relative">
          {/* Slide label */}
          <motion.h3
            key={item.label}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="font-headline text-xl text-on-surface text-center mb-5"
          >
            {item.label}
          </motion.h3>

          {/* Swipeable area */}
          <div className="relative overflow-hidden rounded-2xl">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={item.id}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.15}
                onDragEnd={handleDragEnd}
              >
                {item.mode === 'toggle'
                  ? <ToggleCard before={item.before} after={item.after} />
                  : <ComparisonSlider before={item.before} after={item.after} />
                }
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation arrows */}
          <div className="hidden md:block">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={goPrev}
              className={`absolute top-1/2 -left-5 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-surface-container-lowest editorial-shadow flex items-center justify-center transition-opacity duration-300 ${
                current === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
            >
              <Icon name="chevron_left" className="text-on-surface" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={goNext}
              className={`absolute top-1/2 -right-5 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-surface-container-lowest editorial-shadow flex items-center justify-center transition-opacity duration-300 ${
                current === comparisons.length - 1 ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
            >
              <Icon name="chevron_right" className="text-on-surface" />
            </motion.button>
          </div>
        </div>

        {/* Dot indicators + counter */}
        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2.5">
            {comparisons.map((comp, i) => (
              <button
                key={comp.id}
                onClick={() => goTo(i)}
                className="p-1"
              >
                <motion.div
                  animate={{
                    width: i === current ? 28 : 8,
                    backgroundColor: i === current ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                  }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="h-2 rounded-full"
                />
              </button>
            ))}
          </div>
          <span className="text-xs text-on-surface-variant font-label">
            {current + 1} / {comparisons.length}
          </span>
        </div>
      </div>
    </section>
  )
}
