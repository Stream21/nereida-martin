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
    <div className="min-h-svh flex flex-col bg-background">
      {/* ——— Desktop header ——— */}
      <header className="hidden sm:block sticky top-0 z-30 bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant/40 shrink-0">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
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
      </header>

      {/* ——— Mobile: compact top bar (nav lives at bottom) ——— */}
      <header className="sm:hidden sticky top-0 z-30 shrink-0 h-11 px-3 flex items-center justify-between bg-surface-container-lowest/95 backdrop-blur-md border-b border-outline-variant/30">
        <StudioLogo variant="header" />
        <button
          type="button"
          onClick={onLogout}
          className="cursor-pointer min-h-10 min-w-10 flex items-center justify-center text-on-surface-variant rounded-full active:bg-surface-container"
          aria-label="Salir"
        >
          <Icon name="logout" className="text-xl" />
        </button>
      </header>

      <main
        className={
          agendaFlush
            ? 'flex-1 min-h-0 flex flex-col overflow-hidden max-w-7xl mx-auto w-full px-0 pt-0 pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] sm:px-4 sm:py-5 sm:pb-5'
            : 'flex-1 min-h-0 overflow-y-auto max-w-7xl mx-auto w-full px-3 py-3 pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] sm:px-4 sm:py-5 sm:pb-5'
        }
      >
        {children}
      </main>

      {/* ——— Mobile bottom tab bar ——— */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant/40 pb-[env(safe-area-inset-bottom,0px)]"
        aria-label="Secciones del estudio"
      >
        <div className="grid grid-cols-4 h-[3.75rem]">
          {TABS.map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`cursor-pointer flex flex-col items-center justify-center gap-0.5 min-h-[3rem] touch-manipulation ${
                  active ? 'text-primary' : 'text-on-surface-variant'
                }`}
              >
                <Icon name={tab.icon} className="text-[1.35rem]" filled={active} />
                <span className={`text-[10px] leading-none ${active ? 'font-semibold' : 'font-medium'}`}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
