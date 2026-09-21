import { Hero, TrustStrip } from '../../components/landing/Hero'
import {
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
      <RoleSection />
      <SafetySection />
      <FinalCTA />
    </>
  )
}
