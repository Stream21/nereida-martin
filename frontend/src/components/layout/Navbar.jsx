import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon'
import GoldButton from '../ui/GoldButton'
import { useClientAuth } from '../../hooks/useClientAuth'

const NAV_LINKS = [
  { label: 'Inicio', href: '#hero', icon: 'home' },
  { label: 'Sobre mí', href: '#about', icon: 'person' },
  { label: 'Servicios', href: '#treatments', icon: 'auto_awesome' },
  { label: 'Galería', href: '#gallery', icon: 'photo_library' },
  { label: 'Reseñas', href: '#reviews', icon: 'reviews' },
  { label: 'Contacto', href: '#contact', icon: 'contact_mail' },
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

function clientInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function firstName(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean)[0] || ''
}

/** Soft account control — Soft UI Evolution + brand Skin & Glow */
function AccountControl({
  isAuthenticated,
  user,
  onLogout,
  onLogin,
  compact = false,
  className = '',
}) {
  const prefersReducedMotion = useReducedMotion()
  const label = firstName(user?.name)
  const [menuOpen, setMenuOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  if (isAuthenticated) {
    return (
      <div ref={rootRef} className={`relative ${className}`}>
        <motion.button
          type="button"
          whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Cuenta de ${user?.name || 'cliente'}`}
          title={user?.name || 'Cuenta'}
          className={`cursor-pointer flex items-center gap-2 rounded-full bg-surface-container-low/90 shadow-[0_2px_8px_rgba(67,61,60,0.06)] hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors duration-200 ${
            compact ? 'pl-1 pr-2 py-1' : 'pl-1.5 pr-2.5 py-1.5'
          }`}
        >
          <span
            className={`inline-flex items-center justify-center rounded-full bg-primary/15 text-primary font-label font-semibold ${
              compact ? 'w-8 h-8 text-[10px]' : 'w-9 h-9 text-[11px]'
            }`}
            aria-hidden
          >
            {clientInitials(user?.name)}
          </span>
          {!compact && label && (
            <span className="font-label text-xs tracking-wide text-on-surface max-w-28 truncate">
              {label}
            </span>
          )}
          <Icon
            name="expand_more"
            className={`text-on-surface-variant text-[18px] transition-transform duration-200 ${
              menuOpen ? 'rotate-180' : ''
            }`}
          />
        </motion.button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute right-0 top-[calc(100%+0.5rem)] z-70 min-w-48 rounded-2xl bg-background border border-outline-variant/15 shadow-[0_12px_32px_rgba(67,61,60,0.12)] p-1.5"
            >
              <div className="px-3 py-2 border-b border-outline-variant/10 mb-1">
                <p className="font-label text-xs font-medium text-on-surface truncate">
                  {user?.name || 'Tu cuenta'}
                </p>
                {user?.email && (
                  <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                    {user.email}
                  </p>
                )}
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  onLogout()
                }}
                className="cursor-pointer w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <Icon name="logout" className="text-[20px]" />
                <span className="font-label text-xs tracking-wide">Cerrar sesión</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <motion.button
      type="button"
      whileHover={prefersReducedMotion ? {} : { scale: 1.03 }}
      whileTap={prefersReducedMotion ? {} : { scale: 0.97 }}
      onClick={onLogin}
      aria-label="Entrar a tu cuenta"
      className={`cursor-pointer inline-flex items-center justify-center gap-2 min-h-11 rounded-full bg-surface-container-low/90 text-on-surface shadow-[0_2px_8px_rgba(67,61,60,0.06)] hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors duration-200 ${
        compact ? 'w-11 px-0' : 'px-3.5 py-2'
      } ${className}`}
    >
      <Icon name="login" className="text-[22px]" />
      {!compact && (
        <span className="font-label text-xs font-medium tracking-widest uppercase">
          Entrar
        </span>
      )}
    </motion.button>
  )
}

function MobileAccountCard({ isAuthenticated, user, onLogout, onLogin }) {
  const prefersReducedMotion = useReducedMotion()

  if (isAuthenticated) {
    return (
      <div className="rounded-2xl bg-surface-container-low p-4 shadow-[0_4px_16px_rgba(67,61,60,0.06)]">
        <div className="flex items-center gap-3">
          <span
            className="shrink-0 w-12 h-12 rounded-full bg-primary/15 text-primary font-label font-semibold text-sm flex items-center justify-center"
            aria-hidden
          >
            {clientInitials(user?.name)}
          </span>
          <div className="min-w-0 flex-1 text-left">
            <p className="font-label text-sm font-medium text-on-surface truncate">
              {user?.name || 'Tu cuenta'}
            </p>
            <p className="text-xs text-on-surface-variant mt-0.5 truncate">
              {user?.email || 'Sesión iniciada'}
            </p>
          </div>
        </div>
        <motion.button
          type="button"
          whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
          onClick={onLogout}
          className="cursor-pointer mt-3 w-full inline-flex items-center justify-center gap-2 min-h-11 px-3 rounded-xl bg-background/80 text-on-surface-variant hover:text-primary hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors duration-200"
          aria-label="Cerrar sesión"
        >
          <Icon name="logout" className="text-[20px]" />
          <span className="font-label text-[11px] tracking-wide uppercase">Cerrar sesión</span>
        </motion.button>
      </div>
    )
  }

  return (
    <motion.button
      type="button"
      whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
      onClick={onLogin}
      className="cursor-pointer w-full rounded-2xl bg-surface-container-low p-4 flex items-center gap-3 text-left shadow-[0_4px_16px_rgba(67,61,60,0.06)] hover:bg-surface-container active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors duration-200"
    >
      <span className="shrink-0 w-12 h-12 rounded-full bg-primary-container/15 flex items-center justify-center">
        <Icon name="login" className="text-primary text-[24px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-label text-sm font-medium text-on-surface">
          Entrar a tu cuenta
        </span>
        <span className="block text-xs text-on-surface-variant mt-0.5">
          Accede para reservar citas
        </span>
      </span>
      <Icon name="chevron_right" className="text-on-surface-variant text-[22px]" />
    </motion.button>
  )
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const navigate = useNavigate()
  const { isAuthenticated, user, logout } = useClientAuth()

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

  const handleLogin = () => {
    setMenuOpen(false)
    navigate('/entrar')
  }

  const handleLogout = () => {
    logout()
    setMenuOpen(false)
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
        {/* Mobile / Tablet navbar (<lg) */}
        <nav className="flex lg:hidden items-center justify-between w-full px-5 py-2 gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="cursor-pointer inline-flex items-center justify-center min-w-11 min-h-11 text-primary hover:opacity-70 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>

          <button
            type="button"
            onClick={() => scrollTo('#hero')}
            className={`cursor-pointer flex items-center transition-opacity duration-300 ${scrolled ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            <img
              src="/logo2.png"
              alt="Nereida Martín — Brow Artist"
              className="h-10 w-auto"
            />
          </button>

          <div className="flex items-center gap-1">
            <AccountControl
              compact
              className="sm:hidden"
              isAuthenticated={isAuthenticated}
              user={user}
              onLogout={handleLogout}
              onLogin={handleLogin}
            />
            <div className="hidden sm:block">
              <AccountControl
                isAuthenticated={isAuthenticated}
                user={user}
                onLogout={handleLogout}
                onLogin={handleLogin}
              />
            </div>
            <GoldButton
              onClick={() => navigate('/reservar')}
              className="px-5 py-2 rounded-full text-xs hidden sm:inline-flex"
            >
              Reservar Cita
            </GoldButton>

            <button
              type="button"
              onClick={() => navigate('/reservar')}
              className="cursor-pointer sm:hidden inline-flex items-center justify-center min-w-11 min-h-11 text-primary hover:opacity-70 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-label="Reservar cita"
            >
              <Icon name="calendar_today" />
            </button>
          </div>
        </nav>

        {/* Desktop navbar (lg+) */}
        <nav className="hidden lg:flex justify-between items-center w-full h-16 px-8 max-w-[1400px] mx-auto relative">
          <div className="flex items-center gap-7 z-20">
            {NAV_LINKS.slice(0, 3).map((link) => (
              <button
                type="button"
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="cursor-pointer font-label text-xs tracking-widest uppercase text-on-surface-variant hover:text-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {link.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => scrollTo('#hero')}
            className={`cursor-pointer absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 flex items-center z-10 transition-opacity duration-300 ${scrolled ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            <img
              src="/logo2.png"
              alt="Nereida Martín — Brow Artist"
              className="h-10 w-auto"
            />
          </button>

          <div className="flex items-center gap-5 z-20">
            {NAV_LINKS.slice(3).map((link) => (
              <button
                type="button"
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="cursor-pointer font-label text-xs tracking-widest uppercase text-on-surface-variant hover:text-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {link.label}
              </button>
            ))}
            <AccountControl
              isAuthenticated={isAuthenticated}
              user={user}
              onLogout={handleLogout}
              onLogin={handleLogin}
            />
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
            <div className="relative flex items-center justify-center px-6 py-4">
              <button type="button" onClick={() => scrollTo('#hero')} className="cursor-pointer flex items-center">
                <img
                  src="/logo2.png"
                  alt="Nereida Martín — Brow Artist"
                  className="h-12 w-auto"
                />
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="cursor-pointer absolute right-6 w-11 h-11 rounded-full bg-surface-container flex items-center justify-center text-primary active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                aria-label="Cerrar menú"
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="h-px bg-outline-variant/15 mx-6" />

            <motion.nav
              variants={menuContainerVariants}
              initial="closed"
              animate="open"
              className="flex-1 px-6 py-8 overflow-y-auto"
            >
              <motion.div
                variants={prefersReducedMotion ? {} : menuItemVariants}
                className="mb-6"
              >
                <MobileAccountCard
                  isAuthenticated={isAuthenticated}
                  user={user}
                  onLogout={handleLogout}
                  onLogin={handleLogin}
                />
              </motion.div>

              <div className="grid grid-cols-2 gap-3">
                {NAV_LINKS.map((link) => (
                  <motion.button
                    type="button"
                    key={link.href}
                    variants={prefersReducedMotion ? {} : menuItemVariants}
                    onClick={() => scrollTo(link.href)}
                    className="cursor-pointer flex flex-col items-center justify-center gap-3 p-6 rounded-2xl bg-surface-container-low hover:bg-surface-container active:scale-[0.97] transition-all text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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

              <motion.div
                variants={prefersReducedMotion ? {} : menuItemVariants}
                className="mt-8 text-center space-y-2"
              >
                <p className="text-xs text-on-surface-variant">+34 641 61 36 14</p>
              </motion.div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
