import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import RequireClientAuth from './components/auth/RequireClientAuth'

const Home = lazy(() => import('./pages/Home'))
const Booking = lazy(() => import('./pages/Booking'))
const CancelBooking = lazy(() => import('./pages/CancelBooking'))
const ConfirmCompanionBooking = lazy(() => import('./pages/ConfirmCompanionBooking'))
const MicroRequest = lazy(() => import('./pages/MicroRequest'))
const ClientLogin = lazy(() => import('./pages/ClientLogin'))
const ClientRegister = lazy(() => import('./pages/ClientRegister'))
const StudioLogin = lazy(() => import('./pages/StudioLogin'))
const StudioDashboard = lazy(() => import('./pages/StudioDashboard'))

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="w-8 h-8 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/entrar" element={<ClientLogin />} />
        <Route path="/registro/:token" element={<ClientRegister />} />
        <Route
          path="/reservar"
          element={
            <RequireClientAuth>
              <Booking />
            </RequireClientAuth>
          }
        />
        <Route path="/solicitar-micro" element={<MicroRequest />} />
        <Route path="/cancelar/:token" element={<CancelBooking />} />
        <Route path="/confirmar-cita/:token" element={<ConfirmCompanionBooking />} />
        <Route path="/studio" element={<StudioLogin />} />
        <Route path="/studio/panel" element={<StudioDashboard />} />
      </Routes>
    </Suspense>
  )
}
