import { Hero, TrustStrip } from '../../components/landing/Hero'
import {
  EcosystemSection,
  FinalCTA,
  JourneySection,
  ProblemSection,
  RoleSection,
  SafetySection,
} from '../../components/landing/Sections'

export default function Home() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <ProblemSection />
      <JourneySection />
      <EcosystemSection />
      <RoleSection />
      <SafetySection />
      <FinalCTA />
    </>
  )
}
