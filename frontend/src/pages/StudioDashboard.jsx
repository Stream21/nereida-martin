import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import StudioCalendar from '../components/studio/StudioCalendar'
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
  const { user, loading, logout, isAuthenticated } = useOwnerAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [monthly, setMonthly] = useState([])
  const [topClients, setTopClients] = useState([])
  const [treatments, setTreatments] = useState([])
  const [sources, setSources] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/studio', { replace: true })
    }
  }, [loading, isAuthenticated, navigate])

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
                    {overview.bookingsWithoutPrice} citas confirmadas sin precio asignado (importadas o sin tarifa).
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
          <motion.div key="agenda" variants={tabVariants} initial="initial" animate="animate" exit="exit">
            <StudioCalendar />
          </motion.div>
        )}

        {activeTab === 'clients' && (
          <motion.div key="clients" variants={tabVariants} initial="initial" animate="animate" exit="exit">
            <ClientsTable />
          </motion.div>
        )}

        {activeTab === 'services' && (
          <motion.div key="services" variants={tabVariants} initial="initial" animate="animate" exit="exit">
            <ServicesTable />
          </motion.div>
        )}
      </AnimatePresence>
    </StudioLayout>
  )
}
