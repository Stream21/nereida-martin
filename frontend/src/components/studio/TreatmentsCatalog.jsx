import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Icon from '../ui/Icon'
import {
  createOwnerTreatment,
  fetchOwnerTreatmentsCatalog,
  reorderOwnerTreatments,
  updateOwnerTreatment,
} from '../../utils/ownerApi'
import { formatEuro } from '../../utils/studioFormat'

const CATEGORY_LABELS = {
  cejas: 'Cejas',
  pestanas: 'Pestañas',
  rostro: 'Rostro',
  depilacion: 'Depilación',
  smile: 'Smile',
  general: 'General',
}

const fieldClass =
  'w-full rounded-2xl border border-outline-variant/40 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary min-h-11'

const emptyForm = {
  id: '',
  category: 'cejas',
  name: '',
  tag: '',
  durationMin: 45,
  durationMax: '',
  price: '',
  active: true,
  ownerOnly: false,
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

function formatDuration(min, max) {
  const fmt = (m) => {
    if (m == null) return ''
    if (m >= 60) {
      const h = Math.floor(m / 60)
      const r = m % 60
      return r > 0 ? `${h} h ${r} min` : `${h} h`
    }
    return `${m} min`
  }
  if (!max || max === min) return fmt(min)
  return `${fmt(min)} – ${fmt(max)}`
}

function TreatmentFormModal({ mode, initial, categories, onClose, onSaved }) {
  const isEdit = mode === 'edit'
  const [form, setForm] = useState(() =>
    initial
      ? {
          id: initial.id,
          category: initial.category,
          name: initial.name || '',
          tag: initial.tag || '',
          durationMin: initial.durationMin ?? 45,
          durationMax: initial.durationMax ?? '',
          price: initial.price ?? '',
          active: initial.active !== false,
          ownerOnly: Boolean(initial.ownerOnly),
        }
      : { ...emptyForm }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [idTouched, setIdTouched] = useState(false)

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = {
        category: form.category,
        name: form.name.trim(),
        tag: form.tag.trim() || null,
        durationMin: Number(form.durationMin),
        durationMax: form.durationMax === '' ? null : Number(form.durationMax),
        price: form.price === '' ? null : Number(form.price),
        active: Boolean(form.active),
        ownerOnly: Boolean(form.ownerOnly),
      }
      if (isEdit) {
        await updateOwnerTreatment(form.id, payload)
      } else {
        await createOwnerTreatment({
          ...payload,
          id: form.id.trim().toLowerCase(),
        })
      }
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-on-surface/35 backdrop-blur-[2px] p-0 sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full sm:max-w-md max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-surface-container-lowest shadow-[0_20px_50px_rgba(67,61,60,0.14)] p-5 sm:p-6 space-y-4 safe-pb"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-headline text-xl text-on-surface">
            {isEdit ? 'Editar servicio' : 'Nuevo servicio'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer p-2.5 min-h-11 min-w-11 rounded-full hover:bg-surface-container"
            aria-label="Cerrar"
          >
            <Icon name="close" />
          </button>
        </div>

        {!isEdit && (
          <label className="block">
            <span className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
              Identificador
            </span>
            <input
              required
              value={form.id}
              onChange={(e) => {
                setIdTouched(true)
                setField('id', slugify(e.target.value))
              }}
              placeholder="ej. brow-nuevo"
              className={`${fieldClass} mt-1.5 font-mono text-xs`}
            />
            <span className="text-[11px] text-on-surface-variant mt-1 block">
              No se puede cambiar después. Solo minúsculas, números y guiones.
            </span>
          </label>
        )}

        <label className="block">
          <span className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
            Nombre
          </span>
          <input
            required
            value={form.name}
            onChange={(e) => {
              const name = e.target.value
              setField('name', name)
              if (!isEdit && !idTouched) setField('id', slugify(name))
            }}
            className={`${fieldClass} mt-1.5`}
          />
        </label>

        <label className="block">
          <span className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
            Categoría
          </span>
          <select
            value={form.category}
            onChange={(e) => setField('category', e.target.value)}
            className={`${fieldClass} mt-1.5`}
          >
            {(categories.length ? categories : Object.keys(CATEGORY_LABELS)).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c] || c}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
            Etiqueta / subtítulo
          </span>
          <input
            value={form.tag}
            onChange={(e) => setField('tag', e.target.value)}
            placeholder="Ej. Laminado + perfilado"
            className={`${fieldClass} mt-1.5`}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
              Duración (min)
            </span>
            <input
              type="number"
              required
              min={5}
              max={480}
              step={5}
              value={form.durationMin}
              onChange={(e) => setField('durationMin', e.target.value)}
              className={`${fieldClass} mt-1.5`}
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
              Duración máx.
            </span>
            <input
              type="number"
              min={5}
              max={480}
              step={5}
              value={form.durationMax}
              onChange={(e) => setField('durationMax', e.target.value)}
              placeholder="Opcional"
              className={`${fieldClass} mt-1.5`}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
            Precio (€)
          </span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={form.price}
            onChange={(e) => setField('price', e.target.value)}
            placeholder="Vacío = sin precio fijo"
            className={`${fieldClass} mt-1.5`}
          />
        </label>

        <div className="space-y-2">
          <label className="flex items-center gap-3 min-h-11 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setField('active', e.target.checked)}
              className="size-5 rounded border-outline-variant accent-primary"
            />
            <span className="text-sm text-on-surface">Activo (visible para reservar)</span>
          </label>
          <label className="flex items-center gap-3 min-h-11 cursor-pointer">
            <input
              type="checkbox"
              checked={form.ownerOnly}
              disabled={form.id === 'perfilado-grupo'}
              onChange={(e) => setField('ownerOnly', e.target.checked)}
              className="size-5 rounded border-outline-variant accent-primary"
            />
            <span className="text-sm text-on-surface">Solo panel (no aparece online)</span>
          </label>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="cursor-pointer w-full rounded-2xl bg-primary text-on-primary py-3.5 min-h-12 text-sm font-medium disabled:opacity-60"
        >
          {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear servicio'}
        </button>
      </form>
    </div>
  )
}

export default function TreatmentsCatalog() {
  const [treatments, setTreatments] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchOwnerTreatmentsCatalog()
      setTreatments(res.treatments || [])
      setCategories(res.categories || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const visible = useMemo(() => {
    if (filter === 'active') return treatments.filter((t) => t.active)
    if (filter === 'inactive') return treatments.filter((t) => !t.active)
    return treatments
  }, [treatments, filter])

  const move = async (index, direction) => {
    const list = [...treatments]
    const from = treatments.findIndex((t) => t.id === visible[index]?.id)
    if (from < 0) return
    const to = from + direction
    if (to < 0 || to >= list.length) return

    const swapped = [...list]
    ;[swapped[from], swapped[to]] = [swapped[to], swapped[from]]
    const items = swapped.map((t, i) => ({
      id: t.id,
      displayOrder: (i + 1) * 10,
    }))

    setBusyId(visible[index].id)
    setTreatments(swapped.map((t, i) => ({ ...t, displayOrder: (i + 1) * 10 })))
    try {
      const res = await reorderOwnerTreatments(items)
      setTreatments(res.treatments || swapped)
    } catch (err) {
      setError(err.message)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const toggleActive = async (treatment) => {
    if (treatment.id === 'imported') return
    setBusyId(treatment.id)
    setError('')
    try {
      const res = await updateOwnerTreatment(treatment.id, {
        active: !treatment.active,
      })
      setTreatments((prev) =>
        prev.map((t) => (t.id === treatment.id ? res.treatment : t))
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="font-headline text-xl text-on-surface">Catálogo</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Alta, edición, retiro y orden de los servicios en la reserva.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ mode: 'create' })}
          className="cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-2xl bg-primary text-on-primary px-4 py-2.5 min-h-11 text-sm font-medium shrink-0"
        >
          <Icon name="add" className="text-lg" />
          Nuevo servicio
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'Todos' },
          { id: 'active', label: 'Activos' },
          { id: 'inactive', label: 'Retirados' },
        ].map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setFilter(opt.id)}
            className={`cursor-pointer shrink-0 rounded-full px-3.5 py-2 text-xs font-medium min-h-10 ${
              filter === opt.id
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-low text-on-surface-variant'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-error bg-error-container/40 rounded-2xl px-3 py-2">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-on-surface-variant py-8 text-center">Cargando catálogo…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-on-surface-variant py-8 text-center">No hay servicios en este filtro.</p>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {visible.map((t, index) => {
              const globalIndex = treatments.findIndex((x) => x.id === t.id)
              const canUp = globalIndex > 0
              const canDown = globalIndex < treatments.length - 1 && globalIndex >= 0
              return (
                <motion.li
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`rounded-2xl border border-outline-variant/25 bg-surface-container-lowest px-3.5 py-3 sm:px-4 ${
                    t.active ? '' : 'opacity-70'
                  }`}
                >
                  <div className="flex gap-2 sm:gap-3">
                    <div className="flex flex-col gap-1 shrink-0 pt-0.5">
                      <button
                        type="button"
                        disabled={!canUp || busyId === t.id || filter !== 'all'}
                        onClick={() => move(index, -1)}
                        className="cursor-pointer min-h-9 min-w-9 rounded-lg hover:bg-surface-container disabled:opacity-30 flex items-center justify-center"
                        aria-label="Subir"
                      >
                        <Icon name="keyboard_arrow_up" />
                      </button>
                      <button
                        type="button"
                        disabled={!canDown || busyId === t.id || filter !== 'all'}
                        onClick={() => move(index, 1)}
                        className="cursor-pointer min-h-9 min-w-9 rounded-lg hover:bg-surface-container disabled:opacity-30 flex items-center justify-center"
                        aria-label="Bajar"
                      >
                        <Icon name="keyboard_arrow_down" />
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-medium text-on-surface">{t.name}</p>
                        {!t.active && (
                          <span className="text-[10px] uppercase tracking-wide rounded-full bg-surface-container px-2 py-0.5 text-on-surface-variant">
                            Retirado
                          </span>
                        )}
                        {t.ownerOnly && (
                          <span className="text-[10px] uppercase tracking-wide rounded-full bg-primary/12 text-primary px-2 py-0.5">
                            Solo panel
                          </span>
                        )}
                        {t.protected && (
                          <span className="text-[10px] uppercase tracking-wide rounded-full bg-amber-50 text-amber-900 px-2 py-0.5">
                            Especial
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {CATEGORY_LABELS[t.category] || t.category}
                        {t.tag ? ` · ${t.tag}` : ''}
                      </p>
                      <p className="text-xs text-on-surface-variant mt-1 tabular-nums">
                        {formatDuration(t.durationMin, t.durationMax)}
                        {' · '}
                        {t.price != null ? formatEuro(t.price) : 'Sin precio fijo'}
                        <span className="text-on-surface-variant/70"> · {t.id}</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setModal({ mode: 'edit', treatment: t })}
                      className="cursor-pointer rounded-xl border border-outline-variant/40 px-3 py-2 text-xs font-medium min-h-10 text-on-surface hover:bg-surface-container-low"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={busyId === t.id || t.id === 'imported'}
                      onClick={() => toggleActive(t)}
                      className="cursor-pointer rounded-xl border border-outline-variant/40 px-3 py-2 text-xs font-medium min-h-10 text-on-surface hover:bg-surface-container-low disabled:opacity-40"
                    >
                      {t.active ? 'Retirar' : 'Reactivar'}
                    </button>
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}

      {filter === 'all' && (
        <p className="text-[11px] text-on-surface-variant px-1">
          Usa las flechas para cambiar el orden en la reserva online. El filtro «Todos» es necesario para reordenar.
        </p>
      )}

      {modal && (
        <TreatmentFormModal
          mode={modal.mode}
          initial={modal.treatment}
          categories={categories}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
