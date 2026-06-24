import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'

const Home = lazy(() => import('./pages/Home'))
const Booking = lazy(() => import('./pages/Booking'))
const CancelBooking = lazy(() => import('./pages/CancelBooking'))

function App() {
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
        <Route path="/reservar" element={<Booking />} />
        <Route path="/cancelar/:token" element={<CancelBooking />} />
      </Routes>
    </Suspense>
  )
}

export default App
