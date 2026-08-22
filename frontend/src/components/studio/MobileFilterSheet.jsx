import { AnimatePresence, motion } from 'framer-motion'
import Icon from '../ui/Icon'

/**
 * Bottom sheet for filters on mobile (Material / iOS pattern).
 */
export default function MobileFilterSheet({
  open,
  onClose,
  title = 'Filtros',
  activeCount = 0,
  onClear,
  children,
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Cerrar filtros"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-on-surface/35 sm:hidden"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            className="fixed inset-x-0 bottom-0 z-50 sm:hidden rounded-t-3xl bg-surface-container-lowest shadow-[0_-8px_40px_rgba(28,25,23,0.12)] max-h-[min(88dvh,640px)] flex flex-col safe-pb"
          >
            <div className="flex items-center justify-center pt-2 pb-1">
              <span className="w-10 h-1 rounded-full bg-outline-variant/60" aria-hidden />
            </div>
            <div className="flex items-center justify-between gap-3 px-4 pb-3 border-b border-outline-variant/20">
              <div className="min-w-0">
                <h3 className="font-headline text-lg text-on-surface">{title}</h3>
                {activeCount > 0 && (
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {activeCount} filtro{activeCount === 1 ? '' : 's'} activo{activeCount === 1 ? '' : 's'}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer min-h-11 min-w-11 rounded-full hover:bg-surface-container flex items-center justify-center shrink-0"
                aria-label="Cerrar"
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
              {children}
            </div>
            {(onClear || activeCount > 0) && (
              <div className="shrink-0 px-4 pt-2 pb-3 border-t border-outline-variant/20 flex gap-2">
                {activeCount > 0 && onClear && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="cursor-pointer flex-1 min-h-12 rounded-2xl border border-outline-variant/40 text-sm font-medium text-on-surface-variant"
                  >
                    Limpiar
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer flex-1 min-h-12 rounded-2xl bg-primary text-on-primary text-sm font-medium"
                >
                  Ver resultados
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
