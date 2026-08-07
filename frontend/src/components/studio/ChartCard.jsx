const CHART_COLORS = ['#B78B7D', '#8F726A', '#C9A89C', '#6B6460', '#E5D4CE', '#A8A29E', '#D4B5AA', '#57534E']

export { CHART_COLORS }

export function ChartCard({ title, subtitle, children, className = '' }) {
  return (
    <div
      className={`bg-surface-container-lowest rounded-3xl p-4 sm:p-5 shadow-[0_4px_24px_rgba(28,25,23,0.06)] border border-outline-variant/30 ${className}`}
    >
      <div className="mb-4">
        <h3 className="font-headline text-lg sm:text-xl text-on-surface">{title}</h3>
        {subtitle && <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
