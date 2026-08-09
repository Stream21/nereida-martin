import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import useScrollReveal from '../../hooks/useScrollReveal'
import Icon from '../ui/Icon'
import CompareTap from '../ui/CompareTap'

const galleryById = {
  'brow-mapping': {
    id: 'brow-mapping',
    type: 'photo',
    src: '/process-brow-mapping.jpeg',
    position: 'center 32%',
    label: 'Visagismo',
  },
  'brow-lami': {
    id: 'brow-lami',
    type: 'photo',
    src: '/result-brow-lami.jpeg',
    position: 'center 35%',
    label: 'Brow Lami',
  },
  'lash-compare': {
    id: 'lash-compare',
    type: 'compare',
    before: '/lifting-con-tinte-pestanas-antes.jpeg',
    after: '/lifting-con-tinte-pestanas-despues.jpeg',
    position: 'center 36%',
    label: 'Lifting de pestañas',
  },
  'lash-result': {
    id: 'lash-result',
    type: 'photo',
    src: '/result-lash-lift.jpeg',
    position: 'center 40%',
    label: 'Lifting koreano',
  },
  'brows-female': {
    id: 'brows-female',
    type: 'photo',
    src: '/result-brows-female.jpeg',
    position: 'center 30%',
    label: 'Micropigmentación soft pixel',
  },
  'micro-compare': {
    id: 'micro-compare',
    type: 'compare',
    before: '/micro-antes.jpeg',
    after: '/micro-despues.jpeg',
    position: 'center 22%',
    label: 'Micropigmentación',
  },
  'henna-compare': {
    id: 'henna-compare',
    type: 'compare',
    before: '/henna_1_antes.jpeg',
    after: '/henna_1_despues.jpeg',
    position: 'center 35%',
    label: 'Brow Henna',
  },
  'brows-male': {
    id: 'brows-male',
    type: 'photo',
    src: '/result-brows-male.jpeg',
    position: 'center 30%',
    label: 'Cejas masculinas',
  },
  'skincare': {
    id: 'skincare',
    type: 'photo',
    src: '/products-skincare.jpeg',
    position: 'center 48%',
    label: 'Skin reset',
  },
  facial: {
    id: 'facial',
    type: 'photo',
    src: '/treatment-facial.jpeg',
    position: 'center 45%',
    label: 'Laminado en proceso',
  },
  smile: {
    id: 'smile',
    type: 'photo',
    src: '/smile-gem.jpeg',
    position: 'center 55%',
    label: 'Smile gem',
  },
  studio: {
    id: 'studio',
    type: 'photo',
    src: '/studio-interior.jpeg',
    position: 'center 50%',
    label: 'El estudio',
  },
  tools: {
    id: 'tools',
    type: 'photo',
    src: '/tools-tray.jpeg',
    position: 'center 50%',
    label: 'Detalle',
  },
  decor: {
    id: 'decor',
    type: 'photo',
    src: '/studio-decor.jpeg',
    position: 'center 50%',
    label: 'Ambiente',
  },
}

/** Filas explícitas: sin spans sueltos → sin huecos en blanco */
const galleryRows = [
  { type: 'full', aspect: 'aspect-[5/4]', ids: ['lash-compare'] },
  { type: 'pair', aspect: 'aspect-[4/5]', ids: ['brow-mapping', 'brow-lami'] },
  { type: 'pair', aspect: 'aspect-[4/5]', ids: ['lash-result', 'brows-female'] },
  { type: 'full', aspect: 'aspect-[5/4]', ids: ['micro-compare'] },
  { type: 'full', aspect: 'aspect-[5/4]', ids: ['henna-compare'] },
  { type: 'pair', aspect: 'aspect-[4/5]', ids: ['brows-male', 'facial'] },
  { type: 'pair', aspect: 'aspect-[4/5]', ids: ['smile', 'skincare'] },
  { type: 'full', aspect: 'aspect-[21/9]', ids: ['studio'] },
  { type: 'pair', aspect: 'aspect-[4/5]', ids: ['tools', 'decor'] },
]

