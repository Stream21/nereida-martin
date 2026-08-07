import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

export default function CompareTap({
  before,
  after,
  objectPosition = 'center',
  className = '',
  fit = 'cover',
  showAfter: controlledShowAfter,
  onShowAfterChange,
}) {
  const [internalShowAfter, setInternalShowAfter] = useState(false)
  const reducedMotion = useReducedMotion()
  const showAfter = controlledShowAfter ?? internalShowAfter

  const toggle = (e) => {
    e.stopPropagation()
    const next = !showAfter
    if (onShowAfterChange) onShowAfterChange(next)
    else setInternalShowAfter(next)
  }

  const objectClass = fit === 'contain' ? 'object-contain' : 'object-cover'
  const src = showAfter ? after : before

  return (
    <button
      type="button"
      onClick={toggle}
      className={`relative overflow-hidden cursor-pointer ${className}`}
      aria-label={showAfter ? 'Mostrando después. Toca para ver antes' : 'Mostrando antes. Toca para ver después'}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.img
          key={src}
          src={src}
          alt=""
          draggable={false}
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.28, ease: 'easeOut' }}
          className={`absolute inset-0 w-full h-full ${objectClass}`}
          style={{ objectPosition }}
        />
      </AnimatePresence>
    </button>
  )
}
