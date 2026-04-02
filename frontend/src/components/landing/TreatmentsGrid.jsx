import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import useScrollReveal from '../../hooks/useScrollReveal'
import Icon from '../ui/Icon'

const categories = [
  { id: 'cejas', label: 'Cejas', icon: 'visibility', image: '/process-brow-mapping.jpeg' },
  { id: 'pestanas', label: 'Pestañas', icon: 'remove_red_eye', image: '/result-lash-lift.jpeg' },
  { id: 'rostro', label: 'Rostro', icon: 'spa', image: '/products-skincare.jpeg' },
  { id: 'depilacion', label: 'Depilación', icon: 'content_cut', image: null },
  { id: 'smile', label: 'Smile Gem', icon: 'diamond', image: '/smile-gem.jpeg' },
]

const treatments = {
  cejas: {
    intro: 'Las cejas enmarcan tu mirada. Mi trabajo es diseñarlas y cuidarlas sin perder su naturalidad.',
    items: [
      {
        name: 'Brow Design',
        tag: 'Perfilado seguimiento',
        duration: '30 min',
        forWhom: 'Personas que quieren mejorar la forma de sus cejas manteniendo su naturalidad.',
        includes: ['Análisis facial', 'Diseño personalizado con visagismo', 'Depilación (hilo/pinza según necesidad)', 'Perfilado limpio y equilibrado'],
        result: 'Cejas más definidas, limpias y en armonía con tu rostro, sin perder tu esencia.',
      },
      {
        name: 'Brow Design',
        tag: 'Perfilado primera vez',
        duration: '60 min',
        forWhom: 'Personas que quieren mejorar la forma de sus cejas manteniendo su naturalidad.',
        includes: ['Análisis facial', 'Diseño personalizado', 'Depilación (hilo/pinza según necesidad)', 'Perfilado limpio y equilibrado'],
        result: 'Cejas más definidas, limpias y en armonía con tu rostro, sin perder tu esencia.',
      },
      {
        name: 'Brow Define',
        tag: 'Diseño + tinte + perfilado',
        duration: '45 min',
        forWhom: 'Ideal si tienes zonas despobladas o quieres más intensidad sin maquillaje.',
        includes: ['Diseño de cejas personalizado', 'Peeling', 'Depilación con hilo', 'Aplicación de tinte', 'Acabado definido'],
        result: 'Cejas más rellenas, definidas y con mayor intensidad de forma natural. Duración en piel de 2-3 días, en pelo hasta un mes.',
        note: 'Ideal si buscas un resultado más natural.',
      },
      {
        name: 'Brow Lami',
        tag: 'Laminado + perfilado',
        duration: '60 min',
        forWhom: 'Para cejas rebeldes, sin forma o con poco volumen.',
        includes: ['Laminado (efecto peinado y fijación)', 'Hidratación del vello', 'Diseño y perfilado'],
        result: 'Cejas más ordenadas, con efecto volumen y mayor definición.',
      },
      {
        name: 'Brow Lami Define',
        tag: 'Laminado + tinte + perfilado',
        duration: '70 min',
        forWhom: 'Para quienes buscan un resultado más marcado y duradero.',
        includes: ['Laminado', 'Tinte', 'Diseño y perfilado', 'Hidratación'],
        result: 'Cejas con efecto maquillaje, más densas, definidas y estructuradas.',
      },
      {
        name: 'Brow Henna',
        tag: 'Henna + perfilado',
        duration: '1 hora',
        forWhom: 'Para quienes buscan un efecto más duradero sobre la piel y mayor definición.',
        includes: ['Diseño de cejas', 'Peeling', 'Aplicación de henna', 'Perfilado'],
        result: 'Efecto maquillaje más marcado, cejas definidas. Duración en piel de 5-7 días (hasta 10 en pieles secas).',
        note: 'Ideal si buscas un efecto más marcado, tipo maquillaje.',
      },
      {
        name: 'Brow Restored',
        tag: 'Dermapen en cejas',
        duration: '50 min',
        forWhom: 'Para mejorar textura de la piel, manchas, marcas o falta de luminosidad.',
        includes: ['Preparación de la piel', 'Tratamiento con dermapen', 'Alta frecuencia', 'Aplicación de activos hidratantes', 'Mascarilla'],
        result: 'Piel más uniforme, renovada y con mejor calidad.',
      },
      {
        name: 'Micropigmentación Soft Pixel Brow',
        tag: 'Efecto sombreado',
        duration: '2h – 2h 30 min',
        forWhom: 'Para personas que buscan unas cejas más definidas, rellenas y con efecto maquillaje suave y natural.',
        includes: ['Estudio y diseño personalizado', 'Elección de forma y tono adaptado al rostro', 'Procedimiento de micropigmentación efecto sombreado', 'Indicaciones de cuidado post tratamiento'],
        result: 'Cejas más densas, definidas y uniformes, con un efecto polvo natural que realza la mirada sin endurecerla.',
        isMicro: true,
      },
      {
        name: 'Nanoblading',
        tag: 'Efecto pelo a pelo',
        duration: '2h – 2h 30 min',
        forWhom: 'Ideal si buscas un resultado muy natural imitando el pelo real, especialmente en cejas con poco vello.',
        includes: ['Diseño personalizado', 'Técnica pelo a pelo', 'Adaptación de forma y color', 'Indicaciones de cuidado'],
        result: 'Cejas hiper naturales, con efecto de pelitos que se integran perfectamente con el vello natural.',
        isMicro: true,
      },
    ],
  },
  pestanas: {
    intro: 'Realza tu mirada sin necesidad de maquillaje.',
    items: [
      {
        name: 'Lash Lift Korean',
        tag: 'Lifting de pestañas coreano + tinte',
        duration: '2 horas',
        forWhom: 'Si quieres realzar tu mirada sin necesidad de maquillaje.',
        includes: ['Lifting de pestañas (curvatura y elevación)', 'Tinte', 'Tratamiento nutritivo'],
        result: 'Pestañas más elevadas, oscuras y definidas. Efecto mirada abierta.',
      },
    ],
  },
  rostro: {
    intro: 'Una piel cuidada se ve y se siente. Los tratamientos faciales están enfocados en limpiar, equilibrar y devolver luminosidad.',
    items: [
      {
        name: 'Skin Reset',
        tag: 'Limpieza facial con cosmética coreana',
        duration: '60-70 min',
        forWhom: 'Para todo tipo de pieles que necesiten limpiar, renovar y equilibrar la piel.',
        includes: ['Limpieza profunda', 'Exfoliación', 'Extracción (si es necesario)', 'Mascarilla y masaje', 'Hidratación final', 'Cosmética coreana respetuosa con tu piel'],
        result: 'Piel más limpia, luminosa y equilibrada desde la primera sesión.',
      },
      {
        name: 'Ritual Glow',
        tag: 'Tratamiento facial avanzado',
        duration: '70-75 min',
        forWhom: 'Para pieles apagadas, deshidratadas o que buscan efecto glow inmediato.',
        includes: ['Limpieza profunda', 'Exfoliación', 'Tratamiento específico (activo según piel)', 'Masaje facial', 'Hidratación intensiva'],
        result: 'Piel luminosa, jugosa y revitalizada. Efecto "buena cara" inmediato.',
      },
      {
        name: 'Skin Boost',
        tag: 'Dermapen facial',
        duration: '50 min',
        forWhom: 'Para mejorar textura, manchas, marcas, reducir arrugas, disminuir poro y producir colágeno.',
        includes: ['Preparación de la piel', 'Tratamiento con dermapen', 'Alta frecuencia', 'Aplicación de activos hidratantes', 'Mascarilla'],
        result: 'Piel más uniforme, renovada y con mejor calidad.',
      },
    ],
  },
  depilacion: {
    intro: 'Eliminación de vello para una piel lisa y luminosa.',
    items: [
      {
        name: 'Labio superior',
        tag: 'Depilación con hilo',
        duration: '10 min',
        forWhom: 'Eliminación de vello en zona del labio.',
        includes: ['Depilación con hilo'],
        result: 'Piel limpia por más tiempo y suave.',
      },
      {
        name: 'Depilación facial',
        tag: 'Depilación completa',
        duration: '30 min',
        forWhom: 'Para eliminar vello facial y mejorar la textura de la piel.',
        includes: ['Depilación facial completa'],
        result: 'Piel más lisa, uniforme y luminosa.',
      },
    ],
  },
  smile: {
    intro: 'Un toque sutil y elegante para tu sonrisa.',
    items: [
      {
        name: 'Smile Gem',
        tag: 'Swarovski',
        duration: '30 min',
        forWhom: 'Para quienes quieren añadir un detalle sutil y elegante a su sonrisa. Diamantes de Swarovski.',
        includes: ['Preparación del diente', 'Colocación de la gema', 'Sellado seguro', 'Elección de diseño'],
        result: 'Una sonrisa más llamativa y especial, con un toque brillante. Duración: hasta 1 año.',
        designs: ['Diamante simple', 'Media mariposa', 'Mariposa completa'],
      },
    ],
  },
}

