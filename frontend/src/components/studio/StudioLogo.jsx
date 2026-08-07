const VARIANTS = {
  header: 'h-9 sm:h-10 w-auto shrink-0',
  login: 'w-full max-w-[240px] sm:max-w-[280px] h-auto drop-shadow-[0_8px_24px_rgba(183,139,125,0.22)]',
}

export default function StudioLogo({ variant = 'header', className = '' }) {
  return (
    <img
      src="/logo2.png"
      alt="Nereida Martín — Brow Artist"
      className={`${VARIANTS[variant] || VARIANTS.header} ${className}`.trim()}
      draggable={false}
    />
  )
}
