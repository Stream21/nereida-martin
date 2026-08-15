import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Icon from '../ui/Icon'
import { ownerUploadUrl } from '../../utils/ownerApi'
import { formatStudioDateTime, photoSourceLabel, photoStatusLabel } from '../../utils/studioFormat'

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 380, damping: 28 },
  },
}

function PhotoLightbox({ photo, onClose }) {
  const src = ownerUploadUrl(photo.photoUrl || photo.photoPath)
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-on-surface/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Foto ampliada"
    >
      <button
        type="button"
        onClick={onClose}
        className="cursor-pointer absolute top-4 right-4 p-2.5 min-h-11 min-w-11 rounded-full bg-surface-container-lowest text-on-surface"
        aria-label="Cerrar"
      >
        <Icon name="close" />
      </button>
      <img
        src={src}
        alt="Foto de valoración"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] max-w-full rounded-2xl object-contain shadow-[0_20px_50px_rgba(28,25,23,0.35)]"
      />
    </div>
  )
}

export default function AssessmentPhotos({ photos }) {
  const [open, setOpen] = useState(null)
  const list = photos || []

  if (list.length === 0) {
    return (
      <p className="text-sm text-on-surface-variant">
        Esta cita no tiene fotos de valoración.
      </p>
    )
  }

  return (
    <>
      <motion.ul
        variants={listVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-3"
      >
        {list.map((photo) => {
          const src = ownerUploadUrl(photo.photoUrl || photo.photoPath)
          return (
            <motion.li
              key={photo.id}
              variants={itemVariants}
              className="rounded-3xl border border-outline-variant/25 bg-surface-container-low overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpen(photo)}
                className="cursor-pointer w-full block"
              >
                <img
                  src={src}
                  alt="Foto enviada por la clienta"
                  className="w-full max-h-72 object-cover bg-surface-container"
                />
              </button>
              <div className="px-4 py-3 space-y-1">
                <p className="text-xs font-medium text-on-surface">
                  {photoSourceLabel(photo.source)}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {photoStatusLabel(photo.status)}
                  {photo.createdAt ? ` · ${formatStudioDateTime(photo.createdAt)}` : ''}
                </p>
                {photo.notes ? (
                  <p className="text-sm text-on-surface pt-1 whitespace-pre-wrap">{photo.notes}</p>
                ) : null}
              </div>
            </motion.li>
          )
        })}
      </motion.ul>

      <AnimatePresence>
        {open && (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <PhotoLightbox photo={open} onClose={() => setOpen(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export { PhotoLightbox }
