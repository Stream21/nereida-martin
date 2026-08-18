import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CHART_COLORS, ChartCard } from './ChartCard'

export default function SourcePieChart({ sources }) {
  if (!sources?.length) {
    return (
      <ChartCard title="Tipo de visita" subtitle="Primera visita, nuevo tratamiento o clienta conocida">
        <p className="text-sm text-on-surface-variant py-8 text-center">Sin datos todavía.</p>
      </ChartCard>
    )
  }

  const data = sources.map((s) => ({
    name: s.label,
    value: s.bookingCount,
  }))

  return (
    <ChartCard title="Tipo de visita" subtitle="Primera visita, nuevo tratamiento o clienta conocida">
      <div className="w-full min-h-[260px] h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="46%"
              innerRadius={56}
              outerRadius={90}
              paddingAngle={3}
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
