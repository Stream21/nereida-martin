import { motion } from 'framer-motion'
import Icon from '../ui/Icon'
import { formatStudioDateTime } from '../../utils/studioFormat'

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

export default function IntakeAnswers({ intake }) {
  if (!intake) {
    return (
      <p className="text-sm text-on-surface-variant">
        Esta cita no tiene cuestionario de aptitud.
      </p>
    )
  }

  const answers = intake.answers || []

  return (
    <div className="space-y-4">
      {intake.flagged && (
        <div className="flex items-start gap-3 rounded-2xl bg-error-container/70 px-4 py-3">
          <Icon name="warning" className="text-error text-xl shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-error">Revisar respuestas</p>
            {intake.flagReason && (
              <p className="text-xs text-on-surface mt-1 leading-relaxed">{intake.flagReason}</p>
            )}
          </div>
        </div>
      )}

      {answers.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No hay respuestas registradas.</p>
      ) : (
        <motion.ul
          variants={listVariants}
          initial="hidden"
          animate="show"
          className="space-y-2"
        >
          {answers.map((item) => (
            <motion.li
              key={item.id}
              variants={itemVariants}
              className="rounded-2xl bg-surface-container-low border border-outline-variant/20 px-4 py-3"
            >
              <p className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
                {item.label}
              </p>
              <p className="text-sm text-on-surface mt-1 whitespace-pre-wrap break-words">
                {item.displayValue || '—'}
              </p>
            </motion.li>
          ))}
        </motion.ul>
      )}

      {(intake.signatureData || intake.signerName || intake.signedAt) && (
        <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest px-4 py-4 space-y-3">
          <p className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
            Firma
          </p>
          {intake.signatureData && (
            <img
              src={intake.signatureData}
              alt={`Firma de ${intake.signerName || 'la clienta'}`}
              className="w-full max-h-28 object-contain bg-white rounded-xl border border-outline-variant/20"
            />
          )}
          <p className="text-sm text-on-surface">
            {intake.signerName || 'Firmado'}
            {intake.signedAt ? ` · ${formatStudioDateTime(intake.signedAt)}` : ''}
          </p>
        </div>
      )}
    </div>
  )
}
