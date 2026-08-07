import { useEffect, useState } from 'react'
import GoldButton from '../ui/GoldButton'
import { fetchGoals, fetchOverview, saveGoal } from '../../utils/ownerApi'

const GOAL_DEFS = [
  { key: 'monthly_revenue', label: 'Ingresos del mes', monthly: true, format: 'euro' },
  { key: 'yearly_revenue', label: 'Ingresos del año', monthly: false, format: 'euro' },
  { key: 'monthly_bookings', label: 'Citas del mes', monthly: true, format: 'number' },
  { key: 'new_clients', label: 'Clientes nuevos del mes', monthly: true, format: 'number' },
]

function formatValue(value, format) {
  if (format === 'euro') {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(value || 0)
  }
  return value || 0
}

function getCurrentValue(key, overview) {
  if (!overview) return 0
  switch (key) {
    case 'monthly_revenue':
      return overview.monthRevenue
    case 'yearly_revenue':
      return overview.yearRevenue
    case 'monthly_bookings':
      return overview.monthBookings
    case 'new_clients':
      return overview.newClientsMonth
    default:
      return 0
  }
}

export default function GoalsPanel() {
  const [overview, setOverview] = useState(null)
  const [goals, setGoals] = useState([])
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([fetchOverview(), fetchGoals()])
      .then(([overviewRes, goalsRes]) => {
        if (cancelled) return
        setOverview(overviewRes)
        setGoals(goalsRes.goals || [])
        const initial = {}
        for (const def of GOAL_DEFS) {
          const goal = goalsRes.goals?.find((g) => g.metricKey === def.key)
          initial[def.key] = goal?.targetValue ?? ''
        }
        setDrafts(initial)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleSave = async (def) => {
    setSavingKey(def.key)
    setError('')
    try {
      const periodYear = overview?.period?.year || new Date().getFullYear()
      const periodMonth = def.monthly ? overview?.period?.month || new Date().getMonth() + 1 : null
      const targetValue = Number(drafts[def.key])
      if (!targetValue || targetValue <= 0) {
        throw new Error('Introduce un objetivo válido')
      }

      const res = await saveGoal({
        metricKey: def.key,
        periodYear,
        periodMonth,
        targetValue,
      })

      setGoals((prev) => {
        const filtered = prev.filter((g) => g.metricKey !== def.key)
        return [...filtered, res.goal]
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingKey('')
    }
  }

  if (loading) {
    return <p className="text-sm text-on-surface-variant">Cargando objetivos…</p>
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-error">{error}</p>}

      {GOAL_DEFS.map((def) => {
        const goal = goals.find((g) => g.metricKey === def.key)
        const current = getCurrentValue(def.key, overview)
        const target = goal?.targetValue || Number(drafts[def.key]) || 0
        const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0

        return (
          <div
            key={def.key}
            className="bg-surface-container-lowest rounded-2xl p-4 shadow-[0_4px_20px_rgba(28,25,23,0.06)]"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-headline text-lg text-on-surface">{def.label}</h3>
                <p className="text-sm text-on-surface-variant">
                  Actual: {formatValue(current, def.format)}
                  {target > 0 && ` · Objetivo: ${formatValue(target, def.format)}`}
                </p>
              </div>
              <span className="text-sm font-medium text-primary">{progress}%</span>
            </div>

            <div className="h-2 rounded-full bg-surface-container overflow-hidden mb-3">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                value={drafts[def.key]}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [def.key]: e.target.value }))}
                placeholder="Objetivo"
                className="flex-1 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 outline-none focus:border-primary"
              />
              <GoldButton
                type="button"
                onClick={() => handleSave(def)}
                disabled={savingKey === def.key}
                className="rounded-xl px-4 py-2 text-xs disabled:opacity-60"
              >
                {savingKey === def.key ? 'Guardando…' : 'Guardar'}
              </GoldButton>
            </div>
          </div>
        )
      })}
    </div>
  )
}
