import { Hero, TrustStrip } from '../../components/landing/Hero'
import {
  AboutSection,
  FeaturesSection,
  FinalCTA,
  HowItWorksSection,
  SafetySection,
  SupportSection,
} from '../../components/landing/Sections'

export default function Home() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <AboutSection />
      <HowItWorksSection />
      <FeaturesSection />
      <SafetySection />
      <SupportSection />
      <FinalCTA />
    </>
  )
}
