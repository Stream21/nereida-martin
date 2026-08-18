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

function formatEuro(value) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

export default function RevenueChart({ months }) {
  if (!months?.length) {
    return (
      <ChartCard title="Ingresos por mes" subtitle="Reservas web y de agenda con precio">
        <p className="text-sm text-on-surface-variant py-8 text-center">Sin datos todavía.</p>
      </ChartCard>
    )
  }

  const data = months.map((m) => ({
    name: m.label.split(' ')[0].slice(0, 3),
    fullLabel: m.label,
    revenue: m.revenue,
  }))

  const hasRevenue = data.some((d) => d.revenue > 0)

  return (
    <ChartCard title="Ingresos por mes" subtitle="Reservas web y de agenda con precio">
      {!hasRevenue ? (
        <p className="text-sm text-on-surface-variant py-8 text-center">
          Aún no hay ingresos registrados en reservas web.
        </p>
      ) : (
        <div className="w-full min-h-[240px] h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#57534E' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#57534E' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip
                formatter={(value) => [formatEuro(value), 'Ingresos']}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel || ''}
                contentStyle={{ borderRadius: 12, border: '1px solid #E7E5E4' }}
              />
              <Bar dataKey="revenue" fill="#C9A89C" radius={[8, 8, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  )
}
