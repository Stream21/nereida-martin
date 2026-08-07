import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Icon from '../ui/Icon'
import SignaturePad from './SignaturePad'

const API_URL = import.meta.env.VITE_API_URL || ''

const fieldVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35 },
  }),
}

function QuestionField({ question, value, onChange, index }) {
  const { id, type, label, required, placeholder, options } = question

  if (type === 'yes_no') {
    return (
      <motion.div custom={index} variants={fieldVariants} initial="hidden" animate="visible">
        <label className="block text-sm font-medium text-on-surface mb-2">
          {label}
          {required && <span className="text-primary"> *</span>}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'yes', label: 'Sí' },
            { value: 'no', label: 'No' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(id, opt.value)}
              className={`py-3.5 rounded-2xl text-sm font-medium border transition-colors ${
                value === opt.value
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface-container-lowest border-outline-variant/15 text-on-surface hover:border-primary/30'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </motion.div>
    )
  }

  if (type === 'boolean') {
    return (
      <motion.label
        custom={index}
        variants={fieldVariants}
        initial="hidden"
        animate="visible"
        className="flex items-start gap-3 cursor-pointer p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/10"
      >
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(id, e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded text-primary focus:ring-primary/30"
        />
        <span className="text-sm text-on-surface leading-relaxed">
          {label}
          {required && <span className="text-primary"> *</span>}
        </span>
      </motion.label>
    )
  }

  if (type === 'select') {
    return (
      <motion.div custom={index} variants={fieldVariants} initial="hidden" animate="visible">
        <label className="block text-sm font-medium text-on-surface mb-2">
          {label}
          {required && <span className="text-primary"> *</span>}
        </label>
        <select
          value={value || ''}
          onChange={(e) => onChange(id, e.target.value)}
          className="w-full px-4 py-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/15 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Selecciona una opción</option>
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </motion.div>
    )
  }

  return (
    <motion.div custom={index} variants={fieldVariants} initial="hidden" animate="visible">
      <label className="block text-sm font-medium text-on-surface mb-2">
        {label}
        {required && <span className="text-primary"> *</span>}
      </label>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(id, e.target.value)}
        placeholder={placeholder || ''}
        rows={3}
        className="w-full px-4 py-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/15 text-on-surface placeholder:text-outline-variant/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
      />
    </motion.div>
  )
}

export default function StepQuestionnaire({
  intakeType,
  category,
  treatmentId,
  answers,
  onChange,
  onComplete,
  onSignatureChange,
  signature,
  signerName,
  onSignerNameChange,
  error,
}) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [validationError, setValidationError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setLoadError(null)
    const url = intakeType === 'studio'
      ? `${API_URL}/api/intake/studio`
      : `${API_URL}/api/intake/treatment/${category}?treatmentId=${treatmentId || ''}`

    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error('fetch failed')
        return res.json()
      })
      .then((data) => setQuestions(data.questions || []))
      .catch(() => setLoadError('No se pudo cargar el cuestionario'))
      .finally(() => setLoading(false))
  }, [intakeType, category, treatmentId])

  const handleChange = (id, value) => {
    onChange({ ...answers, [id]: value })
    setValidationError(null)
  }

  const validate = () => {
    for (const q of questions) {
      if (!q.required) continue
      const val = answers[q.id]
      if (q.type === 'boolean') {
        if (val !== true) return `Debes confirmar: ${q.label}`
      } else if (q.type === 'yes_no') {
        if (val !== 'yes' && val !== 'no') return `Responde: ${q.label}`
      } else if (!val || (typeof val === 'string' && !val.trim())) {
        return `Responde: ${q.label}`
      }
    }
    if (!signerName?.trim() || signerName.trim().length < 2) {
      return 'Indica tu nombre para la firma'
    }
    if (!signature) {
      return 'Debes firmar el cuestionario'
    }
    return null
  }

  const handleSubmit = () => {
    const err = validate()
    if (err) {
      setValidationError(err)
      return
    }
    onComplete({
      signature: { dataUrl: signature, signerName: signerName.trim() },
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="text-center py-16">
        <Icon name="error_outline" className="text-4xl text-on-surface-variant/50 mb-4" />
        <p className="text-sm text-on-surface-variant">{loadError}</p>
      </div>
    )
  }

  return (
    <div>
      <section className="mb-8 text-center">
        <h2 className="font-headline text-2xl md:text-3xl text-on-surface">Cuestionario de aptitud</h2>
        <p className="mt-2 text-sm text-on-surface-variant max-w-md mx-auto">
          Primera vez en este tratamiento — responde con sinceridad y firma al final para confirmar.
        </p>
      </section>

      <div className="space-y-4">
        {questions.map((q, i) => (
          <QuestionField
            key={q.id}
            question={q}
            value={answers[q.id]}
            onChange={handleChange}
            index={i}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: questions.length * 0.05 }}
        className="mt-6 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/10"
      >
        <SignaturePad
          value={signature}
          onChange={onSignatureChange}
          signerName={signerName}
          onSignerNameChange={onSignerNameChange}
        />
      </motion.div>

      {(validationError || error) && (
        <p className="mt-4 text-sm text-red-500">{validationError || error}</p>
      )}

      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        onClick={handleSubmit}
        className="mt-8 w-full coral-gradient text-white py-4 rounded-2xl font-label text-sm tracking-widest uppercase font-bold editorial-shadow"
      >
        Continuar
      </motion.button>
    </div>
  )
}
