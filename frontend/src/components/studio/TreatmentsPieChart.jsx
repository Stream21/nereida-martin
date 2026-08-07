import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CHART_COLORS, ChartCard } from './ChartCard'

function prepareData(items, nameKey, valueKey, maxItems = 6) {
  if (!items?.length) return []
  const sorted = [...items].sort((a, b) => b[valueKey] - a[valueKey])
  if (sorted.length <= maxItems) {
    return sorted.map((item) => ({
      name: item[nameKey],
      value: item[valueKey],
    }))
  }
  const top = sorted.slice(0, maxItems)
  const rest = sorted.slice(maxItems).reduce((sum, item) => sum + item[valueKey], 0)
  return [
    ...top.map((item) => ({ name: item[nameKey], value: item[valueKey] })),
    { name: 'Otros', value: rest },
  ]
}

export default function TreatmentsPieChart({ treatments }) {
  const data = prepareData(treatments, 'treatmentName', 'bookingCount')

  if (!data.length) {
    return (
      <ChartCard title="Tratamientos" subtitle="Distribución de citas por servicio">
        <p className="text-sm text-on-surface-variant py-8 text-center">Sin datos todavía.</p>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Tratamientos" subtitle="Distribución de citas por servicio">
      <div className="w-full min-h-[260px] h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="46%"
              innerRadius={52}
              outerRadius={88}
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [value, 'Citas']}
              contentStyle={{ borderRadius: 12, border: '1px solid #E7E5E4' }}
            />
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              iconType="circle"
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
