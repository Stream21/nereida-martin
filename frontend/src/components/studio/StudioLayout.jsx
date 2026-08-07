import Icon from '../ui/Icon'
import StudioLogo from './StudioLogo'

const TABS = [
  { id: 'overview', label: 'Resumen', icon: 'dashboard' },
  { id: 'clients', label: 'Clientes', icon: 'group' },
  { id: 'services', label: 'Servicios', icon: 'spa' },
  { id: 'goals', label: 'Objetivos', icon: 'flag' },
]

export default function StudioLayout({ activeTab, onTabChange, onLogout, children }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant/40">
        {/* Desktop: logo + tabs + salir en una sola fila */}
        <div className="hidden sm:flex max-w-7xl mx-auto px-4 h-14 items-center gap-4">
          <StudioLogo variant="header" />

          <nav className="flex-1 flex justify-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`rounded-2xl px-4 py-2 text-sm flex items-center gap-1.5 transition-colors ${
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
            className="text-sm text-on-surface-variant hover:text-on-surface flex items-center gap-1 shrink-0"
          >
            <Icon name="logout" className="text-base" />
            Salir
          </button>
        </div>

        {/* Mobile: logo + salir, tabs debajo */}
        <div className="sm:hidden px-4 pt-2.5 pb-1 flex items-center justify-between">
          <StudioLogo variant="header" />
          <button
            type="button"
            onClick={onLogout}
            className="text-sm text-on-surface-variant hover:text-on-surface flex items-center gap-1"
          >
            <Icon name="logout" className="text-base" />
          </button>
        </div>
        <nav className="sm:hidden px-2 pb-2 flex gap-1 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`shrink-0 rounded-2xl px-3 py-2 text-xs flex items-center gap-1 transition-colors ${
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

      <main className="max-w-7xl mx-auto px-4 py-4 sm:py-5">{children}</main>
    </div>
  )
}