const galleryItems = galleryRows.flatMap((row) =>
  row.ids.map((id) => galleryById[id]).filter(Boolean)
)

const tileVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] },
  }),
}

function GalleryTile({ item, index, aspect, onOpen, reducedMotion }) {
  if (item.type === 'compare') {
    return (
      <motion.div
        custom={index}
        variants={tileVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-24px' }}
        className={`relative w-full ${aspect} rounded-2xl md:rounded-3xl overflow-hidden editorial-shadow border border-outline-variant/8`}
      >
        <CompareTap
          before={item.before}
          after={item.after}
          objectPosition={item.position || 'center'}
          className="absolute inset-0 w-full h-full"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

        <span className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-white/92 backdrop-blur-md text-on-surface text-[9px] font-label font-bold tracking-[0.1em] uppercase px-2.5 py-1 rounded-full pointer-events-none z-10">
          <Icon name="compare" className="text-primary text-xs" />
          Antes / Después
        </span>

        <span className="absolute bottom-2.5 left-2.5 right-2.5 flex items-end justify-between gap-2 pointer-events-none z-10">
          <span className="text-[10px] font-label font-bold tracking-[0.08em] uppercase text-white/90 drop-shadow-sm truncate">
            {item.label}
          </span>
          <motion.button
            type="button"
            whileTap={reducedMotion ? {} : { scale: 0.92 }}
            onClick={() => onOpen(item.id)}
            className="shrink-0 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center pointer-events-auto editorial-shadow"
            aria-label={`Ampliar comparativa: ${item.label}`}
          >
            <Icon name="zoom_in" className="text-primary text-base" />
          </motion.button>
        </span>
      </motion.div>
    )
  }

  const src = item.src

  return (
    <motion.button
      type="button"
      custom={index}
      variants={tileVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-24px' }}
      whileTap={reducedMotion ? {} : { scale: 0.985 }}
      onClick={() => onOpen(item.id)}
      className={`relative w-full ${aspect} rounded-2xl md:rounded-3xl overflow-hidden editorial-shadow group text-left border border-outline-variant/8`}
      aria-label={item.type === 'compare' ? `Ver comparativa: ${item.label}` : `Ampliar: ${item.label}`}
    >
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        style={{ objectPosition: item.position || 'center' }}
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/45 via-black/5 to-transparent" />

      <span className="absolute bottom-2.5 left-2.5 right-2.5 flex items-end justify-between gap-2">
        <span className="text-[10px] font-label font-bold tracking-[0.08em] uppercase text-white/90 drop-shadow-sm truncate">
          {item.label}
        </span>
        <span className="shrink-0 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center opacity-90">
          <Icon name="zoom_in" className="text-primary text-base" />
        </span>
      </span>
    </motion.button>
  )
}

function Lightbox({ item, onClose, onPrev, onNext, hasPrev, hasNext }) {
  const [showAfter, setShowAfter] = useState(false)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    setShowAfter(false)
  }, [item?.id])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onPrev()
      if (e.key === 'ArrowRight' && hasNext) onNext()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, onPrev, onNext, hasPrev, hasNext])

  if (!item) return null

  const isCompare = item.type === 'compare'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-on-surface/75 backdrop-blur-xl" />

      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={onClose}
        className="absolute top-5 right-5 z-20 w-11 h-11 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center editorial-shadow"
        aria-label="Cerrar"
      >
        <Icon name="close" className="text-on-surface" />
      </motion.button>

      {hasPrev && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={(e) => { e.stopPropagation(); onPrev() }}
          className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center editorial-shadow"
          aria-label="Anterior"
        >
          <Icon name="chevron_left" className="text-on-surface" />
        </motion.button>
      )}

      {hasNext && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={(e) => { e.stopPropagation(); onNext() }}
          className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center editorial-shadow"
          aria-label="Siguiente"
        >
          <Icon name="chevron_right" className="text-on-surface" />
        </motion.button>
      )}

      <motion.div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-4xl max-h-[82vh] rounded-3xl editorial-shadow bg-surface-container-lowest overflow-hidden"
      >
        {isCompare ? (
          <>
            <CompareTap
              before={item.before}
              after={item.after}
              objectPosition={item.position || 'center'}
              className="w-full min-h-[50vh] max-h-[82vh] aspect-[4/3] sm:aspect-[16/10]"
              fit="contain"
              showAfter={showAfter}
              onShowAfterChange={setShowAfter}
            />
            <div className="absolute inset-x-0 bottom-0 flex justify-center pb-5 pt-12 bg-linear-to-t from-black/50 to-transparent pointer-events-none">
              <motion.button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowAfter((v) => !v)
                }}
                whileTap={{ scale: 0.93 }}
                whileHover={reducedMotion ? {} : { scale: 1.04 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                className="pointer-events-auto flex items-center gap-2 px-6 py-3 rounded-full bg-white/95 backdrop-blur-md editorial-shadow font-label text-xs sm:text-sm font-bold tracking-widest uppercase text-on-surface"
              >
                <Icon name="swap_horiz" className="text-primary text-base" />
                {showAfter ? 'Ver Antes' : 'Ver Después'}
              </motion.button>
            </div>
          </>
        ) : (
          <img
            src={item.src}
            alt={item.label || ''}
            className="block w-full max-h-[82vh] object-contain bg-surface-container-lowest"
            draggable={false}
          />
        )}
      </motion.div>
    </motion.div>
  )
}

