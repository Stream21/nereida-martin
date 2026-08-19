import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useScrollReveal from '../../hooks/useScrollReveal'
import Icon from '../ui/Icon'

const categories = [
  { id: 'cejas', label: 'Cejas', icon: 'visibility' },
  { id: 'pestanas', label: 'Pestañas', icon: 'remove_red_eye' },
  { id: 'rostro', label: 'Cuidado de la piel', icon: 'spa' },
  { id: 'depilacion', label: 'Depilación facial', icon: 'content_cut' },
  { id: 'smile', label: 'Tendencias', icon: 'diamond' },
]

const treatments = {
  cejas: {
    items: [
      {
        name: 'Perfilado',
        tag: 'Primera vez o mantenimiento',
        bookingIntent: 'perfilado',
        duration: '45 minutos',
        description:
          'El punto de partida para transformar tu mirada. Incluye un estudio de visajismo y una epilación precisa con hilo o pinza. Si es tu primera visita en la plataforma, reservamos Perfilado primera vez; si ya constas en el estudio, te asignamos mantenimiento automáticamente.',
      },
      {
        name: 'Perfilado Conjunto',
        tag: 'Dos perfilados seguidos',
        bookingId: 'perfilado-conjunto',
        duration: '1 hora',
        description:
          'Ven con una amiga y reservad el mismo hueco. Dos perfilados consecutivos de 30 minutos cada una, una hora en total. El precio se calcula según el historial de cada una (primera vez o mantenimiento).',
      },
      {
        name: 'Brow Define',
        tag: 'Diseño + Tinte + Perfilado',
        bookingId: 'brow-define',
        duration: '60 minutos',
        description:
          'Ideal para aportar densidad, rellenar visualmente espacios sombreados y dar color. Combinamos el estudio de visajismo y el perfilado con un tinte personalizado que resalta e intensifica la mirada de forma inmediata.',
      },
      {
        name: 'Brow Lami',
        tag: 'Laminado + Perfilado',
        bookingId: 'brow-lami',
        duration: '60 minutos',
        description:
          'El tratamiento estrella para disciplinar, peinar y dar volumen a las cejas rebeldes o finas. Diseñamos y fijamos la dirección del vello para conseguir un efecto óptico de ceja más poblada, limpia y definida.',
      },
      {
        name: 'Brow Lami Define',
        tag: 'Laminado + Perfilado + Tinte',
        bookingId: 'brow-lami-define',
        duration: '75 minutos',
        description:
          'La transformación absoluta para tus cejas. Un tratamiento integral que combina el moldeado del laminado, la precisión del diseño y la intensidad del tinte. Perfecto para un efecto de ceja densa, peinada y definida de larga duración.',
      },
      {
        name: 'Brow Henna',
        tag: 'Henna + Perfilado',
        bookingId: 'brow-henna',
        duration: '60 minutos',
        description:
          'Diseño y definición con coloración natural. La henna tiñe tanto el vello como la piel subyacente, creando un efecto sombreado tipo maquillaje ideal para rellenar huecos y dar una definición impecable.',
      },
      {
        name: 'Brow Restored',
        tag: 'Dermapen en Cejas',
        bookingId: 'brow-restored',
        duration: '45 minutos',
        description:
          'Tratamiento regenerador avanzado para cejas despobladas o debilitadas. Mediante la tecnología Dermapen, estimulamos el folículo piloso y favorecemos el crecimiento del vello desde la raíz, devolviendo la densidad perdida.',
      },
      {
        name: 'Micropigmentación Soft Pixel Brow',
        bookingId: 'micropigmentacion-soft-pixel',
        duration: '3 horas',
        description:
          'Diseño de cejas semipermanente con una técnica avanzada de efecto polvo o pixelado. Logramos un sombreado suave, difuminado y elegante que aporta una definición perfecta y natural durante meses, olvidándote de maquillarlas a diario.',
        isMicro: true,
        requestOnly: true,
      },
    ],
  },
  pestanas: {
    items: [
      {
        name: 'Lifting koreano',
        tag: 'Lifting + tinte',
        bookingId: 'lash-lift-korean',
        duration: '2 horas',
        description:
          'El tratamiento definitivo para elevar y curvar tus pestañas naturales desde la raíz. Añadimos un toque de color para intensificar la mirada, logrando un efecto de pestañas visiblemente más largas, oscuras y definidas. Además, incluye una sesión de hidratación profunda que nutre y protege el pelo, garantizando un resultado radiante, sano y de larga duración.',
      },
    ],
  },
  rostro: {
    items: [
      {
        name: 'Skin Reset',
        tag: 'Limpieza Facial Coreana',
        bookingId: 'skin-reset',
        duration: '75 minutos',
        description:
          'Un reinicio completo para tu piel basado en los exigentes estándares de la cosmética coreana. Una limpieza profunda y respetuosa que elimina impurezas, equilibra y aporta una luminosidad inmediata, dejando el rostro radiante y oxigenado.',
      },
      {
        name: 'Skin Boost',
        tag: 'Dermapen Facial',
        bookingId: 'skin-boost',
        duration: '45 minutos',
        description:
          'Tratamiento de inducción de colágeno para renovar la piel desde el interior. Atenúa líneas de expresión, minimiza poros y mejora la textura general del rostro mediante microcanales que potencian la absorción de principios activos avanzados.',
      },
    ],
  },
  depilacion: {
    items: [
      {
        name: 'Depilación labio superior',
        bookingId: 'labio-superior',
        description:
          'Eliminación del vello de forma rápida y eficaz mediante técnicas de alta precisión para un acabado suave y limpio.',
      },
      {
        name: 'Depilación facial completa',
        bookingId: 'depilacion-facial',
        description:
          'Diseño y limpieza del vello facial no deseado, adaptándonos a las necesidades de tu piel para garantizar un resultado terso y libre de irritaciones.',
      },
    ],
  },
  smile: {
    items: [
      {
        name: 'Smile Gem',
        tag: 'Swarovski',
        bookingId: 'smile-gem',
        description:
          'Añade un toque de brillo único y seguro a tu sonrisa. Aplicamos cristales Swarovski auténticos mediante una técnica de adhesión dental profesional, totalmente indolora y respetuosa con tu esmalte.',
        note: 'Valorar según diseño.',
      },
    ],
  },
}

