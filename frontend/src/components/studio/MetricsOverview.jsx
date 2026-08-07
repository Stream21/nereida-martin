function formatEuro(value) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function KpiCard({ label, value, hint }) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 shadow-[0_4px_20px_rgba(28,25,23,0.06)] border border-outline-variant/30">
      <p className="text-[11px] uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="font-headline text-2xl sm:text-3xl text-on-surface mt-1">{value}</p>
      {hint && <p className="text-xs text-on-surface-variant mt-1">{hint}</p>}
    </div>
  )
}

export default function MetricsOverview({ overview }) {
  if (!overview) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      <KpiCard
        label="Ingresos del mes"
        value={formatEuro(overview.monthRevenue)}
        hint={overview.period?.label}
      />
      <KpiCard
        label="Ingresos del año"
        value={formatEuro(overview.yearRevenue)}
        hint={`${overview.yearBookings} citas`}
      />
      <KpiCard
        label="Citas del mes"
        value={overview.monthBookings}
        hint={`Ticket medio ${formatEuro(overview.averageTicket)}`}
      />
      <KpiCard
        label="Clientes nuevos"
        value={overview.newClientsMonth}
        hint="Este mes"
      />
      <KpiCard
        label="Citas canceladas"
        value={overview.cancelledBookings ?? 0}
        hint={`${overview.cancelledBookingsMonth ?? 0} este mes · ${overview.cancelledBookingsYear ?? 0} este año`}
      />
    </div>
  )
}