export default function StudioGallery() {
  const { ref, isInView } = useScrollReveal()
  const reducedMotion = useReducedMotion()
  const [activeId, setActiveId] = useState(null)

  const activeIndex = galleryItems.findIndex((g) => g.id === activeId)
  const activeItem = activeIndex >= 0 ? galleryItems[activeIndex] : null

  const open = useCallback((id) => setActiveId(id), [])
  const close = useCallback(() => setActiveId(null), [])
  const goPrev = useCallback(() => {
    if (activeIndex > 0) setActiveId(galleryItems[activeIndex - 1].id)
  }, [activeIndex])
  const goNext = useCallback(() => {
    if (activeIndex < galleryItems.length - 1) setActiveId(galleryItems[activeIndex + 1].id)
  }, [activeIndex])

  let tileIndex = 0

  return (
    <section id="gallery" className="py-20 md:py-24 px-5 md:px-6 bg-surface-container-low overflow-hidden">
      <div className="max-w-3xl mx-auto">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-10 md:mb-12"
        >
          <span className="font-label text-xs tracking-[0.3em] uppercase text-primary font-bold mb-4 block">
            Galería
          </span>
          <h2 className="font-headline text-3xl md:text-5xl text-on-surface">
            El estudio, <span className="italic">en imágenes</span>
          </h2>
          <p className="font-body text-sm md:text-base text-on-surface-variant mt-3 max-w-sm mx-auto">
            Toca las comparativas para alternar antes y después. Usa el zoom para ampliar.
          </p>
        </motion.div>

        <div className="flex flex-col gap-2.5 md:gap-3">
          {galleryRows.map((row) => {
            const items = row.ids.map((id) => galleryById[id]).filter(Boolean)

            if (row.type === 'full') {
              const item = items[0]
              const idx = tileIndex++
              return (
                <GalleryTile
                  key={item.id}
                  item={item}
                  index={idx}
                  aspect={row.aspect}
                  onOpen={open}
                  reducedMotion={reducedMotion}
                />
              )
            }

            return (
              <div key={row.ids.join('-')} className="grid grid-cols-2 gap-2.5 md:gap-3">
                {items.map((item) => {
                  const idx = tileIndex++
                  return (
                    <GalleryTile
                      key={item.id}
                      item={item}
                      index={idx}
                      aspect={row.aspect}
                      onOpen={open}
                      reducedMotion={reducedMotion}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      <AnimatePresence>
        {activeItem && (
          <Lightbox
            item={activeItem}
            onClose={close}
            onPrev={goPrev}
            onNext={goNext}
            hasPrev={activeIndex > 0}
            hasNext={activeIndex < galleryItems.length - 1}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
