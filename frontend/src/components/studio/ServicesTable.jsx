import { useEffect, useState } from 'react'
import GoldButton from '../ui/GoldButton'
import { exportServices, fetchServices } from '../../utils/ownerApi'
import { getStudioPeriod, MONTH_NAMES, monthLabel } from '../../utils/monthNames'

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

const { year: defaultYear, month: defaultMonth } = getStudioPeriod()

export default function ServicesTable() {
  const [year, setYear] = useState(String(defaultYear))
  const [month, setMonth] = useState(String(defaultMonth))
  const [data, setData] = useState({ services: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const yearNum = Number(year)
    const monthNum = Number(month)

    if (!year || Number.isNaN(yearNum) || !month || Number.isNaN(monthNum)) {
      setLoading(false)
      return undefined
    }

    setLoading(true)
    setError('')

    fetchServices({ year: yearNum, month: monthNum, page: 1, limit: 100 })
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
  }, [year, month])

  const handleExport = async () => {
    setExporting(true)
    setError('')
    try {
      await exportServices({ year: Number(year), month: Number(month) })
    } catch (err) {
      setError(err.message || 'Error al exportar')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface-container-lowest rounded-3xl p-4 border border-outline-variant/30 shadow-[0_4px_20px_rgba(28,25,23,0.05)]">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex-1">
            <span className="text-sm text-on-surface-variant block mb-1">Año</span>
            <input
              type="number"
              min="2020"
              max="2100"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 outline-none focus:border-primary"
            />
          </label>
          <label className="flex-1">
            <span className="text-sm text-on-surface-variant block mb-1">Mes</span>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 outline-none focus:border-primary"
            >
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <GoldButton
            type="button"
            onClick={handleExport}
            disabled={exporting || loading}
            className="rounded-2xl px-5 py-3 disabled:opacity-60 whitespace-nowrap"
          >
            {exporting ? 'Exportando…' : 'Exportar Excel'}
          </GoldButton>
        </div>
        <p className="text-xs text-on-surface-variant mt-3">
          Periodo seleccionado: {monthLabel(Number(month))} {year}
        </p>
      </div>

      {error && <p className="text-sm text-error bg-error-container rounded-xl px-3 py-2">{error}</p>}
      {loading && <p className="text-sm text-on-surface-variant">Cargando servicios…</p>}

      <div className="bg-surface-container-lowest rounded-3xl overflow-hidden shadow-[0_4px_20px_rgba(28,25,23,0.06)] border border-outline-variant/30">
        <div className="overflow-x-auto">
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
                  <td className="px-4 py-3 capitalize">{service.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && data.services.length === 0 && (
          <p className="px-4 py-6 text-sm text-on-surface-variant">No hay servicios en este periodo.</p>
        )}
      </div>
      <p className="text-xs text-on-surface-variant">{data.total} servicios en total</p>
    </div>
  )
}
