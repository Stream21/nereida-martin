import Icon from '../ui/Icon'
import StudioLogo from './StudioLogo'

const TABS = [
  { id: 'overview', label: 'Resumen', icon: 'dashboard' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar_month' },
  { id: 'clients', label: 'Clientes', icon: 'group' },
  { id: 'services', label: 'Servicios', icon: 'spa' },
]

export default function StudioLayout({ activeTab, onTabChange, onLogout, children }) {
  const agendaFlush = activeTab === 'agenda'

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant/40">
        {/* Desktop: logo + tabs + salir en una sola fila */}
        <div className="hidden sm:flex max-w-7xl mx-auto px-4 h-14 items-center gap-4">
          <StudioLogo variant="header" />

          <nav className="flex-1 flex justify-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`cursor-pointer rounded-2xl px-4 py-2 text-sm flex items-center gap-1.5 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                }`}
              >
                <Icon name={tab.icon} className="text-base" filled={activeTab === tab.id} />
                {tab.label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={onLogout}
            className="cursor-pointer text-sm text-on-surface-variant hover:text-on-surface flex items-center gap-1 shrink-0 min-h-11"
          >
            <Icon name="logout" className="text-base" />
            Salir
          </button>
        </div>

        {/* Mobile: logo + salir, tabs debajo */}
        <div className="sm:hidden px-3 pt-2 pb-1 flex items-center justify-between">
          <StudioLogo variant="header" />
          <button
            type="button"
            onClick={onLogout}
            className="cursor-pointer min-h-11 min-w-11 flex items-center justify-center text-on-surface-variant"
            aria-label="Salir"
          >
            <Icon name="logout" className="text-xl" />
          </button>
        </div>
        <nav className="sm:hidden px-1.5 pb-2 flex gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`cursor-pointer shrink-0 rounded-2xl px-3 py-2.5 min-h-11 text-xs flex items-center gap-1 transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface-variant'
              }`}
            >
              <Icon name={tab.icon} className="text-base" filled={activeTab === tab.id} />
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main
        className={
          agendaFlush
            ? 'max-w-7xl mx-auto w-full px-0 pt-2 pb-3 sm:px-4 sm:py-5'
            : 'max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-5'
        }
      >
        {children}
      </main>
    </div>
  )
}
