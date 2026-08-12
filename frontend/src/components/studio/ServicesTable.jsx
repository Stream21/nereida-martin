import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import GoldButton from '../ui/GoldButton'
import Icon from '../ui/Icon'
import {
  exportServices,
  fetchOwnerTreatments,
  fetchServices,
} from '../../utils/ownerApi'
import { getStudioPeriod, MONTH_NAMES, monthLabel } from '../../utils/monthNames'

const PAGE_SIZE = 10

const SOURCE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'web', label: 'Web' },
  { value: 'google', label: 'Google' },
  { value: 'owner', label: 'Agenda' },
]

const fieldClass =
  'w-full rounded-2xl border border-outline-variant bg-surface-container-low px-3.5 py-2.5 text-sm outline-none focus:border-primary min-h-11'

function formatEuro(value) {
  if (value == null) return 'Sin precio'
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Atlantic/Canary',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function sourceLabel(source) {
  if (source === 'google') return 'Google'
  if (source === 'owner') return 'Agenda'
  return 'Web'
}

function toDateInput(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function monthDateBounds(year, month) {
  const y = Number(year)
  const m = Number(month)
  const lastDay = new Date(y, m, 0).getDate()
  return {
    from: toDateInput(y, m, 1),
    to: toDateInput(y, m, lastDay),
  }
}

const { year: defaultYear, month: defaultMonth } = getStudioPeriod()
const defaultBounds = monthDateBounds(defaultYear, defaultMonth)

export default function ServicesTable() {
  const [year, setYear] = useState(String(defaultYear))
  const [month, setMonth] = useState(String(defaultMonth))
  const [from, setFrom] = useState(defaultBounds.from)
  const [to, setTo] = useState(defaultBounds.to)
  const [client, setClient] = useState('')
  const [clientDebounced, setClientDebounced] = useState('')
  const [treatmentId, setTreatmentId] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [source, setSource] = useState('')
  const [treatments, setTreatments] = useState([])
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ services: [], total: 0, page: 1, limit: PAGE_SIZE })
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)

  const periodBounds = useMemo(() => monthDateBounds(year, month), [year, month])
  const datesCustom =
    from !== periodBounds.from || to !== periodBounds.to

  const extendedActiveCount = [
    datesCustom,
    !!treatmentId,
    priceMin !== '',
    priceMax !== '',
    !!source,
  ].filter(Boolean).length

  const filterParams = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
      client: clientDebounced || undefined,
      treatmentId: treatmentId || undefined,
      priceMin: priceMin !== '' ? priceMin : undefined,
      priceMax: priceMax !== '' ? priceMax : undefined,
      source: source || undefined,
    }),
    [from, to, clientDebounced, treatmentId, priceMin, priceMax, source]
  )

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE))

  useEffect(() => {
    fetchOwnerTreatments()
      .then((res) => setTreatments(res.treatments || []))
      .catch(() => setTreatments([]))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setClientDebounced(client.trim()), 250)
    return () => clearTimeout(t)
  }, [client])

  useEffect(() => {
    setPage(1)
  }, [from, to, clientDebounced, treatmentId, priceMin, priceMax, source])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    fetchServices({ ...filterParams, page, limit: PAGE_SIZE })
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((err) => {
        if (!cancelled) {
          if (err.message === 'UNAUTHORIZED') {
            setError('Sesión expirada. Vuelve a entrar en /studio')
          } else {
            setError(err.message || 'No se pudieron cargar los servicios')
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [filterParams, page])

  const applyPeriod = (nextYear, nextMonth) => {
    const bounds = monthDateBounds(nextYear, nextMonth)
    setYear(String(nextYear))
    setMonth(String(nextMonth))
    setFrom(bounds.from)
    setTo(bounds.to)
  }

  const handleExport = async () => {
    setExporting(true)
    setError('')
    try {
      await exportServices(filterParams)
    } catch (err) {
      setError(err.message || 'Error al exportar')
    } finally {
      setExporting(false)
    }
  }

  const clearExtended = () => {
    applyPeriod(year, month)
    setTreatmentId('')
    setPriceMin('')
    setPriceMax('')
    setSource('')
  }

  const clearAll = () => {
    applyPeriod(defaultYear, defaultMonth)
    setClient('')
    setClientDebounced('')
    setTreatmentId('')
    setPriceMin('')
    setPriceMax('')
    setSource('')
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(28,25,23,0.05)] overflow-hidden">
        {/* Filtros base */}
        <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="flex gap-2 flex-1 min-w-0">
            <label className="w-[5.5rem] shrink-0">
              <span className="sr-only">Año</span>
              <input
                type="number"
                min="2020"
                max="2100"
                value={year}
                onChange={(e) => {
                  const y = e.target.value
                  setYear(y)
                  const yNum = Number(y)
                  if (y.length === 4 && !Number.isNaN(yNum) && month) {
                    applyPeriod(yNum, month)
                  }
                }}
                className={fieldClass}
                aria-label="Año"
              />
            </label>
            <label className="flex-1 min-w-0 sm:max-w-[10rem]">
              <span className="sr-only">Mes</span>
              <select
                value={month}
                onChange={(e) => applyPeriod(year, e.target.value)}
                className={fieldClass}
                aria-label="Mes"
              >
                {MONTH_NAMES.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex-1 min-w-0 sm:min-w-[12rem]">
            <span className="sr-only">Cliente</span>
            <div className="relative">
              <Icon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg pointer-events-none"
              />
              <input
                type="search"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Buscar cliente"
                className={`${fieldClass} pl-10`}
              />
            </div>
          </label>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              className={`cursor-pointer inline-flex items-center gap-1.5 rounded-2xl border px-3.5 py-2.5 min-h-11 text-sm transition-colors ${
                moreOpen || extendedActiveCount > 0
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <Icon name="tune" className="text-lg" />
              <span className="hidden xs:inline sm:inline">Más filtros</span>
              {extendedActiveCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-5 h-5 rounded-full bg-primary text-on-primary text-[10px] font-bold px-1">
                  {extendedActiveCount}
                </span>
              )}
            </button>
            <GoldButton
              type="button"
              onClick={handleExport}
              disabled={exporting || loading}
              className="rounded-2xl px-4 py-2.5 disabled:opacity-60 whitespace-nowrap min-h-11 text-sm"
            >
              {exporting ? '…' : 'Excel'}
            </GoldButton>
          </div>
        </div>

        {/* Panel filtros extendidos */}
        <AnimatePresence initial={false}>
          {moreOpen && (
            <motion.div
              key="more-filters"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="overflow-hidden border-t border-outline-variant/25"
            >
              <div className="p-4 bg-surface-container-low/60 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <label className="min-w-0">
                    <span className="text-xs text-on-surface-variant block mb-1">Desde</span>
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      className={fieldClass}
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="text-xs text-on-surface-variant block mb-1">Hasta</span>
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      className={fieldClass}
                    />
                  </label>
                  <label className="min-w-0 col-span-2 sm:col-span-1">
                    <span className="text-xs text-on-surface-variant block mb-1">Tratamiento</span>
                    <select
                      value={treatmentId}
                      onChange={(e) => setTreatmentId(e.target.value)}
                      className={fieldClass}
                    >
                      <option value="">Todos</option>
                      {treatments.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.tag ? ` · ${t.tag}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0">
                    <span className="text-xs text-on-surface-variant block mb-1">Importe mín.</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      placeholder="€"
                      className={fieldClass}
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="text-xs text-on-surface-variant block mb-1">Importe máx.</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      placeholder="€"
                      className={fieldClass}
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="text-xs text-on-surface-variant block mb-1">Origen</span>
                    <select
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      className={fieldClass}
                    >
                      {SOURCE_OPTIONS.map((opt) => (
                        <option key={opt.value || 'all'} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-on-surface-variant">
                    {monthLabel(Number(month))} {year}
                    {datesCustom ? ` · ${from} → ${to}` : ''}
                  </p>
                  <div className="flex gap-2">
                    {extendedActiveCount > 0 && (
                      <button
                        type="button"
                        onClick={clearExtended}
                        className="cursor-pointer text-xs text-on-surface-variant hover:text-on-surface px-2 py-1.5 rounded-lg min-h-9"
                      >
                        Quitar extras
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={clearAll}
                      className="cursor-pointer text-xs text-primary hover:bg-primary/10 px-2.5 py-1.5 rounded-lg min-h-9"
                    >
                      Restablecer todo
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {error && <p className="text-sm text-error bg-error-container rounded-xl px-3 py-2">{error}</p>}

      <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-[0_4px_20px_rgba(28,25,23,0.06)] border border-outline-variant/30 min-h-[28rem]">
        <div
          className={`overflow-x-auto transition-opacity duration-200 ${
            loading ? 'opacity-55' : 'opacity-100'
          }`}
        >
          <table className="w-full text-sm">
            <thead className="bg-surface-container-low text-on-surface-variant text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Tratamiento</th>
                <th className="px-4 py-3 font-medium">Importe</th>
                <th className="px-4 py-3 font-medium">Origen</th>
              </tr>
            </thead>
            <tbody>
              {data.services.map((service) => (
                <tr key={service.id} className="border-t border-outline-variant/40">
                  <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                    {formatDateTime(service.startTime)}
                  </td>
                  <td className="px-4 py-3 text-on-surface">{service.clientName}</td>
                  <td className="px-4 py-3">{service.treatmentName}</td>
                  <td className="px-4 py-3 text-primary">{formatEuro(service.price)}</td>
                  <td className="px-4 py-3">{sourceLabel(service.source)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && data.services.length === 0 && (
          <p className="px-4 py-6 text-sm text-on-surface-variant">
            No hay servicios con estos filtros.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-on-surface-variant">{data.total} servicios en total</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            title="Página anterior"
            aria-label="Página anterior"
            className="cursor-pointer rounded-xl border border-outline-variant p-2 disabled:opacity-40 hover:bg-surface-container transition-colors"
          >
            <Icon name="chevron_left" className="text-lg" />
          </button>
          <span className="text-xs text-on-surface-variant tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            title="Página siguiente"
            aria-label="Página siguiente"
            className="cursor-pointer rounded-xl border border-outline-variant p-2 disabled:opacity-40 hover:bg-surface-container transition-colors"
          >
            <Icon name="chevron_right" className="text-lg" />
          </button>
        </div>
      </div>
    </div>
  )
}
