import { useRef } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import GoldButton from '../ui/GoldButton'

const floatingShapes = [
  { size: 320, top: '-8%', right: '-5%', delay: 0, duration: 20, color: 'rgba(255,138,138,0.07)' },
  { size: 260, bottom: '5%', left: '-8%', delay: 3, duration: 24, color: 'rgba(201,136,122,0.06)' },
  { size: 180, top: '55%', right: '20%', delay: 5, duration: 18, color: 'rgba(255,181,181,0.08)' },
  { size: 220, top: '10%', left: '25%', delay: 1.5, duration: 22, color: 'rgba(255,215,215,0.07)' },
  { size: 120, bottom: '25%', right: '35%', delay: 4, duration: 16, color: 'rgba(255,138,138,0.05)' },
]

const services = [
  'Cejas',
  'Pestañas',
  'Faciales',
  'Micropigmentación',
]

const stats = [
  { value: '+5', label: 'Años' },
  { value: '+2k', label: 'Clientas' },
  { value: '4.9★', label: 'Valoración' },
]

const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
}

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1], delay },
  }),
}

function FloatingBlob({ size, delay, duration, color, ...pos }) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      className="absolute rounded-full blur-3xl pointer-events-none will-change-transform"
      style={{ width: size, height: size, background: color, ...pos }}
      animate={
        prefersReducedMotion
          ? {}
          : {
              y: [0, -25, 12, -18, 0],
              x: [0, 18, -12, 15, 0],
              scale: [1, 1.06, 0.96, 1.04, 1],
            }
      }
      transition={{ duration, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  )
}

export default function HeroSection() {
  const ref = useRef(null)
  const prefersReducedMotion = useReducedMotion()
  const navigate = useNavigate()

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })

  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', prefersReducedMotion ? '0%' : '20%'])
  const bgOpacity = useTransform(scrollYProgress, [0, 0.8, 1], [1, 1, 0])

  return (
    <section
      id="hero"
      ref={ref}
      className="relative min-h-svh flex items-center justify-center overflow-hidden pt-20 lg:pt-24 pb-8"
    >
      {/* Background layers */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_40%,rgba(255,138,138,0.08),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_15%_80%,rgba(201,136,122,0.06),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_85%_20%,rgba(255,215,215,0.10),transparent_55%)]" />
      </div>

      {/* Floating blobs */}
      {floatingShapes.map((shape, i) => (
        <FloatingBlob key={i} {...shape} />
      ))}

      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 z-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(67,61,60,0.5) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Main content */}
      <motion.div
        style={{ opacity: bgOpacity, y: contentY }}
        className="relative z-10 w-full max-w-5xl mx-auto px-5 sm:px-8 will-change-transform"
      >
        <motion.div variants={stagger} initial="hidden" animate="visible">

          {/* Specialist label */}
          <motion.p
            variants={fadeUp}
            custom={0}
            className="text-center font-label text-xs sm:text-sm tracking-[0.3em] uppercase text-primary font-bold mb-6 sm:mb-8"
          >
            Especialista en Cejas
          </motion.p>

          {/* Name */}
          <motion.h1
            variants={fadeUp}
            custom={0.15}
            className="text-center font-headline text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl text-on-surface tracking-tight leading-[0.95] mb-4 sm:mb-5"
          >
            Nereida Martín
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={fadeUp}
            custom={0.35}
            className="text-center font-headline text-lg sm:text-xl md:text-2xl lg:text-3xl text-on-surface/50 tracking-wide mb-8 sm:mb-10"
          >
            Tu mirada, su mejor <span className="italic text-primary/70">versión</span>
          </motion.p>

          {/* Service pills */}
          <motion.div
            variants={fadeUp}
            custom={0.6}
            className="flex flex-wrap justify-center gap-2.5 sm:gap-3 mb-10 sm:mb-12"
          >
            {services.map((service, i) => (
              <motion.span
                key={service}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.5,
                  delay: 1.0 + i * 0.1,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="px-5 py-2.5 rounded-full bg-surface-container-lowest/80 border border-outline-variant/40 font-label text-xs sm:text-sm tracking-wider uppercase text-on-surface-variant backdrop-blur-sm"
              >
                {service}
              </motion.span>
            ))}
          </motion.div>

          {/* CTAs */}
          <motion.div
            variants={fadeUp}
            custom={0.7}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-12 sm:mb-14"
          >
            <GoldButton
              onClick={() => navigate('/reservar')}
              className="w-full sm:w-auto px-10 py-4 rounded-2xl text-sm"
            >
              Reservar mi cita
            </GoldButton>

            <motion.a
              href="#treatments"
              whileHover={prefersReducedMotion ? {} : { scale: 1.03 }}
              whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-sm font-label font-bold tracking-[0.15em] uppercase text-on-surface border-2 border-outline-variant/40 hover:border-primary/40 hover:text-primary transition-colors"
            >
              Descubrir tratamientos
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </motion.a>
          </motion.div>

          {/* Stats */}
          <motion.div
            variants={fadeUp}
            custom={0.85}
            className="flex items-center justify-center gap-8 sm:gap-14"
          >
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                className="flex flex-col items-center text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.6,
                  delay: 1.5 + i * 0.15,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <span className="font-headline text-2xl sm:text-3xl md:text-4xl text-on-surface font-semibold leading-none">
                  {stat.value}
                </span>
                <span className="font-label text-[10px] sm:text-xs tracking-[0.2em] uppercase text-on-surface-variant/70 mt-1.5">
                  {stat.label}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  )
}
