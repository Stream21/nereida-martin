import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const API_URL = import.meta.env.VITE_API_URL || ''
const WHATSAPP_URL =
  'https://wa.me/34641613614?text=' +
  encodeURIComponent(
    'Hola Nereida, me gustaría solicitar información / cita de micropigmentación Soft Pixel Brow.'
  )

export default function MicroRequest() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' })
  const [photo, setPhoto] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const body = new FormData()
      body.append('name', form.name.trim())
      body.append('email', form.email.trim())
      body.append('phone', form.phone.trim())
      body.append('notes', form.notes.trim())
      if (photo) body.append('photo', photo)

      const res = await fetch(`${API_URL}/api/requests/micropigmentation`, {
        method: 'POST',
        body,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar')
      setDone(true)
    } catch (err) {
      setError(err.message || 'Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <Link to="/" className="font-headline text-xl text-on-surface">
            Nereida Martín Studio
          </Link>
          <p className="text-xs font-label tracking-widest uppercase text-primary mt-2">
            Micropigmentación
          </p>
        </div>

        {done ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface-container-lowest rounded-3xl p-8 border border-outline-variant/10 text-center"
          >
            <h1 className="font-headline text-2xl text-on-surface mb-2">Solicitud enviada</h1>
            <p className="text-sm text-on-surface-variant mb-6">
              Hemos recibido tu petición. Nereida te contactará para agendar la sesión cuando más
              os convenga.
            </p>
            <Link
              to="/"
              className="inline-block coral-gradient text-white py-3 px-8 rounded-2xl font-label text-sm tracking-widest uppercase font-bold"
            >
              Volver al inicio
            </Link>
          </motion.div>
        ) : (
          <motion.form
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="bg-surface-container-lowest rounded-3xl p-8 border border-outline-variant/10 space-y-4"
          >
            <h1 className="font-headline text-2xl text-on-surface text-center mb-2">
              Solicitar Soft Pixel Brow
            </h1>
            <p className="text-sm text-on-surface-variant text-center mb-4">
              La micropigmentación no se reserva online. Déjanos tus datos y te contactamos para
              agendar.
            </p>

            <label className="block">
              <span className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
                Nombre
              </span>
              <input
                name="name"
                required
                minLength={2}
                value={form.name}
                onChange={onChange}
                className="mt-1 w-full rounded-2xl border border-outline-variant/20 bg-background px-4 py-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
                Email
              </span>
              <input
                name="email"
                type="email"
                required
                value={form.email}
                onChange={onChange}
                className="mt-1 w-full rounded-2xl border border-outline-variant/20 bg-background px-4 py-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
                Teléfono
              </span>
              <input
                name="phone"
                type="tel"
                required
                value={form.phone}
                onChange={onChange}
                className="mt-1 w-full rounded-2xl border border-outline-variant/20 bg-background px-4 py-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
                Notas (opcional)
              </span>
              <textarea
                name="notes"
                rows={3}
                value={form.notes}
                onChange={onChange}
                className="mt-1 w-full rounded-2xl border border-outline-variant/20 bg-background px-4 py-3 text-sm resize-none"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
                Foto de cejas (opcional)
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                className="mt-1 w-full text-sm text-on-surface-variant"
              />
            </label>

            {error && (
              <div className="bg-red-50 text-red-800 rounded-xl p-3 text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={`w-full coral-gradient text-white py-4 rounded-2xl font-label text-sm tracking-widest uppercase font-bold ${
                submitting ? 'opacity-60' : ''
              }`}
            >
              {submitting ? 'Enviando…' : 'Enviar solicitud'}
            </button>

            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-sm text-primary font-label font-bold hover:underline"
            >
              O escríbeme por WhatsApp
            </a>
          </motion.form>
        )}
      </div>
    </div>
  )
}
