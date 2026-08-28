import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const CHART_COLORS = ['#FF8A8A', '#E8B4A8', '#C9A99A', '#B78B7D', '#9A8C85', '#7D6E68']

function prepareData(items, maxItems = 6) {
  if (!items?.length) return []
  const sorted = [...items].sort((a, b) => b.count - a.count)
  if (sorted.length <= maxItems) {
    return sorted.map((item) => ({
      name: item.tag ? `${item.name} · ${item.tag}` : item.name,
      value: item.count,
    }))
  }
  const top = sorted.slice(0, maxItems)
  const rest = sorted.slice(maxItems).reduce((sum, item) => sum + item.count, 0)
  return [
    ...top.map((item) => ({
      name: item.tag ? `${item.name} · ${item.tag}` : item.name,
      value: item.count,
    })),
    { name: 'Otros', value: rest },
  ]
}

export default function ClientServicesChart({ completedVisits, byTreatment, compact = false }) {
  const data = prepareData(byTreatment)

  if (!completedVisits) {
    return (
      <div
        className={`rounded-3xl bg-surface-container-lowest border border-outline-variant/25 ${
          compact ? 'p-4' : 'p-5'
        }`}
      >
        <p className="text-sm text-on-surface-variant text-center py-6">
          Aún no tienes visitas registradas.
        </p>
      </div>
    )
  }

  return (
    <div
      className={`rounded-3xl bg-surface-container-lowest border border-outline-variant/25 shadow-[0_4px_20px_rgba(67,61,60,0.05)] ${
        compact ? 'p-4' : 'p-5'
      }`}
    >
      <div className="mb-3">
        <p className="font-headline text-lg text-on-surface">
          {completedVisits} {completedVisits === 1 ? 'visita' : 'visitas'} en total
        </p>
        {!compact && (
          <p className="text-xs text-on-surface-variant mt-0.5">Tus servicios en el estudio</p>
        )}
      </div>

      {data.length > 0 && (
        <div className={`w-full ${compact ? 'h-[180px]' : 'h-[220px]'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={compact ? 42 : 52}
                outerRadius={compact ? 68 : 82}
                paddingAngle={2}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${value} visitas`, '']}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid rgba(67,61,60,0.08)',
                  fontSize: 13,
                }}
              />
              {!compact && <Legend wrapperStyle={{ fontSize: 11 }} />}
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
