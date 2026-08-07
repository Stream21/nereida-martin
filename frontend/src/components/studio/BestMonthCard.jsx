import Icon from '../ui/Icon'

export default function BestMonthCard({ bestMonth }) {
  if (!bestMonth) {
    return (
      <div className="bg-surface-container-low rounded-2xl p-4 text-sm text-on-surface-variant">
        Aún no hay datos suficientes para calcular el mejor mes.
      </div>
    )
  }

  return (
    <div className="bg-primary-fixed rounded-3xl p-5 flex items-start gap-3 border border-primary/10 shadow-[0_4px_20px_rgba(28,25,23,0.05)] h-full">
      <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
        <Icon name="emoji_events" className="text-primary text-xl" filled />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-on-primary-container/70">Mejor mes histórico</p>
        <p className="font-headline text-2xl text-on-primary-container">{bestMonth.label}</p>
        <p className="text-sm text-on-primary-container/80 mt-1">
          {bestMonth.bookingCount} citas confirmadas
        </p>
      </div>
    </div>
  )
}
