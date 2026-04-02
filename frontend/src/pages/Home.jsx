import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import HeroSection from '../components/landing/HeroSection'
import AboutSection from '../components/landing/AboutSection'
import TreatmentsGrid from '../components/landing/TreatmentsGrid'
import FirstTimeGuide from '../components/landing/FirstTimeGuide'
import BeforeAfter from '../components/landing/BeforeAfter'
import ReviewsCarousel from '../components/landing/ReviewsCarousel'
import BookingCTA from '../components/landing/BookingCTA'
import ContactSection from '../components/landing/ContactSection'
import SectionDivider from '../components/ui/SectionDivider'

export default function Home() {
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
        <BeforeAfter />
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
