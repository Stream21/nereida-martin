function formatEuro(value) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

export default function TopClientsCard({ clients }) {
  if (!clients?.length) {
    return (
      <div className="bg-surface-container-low rounded-2xl p-4 text-sm text-on-surface-variant">
        Sin clientes con historial todavía.
      </div>
    )
  }

  return (
    <div className="bg-surface-container-lowest rounded-3xl p-4 sm:p-5 shadow-[0_4px_20px_rgba(28,25,23,0.06)] border border-outline-variant/30 h-full">
      <h3 className="font-headline text-xl text-on-surface mb-3">Top clientes</h3>
      <ul className="space-y-2">
        {clients.map((client, index) => (
          <li
            key={client.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-on-surface truncate">
                {index + 1}. {client.name}
              </p>
              <p className="text-xs text-on-surface-variant">{client.bookingCount} citas</p>
            </div>
            <p className="text-sm font-medium text-primary shrink-0">{formatEuro(client.totalSpent)}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
