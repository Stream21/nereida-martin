import { useState, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon'
import GoldButton from '../ui/GoldButton'

const NAV_LINKS = [
  { label: 'Inicio', href: '#hero', icon: 'home' },
  { label: 'Sobre mí', href: '#about', icon: 'person' },
  { label: 'Servicios', href: '#treatments', icon: 'auto_awesome' },
  { label: 'Resultados', href: '#before-after', icon: 'compare' },
  { label: 'Reseñas', href: '#reviews', icon: 'reviews' },
  { label: 'Contacto', href: '#contact', icon: 'location_on' },
]

const overlayVariants = {
  closed: { opacity: 0 },
  open: { opacity: 1 },
}

const menuContainerVariants = {
  closed: {},
  open: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } },
}

const menuItemVariants = {
  closed: { opacity: 0, y: 24 },
  open: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const scrollTo = (href) => {
    setMenuOpen(false)
    const id = href.replace('#', '')
    const el = document.getElementById(id)
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 200)
    }
  }

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-background/95 backdrop-blur-xl shadow-sm'
            : 'bg-background/80 backdrop-blur-xl'
        }`}
      >
        {/* Mobile / Tablet navbar (<lg) — logo centered, no crescent */}
        <nav className="flex lg:hidden items-center justify-between w-full px-6 py-2">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-primary hover:opacity-70 transition-opacity"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>

          <button onClick={() => scrollTo('#hero')} className="flex items-center">
            <img
              src="/logo-transparent-svg.svg"
              alt="Nereida Martín"
              className="h-14 w-auto"
            />
          </button>

          <div className="flex items-center gap-3">
            <GoldButton
              onClick={() => navigate('/reservar')}
              className="px-5 py-2 rounded-full text-xs hidden sm:inline-flex"
            >
              Reservar Cita
            </GoldButton>

            <button
              onClick={() => navigate('/reservar')}
              className="sm:hidden text-primary hover:opacity-70 transition-opacity"
              aria-label="Reservar cita"
            >
              <Icon name="calendar_today" />
            </button>
          </div>
        </nav>

        {/* Desktop navbar (lg+) — flex bar with crescent overflowing below */}
        <nav className="hidden lg:flex justify-between items-center w-full h-16 px-8 max-w-[1400px] mx-auto relative">
          {/* Left links */}
          <div className="flex items-center gap-7 z-20">
            {NAV_LINKS.slice(0, 3).map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="font-label text-xs tracking-widest uppercase text-on-surface-variant hover:text-primary transition-colors"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Crescent logo — overflows below the bar */}
          <button
            onClick={() => scrollTo('#hero')}
            className="absolute left-1/2 -translate-x-1/2 top-0 flex flex-col items-center z-10"
          >
            <motion.div
              className="relative flex items-center justify-center rounded-b-[50%] bg-background/95 backdrop-blur-xl"
              animate={{
                paddingLeft: scrolled ? 32 : 56,
                paddingRight: scrolled ? 32 : 56,
                paddingTop: scrolled ? 6 : 10,
                paddingBottom: scrolled ? 14 : 40,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{
                boxShadow: scrolled
                  ? '0 8px 20px rgba(255, 138, 138, 0.06)'
                  : '0 16px 40px rgba(255, 138, 138, 0.10)',
              }}
            >
              <motion.img
                src="/logo-transparent-svg.svg"
                alt="Nereida Martín"
                className="w-auto"
                animate={{ height: scrolled ? 80 : 160 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            </motion.div>
          </button>

          {/* Right links + CTA */}
          <div className="flex items-center gap-7 z-20">
            {NAV_LINKS.slice(3).map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="font-label text-xs tracking-widest uppercase text-on-surface-variant hover:text-primary transition-colors"
              >
                {link.label}
              </button>
            ))}
            <GoldButton
              onClick={() => navigate('/reservar')}
              className="px-6 py-2 rounded-full text-xs"
            >
              Reservar Cita
            </GoldButton>
          </div>
        </nav>
      </motion.header>

      {/* Fullscreen mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            variants={overlayVariants}
            initial="closed"
            animate="open"
            exit="closed"
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-60 bg-background flex flex-col lg:hidden"
          >
            {/* Menu header */}
            <div className="flex items-center justify-between px-6 py-4">
              <button onClick={() => scrollTo('#hero')} className="flex items-center">
                <img
                  src="/logo-transparent-svg.svg"
                  alt="Nereida Martín"
                  className="h-16 w-auto"
                />
              </button>
              <button
                onClick={() => setMenuOpen(false)}
                className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary active:scale-95 transition-transform"
                aria-label="Cerrar menú"
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="h-px bg-outline-variant/15 mx-6" />

            {/* Navigation grid */}
            <motion.nav
              variants={menuContainerVariants}
              initial="closed"
              animate="open"
              className="flex-1 px-6 py-8 overflow-y-auto"
            >
              <div className="grid grid-cols-2 gap-3">
                {NAV_LINKS.map((link) => (
                  <motion.button
                    key={link.href}
                    variants={prefersReducedMotion ? {} : menuItemVariants}
                    onClick={() => scrollTo(link.href)}
                    className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-surface-container-low hover:bg-surface-container active:scale-[0.97] transition-all text-center"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary-container/15 flex items-center justify-center">
                      <Icon name={link.icon} className="text-primary" />
                    </div>
                    <span className="font-label text-sm font-medium text-on-surface">
                      {link.label}
                    </span>
                  </motion.button>
                ))}
              </div>

              {/* CTA */}
              <motion.div
                variants={prefersReducedMotion ? {} : menuItemVariants}
                className="mt-8"
              >
                <GoldButton
                  onClick={() => { setMenuOpen(false); navigate('/reservar') }}
                  className="w-full py-5 rounded-2xl text-xs"
                >
                  Reservar Cita
                </GoldButton>
              </motion.div>

              {/* Contact info */}
              <motion.div
                variants={prefersReducedMotion ? {} : menuItemVariants}
                className="mt-8 text-center space-y-2"
              >
                <p className="text-xs text-on-surface-variant">+34 650 86 38 42</p>
              </motion.div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
