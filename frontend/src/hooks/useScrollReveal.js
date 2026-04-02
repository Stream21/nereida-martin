import { useRef } from 'react'
import { useInView, useReducedMotion } from 'framer-motion'

export default function useScrollReveal(options = {}) {
  const ref = useRef(null)
  const prefersReducedMotion = useReducedMotion()
  const isInView = useInView(ref, { once: true, amount: 0.2, ...options })

  const variants = {
    hidden: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : 40,
    },
    visible: {
      opacity: 1,
      y: 0,
    },
  }

  return { ref, isInView, variants, prefersReducedMotion }
}