function TreatmentCard({ treatment, onBook, onRequest }) {
  const [open, setOpen] = useState(false)
  const isRequestOnly = treatment.requestOnly
  const ctaLabel = isRequestOnly ? 'Solicitar' : 'Reservar'
  const ctaFullLabel = isRequestOnly ? 'Solicitar cita' : 'Reservar cita'
  const handleCta = () => {
    if (isRequestOnly) onRequest?.()
    else onBook(treatment)
  }

  return (
    <motion.div
      layout
      className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden hover:border-primary/20 transition-colors"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-5 flex items-center justify-between text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h4 className="font-headline text-base font-bold text-on-surface">{treatment.name}</h4>
            {treatment.tag && (
              <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-label whitespace-nowrap">
                {treatment.tag}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {treatment.duration && (
              <div className="flex items-center gap-2">
                <Icon name="schedule" className="text-sm text-on-surface-variant" />
                <span className="text-sm text-on-surface-variant">{treatment.duration}</span>
              </div>
            )}
            {(treatment.bookingId || treatment.bookingIntent) && (
              <motion.span
                whileTap={{ scale: 0.97 }}
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  handleCta()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    handleCta()
                  }
                }}
                className="inline-flex items-center gap-1 text-xs font-label font-bold tracking-wide uppercase text-primary hover:text-primary/80 transition-colors"
              >
                {ctaLabel}
                <Icon name="arrow_forward" className="text-sm" />
              </motion.span>
            )}
          </div>
        </div>
        <Icon
          name={open ? 'expand_less' : 'expand_more'}
          className="text-primary shrink-0 ml-4"
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 space-y-4 border-t border-outline-variant/10 pt-4">
              <p className="text-sm text-on-surface-variant leading-relaxed">{treatment.description}</p>

              {treatment.note && (
                <p className="text-sm italic text-primary/70">{treatment.note}</p>
              )}

              {(treatment.bookingId || treatment.bookingIntent) && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCta}
                  className="w-full flex items-center justify-center gap-2 coral-gradient text-white rounded-2xl py-3.5 font-label text-xs tracking-widest uppercase font-bold editorial-shadow"
                >
                  <span>{ctaFullLabel}</span>
                  <Icon name={isRequestOnly ? 'mail' : 'calendar_month'} className="text-base" />
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function TreatmentsGrid() {
  const [searchParams] = useSearchParams()
  const initialCat = searchParams.get('cat')
  const [activeTab, setActiveTab] = useState(
    initialCat && treatments[initialCat] ? initialCat : 'cejas'
  )
  const { ref, isInView } = useScrollReveal()
  const navigate = useNavigate()
  const tabsRef = useRef(null)
  const microNoticeRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const activeData = treatments[activeTab]
  const hasMicro = activeData.items.some((t) => t.isMicro)

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
  }, [checkScroll])

  const scrollToTab = useCallback((catId) => {
    setActiveTab(catId)
    const container = tabsRef.current
    const activeBtn = container?.querySelector(`[data-cat="${catId}"]`)
    if (activeBtn && container) {
      const offset = activeBtn.offsetLeft - container.offsetWidth / 2 + activeBtn.offsetWidth / 2
      container.scrollTo({ left: offset, behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    const cat = searchParams.get('cat')
    const focus = searchParams.get('focus')
    if (cat && treatments[cat]) {
      scrollToTab(cat)
    }
    if (focus === 'micro') {
      const t = window.setTimeout(() => {
        microNoticeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 350)
      return () => window.clearTimeout(t)
    }
    return undefined
  }, [searchParams, scrollToTab])

  const handleBookTreatment = useCallback((treatment) => {
    if (treatment.bookingIntent) {
      navigate(`/reservar?intent=${encodeURIComponent(treatment.bookingIntent)}`)
      return
    }
    navigate(`/reservar?treatment=${treatment.bookingId}`)
  }, [navigate])

  const handleRequestMicro = useCallback(() => {
    navigate('/solicitar-micro')
  }, [navigate])

  return (
    <section id="treatments" className="py-24 px-6 scroll-mt-24">
      <div className="max-w-5xl mx-auto">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-6"
        >
          <span className="font-label text-xs tracking-[0.3em] uppercase text-primary font-bold mb-4 block">
            Servicios
          </span>
          <h2 className="font-headline text-4xl md:text-5xl text-on-surface mb-4">
            Tratamientos
          </h2>
          <p className="font-body text-on-surface-variant max-w-xl mx-auto text-base">
            Cada tratamiento está pensado para adaptarse a ti, a tu piel y a tus necesidades.
            Si es tu primera vez, no te preocupes, te asesoraré para elegir lo que mejor encaje contigo.
          </p>
        </motion.div>

        {/* Category tabs */}
        <div className="relative mb-10">
          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-linear-to-r from-background to-transparent z-10 pointer-events-none md:hidden" />
          )}
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-linear-to-l from-background to-transparent z-10 pointer-events-none md:hidden" />
          )}
          <div
            ref={tabsRef}
            className="flex gap-2 overflow-x-auto no-scrollbar pb-2 snap-x snap-mandatory scroll-px-1 justify-start md:justify-center"
          >
            {categories.map((cat) => (
              <button
                key={cat.id}
                data-cat={cat.id}
                onClick={() => scrollToTab(cat.id)}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-label font-bold whitespace-nowrap transition-all shrink-0 snap-start ${
                  activeTab === cat.id
                    ? 'bg-primary text-white editorial-shadow'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <Icon name={cat.icon} className="text-sm" />
                {cat.label}
              </button>
            ))}
            <div className="shrink-0 w-4 md:hidden" aria-hidden="true" />
          </div>
        </div>

        {/* Category content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {/* Treatment cards */}
            <div className="space-y-3">
              {activeData.items.map((treatment) => (
                <TreatmentCard
                  key={treatment.bookingId || treatment.bookingIntent || `${treatment.name}-${treatment.tag || ''}`}
                  treatment={treatment}
                  onBook={handleBookTreatment}
                  onRequest={handleRequestMicro}
                />
              ))}
            </div>

            {/* Micropigmentation notice */}
            {hasMicro && (
              <div
                ref={microNoticeRef}
                className="mt-6 bg-primary/5 rounded-2xl p-6 border border-primary/10"
              >
                <div className="flex items-start gap-3">
                  <Icon name="info" className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-on-surface mb-1">Información importante</p>
                    <p className="text-sm text-on-surface-variant">
                      La micropigmentación no se reserva online: solicítala y Nereida te agendará
                      cuando más os convenga. El resultado final se perfecciona en una sesión de
                      retoque.
                    </p>
                    <button
                      onClick={handleRequestMicro}
                      className="mt-3 text-sm font-bold text-primary hover:underline"
                    >
                      Solicitar micropigmentación
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}
