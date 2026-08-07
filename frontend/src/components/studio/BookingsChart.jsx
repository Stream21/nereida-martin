import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartCard } from './ChartCard'

export default function BookingsChart({ months, bestMonth }) {
  if (!months?.length) {
    return (
      <ChartCard title="Citas por mes" subtitle="Volumen mensual de citas confirmadas">
        <p className="text-sm text-on-surface-variant py-8 text-center">Sin datos todavía.</p>
      </ChartCard>
    )
  }

  const data = months.map((m) => ({
    name: m.label.split(' ')[0].slice(0, 3),
    fullLabel: m.label,
    bookings: m.bookingCount,
    isBest: bestMonth && m.year === bestMonth.year && m.month === bestMonth.month,
  }))

  return (
    <ChartCard title="Citas por mes" subtitle="Volumen mensual — el mes récord aparece más oscuro">
      <div className="w-full min-h-[280px] h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#57534E' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#57534E' }} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              formatter={(value) => [value, 'Citas']}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel || ''}
              contentStyle={{ borderRadius: 12, border: '1px solid #E7E5E4' }}
            />
            <Bar
              dataKey="bookings"
              radius={[8, 8, 0, 0]}
              maxBarSize={48}
              shape={(props) => {
                const { x, y, width, height, payload } = props
                const fill = payload.isBest ? '#8F726A' : '#B78B7D'
                return <rect x={x} y={y} width={width} height={height} fill={fill} rx={8} ry={8} />
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
