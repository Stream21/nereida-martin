import { motion, useReducedMotion } from 'framer-motion'

export default function GoldButton({ children, className = '', onClick, type = 'button' }) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.button
      type={type}
      onClick={onClick}
      whileHover={prefersReducedMotion ? {} : { scale: 1.03 }}
      whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
      className={`coral-gradient text-white font-label font-bold tracking-[0.15em] uppercase editorial-shadow transition-opacity hover:opacity-90 ${className}`}
    >
      {children}
    </motion.button>
  )
}
