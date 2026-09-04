import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import StudioLayout from '../components/studio/StudioLayout'
import MetricsOverview from '../components/studio/MetricsOverview'
import BestMonthCard from '../components/studio/BestMonthCard'
import BookingsChart from '../components/studio/BookingsChart'
import RevenueChart from '../components/studio/RevenueChart'
import TreatmentsPieChart from '../components/studio/TreatmentsPieChart'
import SourcePieChart from '../components/studio/SourcePieChart'
import TopClientsCard from '../components/studio/TopClientsCard'
import ClientsTable from '../components/studio/ClientsTable'
import ServicesTable from '../components/studio/ServicesTable'
import TreatmentsCatalog from '../components/studio/TreatmentsCatalog'
import StudioCalendar from '../components/studio/StudioCalendar'
import StudioSettingsPanel from '../components/studio/StudioSettingsPanel'
import { useOwnerAuth } from '../hooks/useOwnerAuth'
import {
  fetchByTreatment,
  fetchMonthly,
  fetchOverview,
  fetchTopClients,
  fetchBySource,
} from '../utils/ownerApi'

const tabVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

export default function StudioDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user, loading, logout, isAuthenticated } = useOwnerAuth()
  const tabFromUrl = searchParams.get('tab')
  const citaFromUrl = searchParams.get('cita')
  const [activeTab, setActiveTab] = useState(
    tabFromUrl === 'agenda' ||
      tabFromUrl === 'clients' ||
      tabFromUrl === 'services' ||
      tabFromUrl === 'settings'
      ? tabFromUrl
      : 'overview'
  )
  const servicesSectionFromUrl = searchParams.get('section')
  const [servicesSection, setServicesSection] = useState(
    servicesSectionFromUrl === 'historial' ? 'historial' : 'catalog'
  )
  const [overview, setOverview] = useState(null)
  const [monthly, setMonthly] = useState([])
  const [topClients, setTopClients] = useState([])
  const [treatments, setTreatments] = useState([])
  const [sources, setSources] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      const next = `${location.pathname}${location.search}`
      navigate(`/studio?next=${encodeURIComponent(next)}`, { replace: true })
    }
  }, [loading, isAuthenticated, navigate, location.pathname, location.search])

  useEffect(() => {
    if (!isAuthenticated) return undefined

    let cancelled = false
    setDataLoading(true)
    Promise.all([
      fetchOverview(),
      fetchMonthly(12),
      fetchTopClients(5),
      fetchByTreatment(),
      fetchBySource(),
    ])
      .then(([overviewRes, monthlyRes, topRes, treatmentRes, sourceRes]) => {
        if (cancelled) return
        setOverview(overviewRes)
        setMonthly(monthlyRes.months || [])
        setTopClients(topRes.clients || [])
        setTreatments(treatmentRes.treatments || [])
        setSources(sourceRes.sources || [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  const handleLogout = () => {
    logout()
    navigate('/studio', { replace: true })
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <StudioLayout activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout}>
      {error && (
        <p className="text-sm text-error bg-error-container rounded-xl px-3 py-2 mb-4">{error}</p>
      )}

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="space-y-4 sm:space-y-5"
          >
            {dataLoading ? (
              <p className="text-sm text-on-surface-variant">Cargando métricas…</p>
            ) : (
              <>
                <MetricsOverview overview={overview} />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <BestMonthCard bestMonth={overview?.bestMonth} />
                  <TopClientsCard clients={topClients} />
                </div>

                {overview?.bookingsWithoutPrice > 0 && (
                  <p className="text-sm text-on-surface-variant bg-surface-container-low rounded-2xl px-4 py-3">
                    {overview.bookingsWithoutPrice} citas web confirmadas sin precio asignado.
                  </p>
                )}

                <BookingsChart months={monthly} bestMonth={overview?.bestMonth} />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <RevenueChart months={monthly} />
                  <TreatmentsPieChart treatments={treatments} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SourcePieChart sources={sources} />
                </div>
              </>
            )}
          </motion.div>
        )}

        {activeTab === 'agenda' && (
          <motion.div
            key="agenda"
            className="flex flex-col flex-1 min-h-0 h-full"
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <StudioCalendar initialBookingId={citaFromUrl} />
          </motion.div>
        )}

        {activeTab === 'clients' && (
          <motion.div key="clients" variants={tabVariants} initial="initial" animate="animate" exit="exit">
            <ClientsTable />
          </motion.div>
        )}

        {activeTab === 'services' && (
          <motion.div key="services" variants={tabVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
            <div className="flex gap-2 p-1 rounded-2xl bg-surface-container-low w-full sm:w-auto sm:inline-flex">
              <button
                type="button"
                onClick={() => setServicesSection('catalog')}
                className={`cursor-pointer flex-1 sm:flex-none rounded-xl px-4 py-2.5 text-sm font-medium min-h-11 transition-colors ${
                  servicesSection === 'catalog'
                    ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                    : 'text-on-surface-variant'
                }`}
              >
                Catálogo
              </button>
              <button
                type="button"
                onClick={() => setServicesSection('historial')}
                className={`cursor-pointer flex-1 sm:flex-none rounded-xl px-4 py-2.5 text-sm font-medium min-h-11 transition-colors ${
                  servicesSection === 'historial'
                    ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                    : 'text-on-surface-variant'
                }`}
              >
                Historial
              </button>
            </div>
            {servicesSection === 'catalog' ? <TreatmentsCatalog /> : <ServicesTable />}
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div key="settings" variants={tabVariants} initial="initial" animate="animate" exit="exit">
            <StudioSettingsPanel />
          </motion.div>
        )}
      </AnimatePresence>
    </StudioLayout>
  )
}