function TreatmentCard({ treatment }) {
  const [open, setOpen] = useState(false)

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
            <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-label whitespace-nowrap">
              {treatment.tag}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Icon name="schedule" className="text-sm text-on-surface-variant" />
            <span className="text-sm text-on-surface-variant">{treatment.duration}</span>
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
              <div>
                <p className="text-xs font-label font-bold text-primary uppercase tracking-widest mb-1">¿Para quién es?</p>
                <p className="text-sm text-on-surface-variant">{treatment.forWhom}</p>
              </div>

              <div>
                <p className="text-xs font-label font-bold text-primary uppercase tracking-widest mb-2">¿Qué incluye?</p>
                <ul className="space-y-1">
                  {treatment.includes.map((item) => (
                    <li key={item} className="text-sm text-on-surface-variant flex items-start gap-2">
                      <Icon name="check" className="text-primary text-sm shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {treatment.designs && (
                <div>
                  <p className="text-xs font-label font-bold text-primary uppercase tracking-widest mb-2">Elige tu diseño</p>
                  <div className="flex flex-wrap gap-2">
                    {treatment.designs.map((d) => (
                      <span key={d} className="text-sm bg-primary/5 text-on-surface px-3 py-1.5 rounded-xl">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-label font-bold text-primary uppercase tracking-widest mb-1">Resultado esperado</p>
                <p className="text-sm text-on-surface-variant">{treatment.result}</p>
              </div>

              {treatment.note && (
                <p className="text-sm italic text-primary/70">{treatment.note}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function TreatmentsGrid() {
  const [activeTab, setActiveTab] = useState('cejas')
  const { ref, isInView } = useScrollReveal()
  const navigate = useNavigate()
  const tabsRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const activeCat = categories.find((c) => c.id === activeTab)
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

  const scrollToTab = (catId) => {
    setActiveTab(catId)
    const container = tabsRef.current
    const activeBtn = container?.querySelector(`[data-cat="${catId}"]`)
    if (activeBtn && container) {
      const offset = activeBtn.offsetLeft - container.offsetWidth / 2 + activeBtn.offsetWidth / 2
      container.scrollTo({ left: offset, behavior: 'smooth' })
    }
  }

  return (
    <section id="treatments" className="py-24 px-6">
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
            {/* Category image + intro */}
            {activeCat.image && (
              <div className="relative rounded-3xl overflow-hidden mb-8 h-48 md:h-64">
                <img
                  src={activeCat.image}
                  alt={activeCat.label}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <h3 className="font-headline text-2xl text-white mb-1">{activeCat.label}</h3>
                  <p className="text-sm text-white/80">{activeData.intro}</p>
                </div>
              </div>
            )}

            {!activeCat.image && (
              <div className="bg-surface-container-low rounded-3xl p-6 mb-8">
                <h3 className="font-headline text-xl text-on-surface mb-2">{activeCat.label}</h3>
                <p className="text-sm text-on-surface-variant">{activeData.intro}</p>
              </div>
            )}

            {/* Treatment cards */}
            <div className="space-y-3">
              {activeData.items.map((treatment, i) => (
                <TreatmentCard key={`${treatment.name}-${treatment.tag}`} treatment={treatment} />
              ))}
            </div>

            {/* Micropigmentation notice */}
            {hasMicro && (
              <div className="mt-6 bg-primary/5 rounded-2xl p-6 border border-primary/10">
                <div className="flex items-start gap-3">
                  <Icon name="info" className="text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-on-surface mb-1">Información importante</p>
                    <p className="text-sm text-on-surface-variant">
                      Los tratamientos de micropigmentación requieren una valoración previa.
                      El resultado final se perfecciona en una sesión de retoque.
                      Si es tu primera vez, puedes escribirme y te asesoro personalmente.
                    </p>
                    <button
                      onClick={() => navigate('/reservar')}
                      className="mt-3 text-sm font-bold text-primary hover:underline"
                    >
                      Pedir cita de valoración (30 min)
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
