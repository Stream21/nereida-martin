import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import Icon from '../ui/Icon'
import { getClientToken } from '../../utils/clientAuth'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function StepHennaAssessment({
  clientInfo,
  treatmentName,
  onComplete,
  onAssessmentReady,
  error,
}) {
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const inputRef = useRef(null)
  const label = treatmentName || 'tu tratamiento'

  const handleFile = (selected) => {
    if (!selected) return
    if (!/^image\/(jpeg|png|webp)$/.test(selected.type)) {
      setUploadError('Solo imágenes JPEG, PNG o WebP')
      return
    }
    if (selected.size > 5 * 1024 * 1024) {
      setUploadError('La imagen no puede superar 5 MB')
      return
    }
    setUploadError(null)
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
  }

  const handleUpload = async () => {
    if (!file || uploading) return
    setUploading(true)
    setUploadError(null)

    const formData = new FormData()
    formData.append('photo', file)
    formData.append('clientEmail', clientInfo.email)
    formData.append('clientName', clientInfo.name)
    formData.append('clientPhone', clientInfo.phone || '')

    try {
      const token = getClientToken()
      const res = await fetch(`${API_URL}/api/assessments/henna`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setUploadError(data.error || 'Error al subir la foto')
        return
      }
      onAssessmentReady(data.assessmentId)
      onComplete()
    } catch {
      setUploadError('Error de conexión al subir la foto')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <section className="mb-8 text-center">
        <h2 className="font-headline text-2xl md:text-3xl text-on-surface">Valoración con foto</h2>
        <p className="mt-2 text-sm text-on-surface-variant max-w-sm mx-auto">
          Sube una foto clara de tus cejas o zona a tratar para {label}. Tu cita quedará pendiente hasta la revisión.
        </p>
      </section>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-amber-50 border border-amber-200/60 rounded-2xl p-5 mb-6"
      >
        <div className="flex items-start gap-3">
          <Icon name="info" className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900/80 leading-relaxed">
            Podrás elegir fecha y hora, pero la cita no se confirmará hasta la valoración.
            Si no eres apta, cancelaremos la cita y te avisaremos por email.
          </p>
        </div>
      </motion.div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {!preview ? (
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => inputRef.current?.click()}
          className="w-full py-16 rounded-3xl border-2 border-dashed border-primary/30 bg-surface-container-lowest hover:bg-primary/5 transition-colors flex flex-col items-center gap-3"
        >
          <Icon name="add_a_photo" className="text-4xl text-primary/60" />
          <span className="text-sm font-medium text-on-surface">Toca para subir la foto</span>
          <span className="text-xs text-on-surface-variant">JPEG o PNG · máx. 5 MB</span>
        </motion.button>
      ) : (
        <div className="space-y-4">
          <div className="relative rounded-3xl overflow-hidden border border-outline-variant/15 aspect-[4/3] bg-surface-container-low">
            <img src={preview} alt="Vista previa valoración" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => {
                setPreview(null)
                setFile(null)
                if (inputRef.current) inputRef.current.value = ''
              }}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center"
            >
              <Icon name="close" className="text-lg" />
            </button>
          </div>
          <motion.button
            type="button"
            whileTap={uploading ? {} : { scale: 0.98 }}
            onClick={handleUpload}
            disabled={uploading}
            className={`w-full coral-gradient text-white py-4 rounded-2xl font-label text-sm tracking-widest uppercase font-bold editorial-shadow flex items-center justify-center gap-2 ${
              uploading ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                <span>Subiendo...</span>
              </>
            ) : (
              <span>Continuar con esta foto</span>
            )}
          </motion.button>
        </div>
      )}

      {(uploadError || error) && (
        <p className="mt-4 text-sm text-red-500 text-center">{uploadError || error}</p>
      )}
    </div>
  )
}
