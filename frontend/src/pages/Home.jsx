import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import HeroSection from '../components/landing/HeroSection'
import AboutSection from '../components/landing/AboutSection'
import TreatmentsGrid from '../components/landing/TreatmentsGrid'
import FirstTimeGuide from '../components/landing/FirstTimeGuide'
import StudioGallery from '../components/landing/StudioGallery'
import ReviewsCarousel from '../components/landing/ReviewsCarousel'
import BookingCTA from '../components/landing/BookingCTA'
import ContactSection from '../components/landing/ContactSection'
import SectionDivider from '../components/ui/SectionDivider'

export default function Home() {
  const location = useLocation()

  useEffect(() => {
    const id = location.hash?.replace('#', '')
    if (!id) return undefined
    const timer = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    }, 80)
    return () => clearTimeout(timer)
  }, [location.hash, location.pathname])

  return (
    <>
      <Navbar />
      <main className="pt-20">
        <HeroSection />
        <SectionDivider variant="wave" fill="surface-container-low" />
        <AboutSection />
        <SectionDivider variant="arc" fill="background" />
        <TreatmentsGrid />
        <SectionDivider variant="tilt" fill="surface-container" />
        <FirstTimeGuide />
        <SectionDivider variant="wave" fill="surface-container-low" flip />
        <StudioGallery />
        <SectionDivider variant="arc" fill="background" flip />
        <ReviewsCarousel />
        <BookingCTA />
        <SectionDivider variant="tilt" fill="surface-container-low" flip />
        <ContactSection />
        <SectionDivider variant="wave" fill="surface-container" />
      </main>
      <Footer />
    </>
  )
}
