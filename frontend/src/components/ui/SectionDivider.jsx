import { motion, useReducedMotion } from 'framer-motion'

const paths = {
  wave: 'M0,0 C360,80 720,-20 1440,40 L1440,120 L0,120 Z',
  arc: 'M0,0 Q720,100 1440,0 L1440,120 L0,120 Z',
  tilt: 'M0,60 C200,65 600,10 1440,0 L1440,120 L0,120 Z',
}

const colorMap = {
  'background': 'var(--color-background)',
  'surface-container-low': 'var(--color-surface-container-low)',
  'surface-container': 'var(--color-surface-container)',
}

export default function SectionDivider({ variant = 'wave', fill = 'background', flip = false }) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      className="w-full overflow-hidden leading-0 -mt-px"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="block w-full h-10 sm:h-12 md:h-14"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d={paths[variant]}
          fill={colorMap[fill] || colorMap.background}
        />
      </svg>
    </motion.div>
  )
}
