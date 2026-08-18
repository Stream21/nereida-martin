function formatEuro(value) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function KpiCard({ label, value, hint, tone = 'default' }) {
  const toneClass =
    tone === 'imported'
      ? 'bg-surface-container-low border-outline-variant/40'
      : 'bg-surface-container-lowest border-outline-variant/30'

  return (
    <div
      className={`${toneClass} rounded-2xl p-4 sm:p-5 shadow-[0_4px_20px_rgba(28,25,23,0.06)] border`}
    >
      <p className="text-[11px] uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="font-headline text-2xl sm:text-3xl text-on-surface mt-1">{value}</p>
      {hint && <p className="text-xs text-on-surface-variant mt-1">{hint}</p>}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <p className="text-xs uppercase tracking-wide text-on-surface-variant px-0.5">{children}</p>
  )
}

export default function MetricsOverview({ overview }) {
  if (!overview) return null

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <SectionTitle>Reservas web y agenda</SectionTitle>
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
            label="Citas canceladas"
            value={overview.cancelledBookings ?? 0}
            hint={`${overview.cancelledBookingsMonth ?? 0} este mes · ${overview.cancelledBookingsYear ?? 0} este año`}
          />
        </div>
      </div>

      <div className="space-y-2">
        <SectionTitle>Actividad del estudio</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          <KpiCard
            label="Clientas activas"
            value={overview.activeClients ?? 0}
            hint="Cuentas con acceso a la web"
          />
          <KpiCard
            label="Altas este mes"
            value={overview.newClientsMonth}
            hint={`${overview.newActiveMonth ?? 0} activadas este mes`}
          />
          <KpiCard
            label="Próximos 7 días"
            value={overview.upcomingWeekBookings ?? 0}
            hint="Citas confirmadas en la agenda"
          />
          <KpiCard
            label="Primeras visitas"
            value={overview.firstVisitsMonth ?? 0}
            hint="Este mes"
          />
          <KpiCard
            label="Clientas que vuelven"
            value={`${overview.returningRateMonth ?? 0}%`}
            hint="Citas de clientas conocidas este mes"
          />
        </div>
      </div>

      <div className="space-y-2">
        <SectionTitle>Google Calendar</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            tone="imported"
            label="Citas importadas"
            value={overview.importedBookingsTotal ?? 0}
            hint="Total histórico"
          />
          <KpiCard
            tone="imported"
            label="Importadas este mes"
            value={overview.importedBookingsMonth ?? 0}
            hint={overview.period?.label}
          />
        </div>
      </div>
    </div>
  )
}
