import { CircleHelp, Globe, MapPin, PhoneCall, Stethoscope, Users } from 'lucide-react'
import { PageHero } from '../../components/landing/PageHero'
import { FinalCTA } from '../../components/landing/Sections'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Avatar } from '../../components/ui/Badge'
import { ButtonLink } from '../../components/ui/Button'
import { Reveal, SectionHeading } from '../../components/ui/Brand'
import { AlertCard } from '../../components/ui/Feedback'
import { crisisResources, professionals } from '../../data/mockProfessionals'

const pathways = [
  {
    icon: Users,
    title: 'Someone you already trust',
    copy: 'Your Circle of Trust is the first and usually the best route. Soba helps you reach them without having to explain everything first.',
  },
  {
    icon: Stethoscope,
    title: 'A professional',
    copy: 'Psychologists, counsellors, and psychiatrists, filtered by language, location, and whether they work online.',
  },
  {
    icon: PhoneCall,
    title: 'Crisis support',
    copy: 'When something is urgent, Soba points to services staffed by people, not to more conversation with AI.',
  },
]

const faqs = [
  {
    q: 'Does Soba replace therapy?',
    a: 'No. Soba is an emotional support companion for everyday moments. It does not diagnose, treat, or replace a licensed professional.',
  },
  {
    q: 'Can my parent read my conversations?',
    a: 'No. Conversation transcripts and journal entries are never shared with a guardian by default. Guardians see wellbeing patterns and safety alerts only.',
  },
  {
    q: 'What happens if I say something serious?',
    a: 'Soba moves into a safety-focused mode, offers to help you reach someone you trust or a professional, and can notify a guardian that a check-in is recommended without sharing what you said.',
  },
  {
    q: 'Is Soba free?',
    a: 'The app is free during the pilot. The Soba Companion device is sold separately, and the app works fully without it.',
  },
]

export default function Support() {
  return (
    <>
      <PageHero
        eyebrow="Professional & human support"
        title="Some conversations should lead to a human."
        description="Soba is built to hand things over well. Here is where those handovers go."
      />

      <section className="py-20 lg:py-24">
        <div className="container-soba">
          <Reveal>
            <SectionHeading eyebrow="Pathways" title="Three routes out of a difficult moment." />
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {pathways.map((pathway, index) => (
              <Reveal key={pathway.title} delay={index * 80}>
                <Card padding="lg" interactive className="h-full">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cream text-brown">
                    <pathway.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight text-brown-dark">
                    {pathway.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{pathway.copy}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-cream/70 py-20 lg:py-24">
        <div className="container-soba">
          <Reveal>
            <SectionHeading
              eyebrow="Directory"
              title="Practitioners in the Soba network."
              description="A sample of the reviewed practitioners available inside the app. Availability shown is indicative, not a booking."
            />
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {professionals.slice(0, 6).map((professional, index) => (
              <Reveal key={professional.id} delay={index * 60}>
                <Card padding="lg" className="flex h-full flex-col">
                  <div className="flex items-start gap-3.5">
                    <Avatar initials={professional.avatarInitials} size="lg" tone="cream" />
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-brown-dark">
                        {professional.name}
                      </h3>
                      <p className="text-sm text-ink-secondary">{professional.role}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {professional.specializations.slice(0, 2).map((spec) => (
                      <Badge key={spec} tone="cream">
                        {spec}
                      </Badge>
                    ))}
                  </div>
                  <dl className="mt-5 space-y-2 text-sm text-ink-secondary">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                      <dd>{professional.location}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
                      <dd>{professional.languages.join(', ')}</dd>
                    </div>
                  </dl>
                  <p className="mt-5 border-t border-line pt-4 text-sm text-ink-secondary">
                    Next availability{' '}
                    <span className="font-semibold text-brown-dark">{professional.nextAvailable}</span>
                  </p>
                </Card>
              </Reveal>
            ))}
          </div>
          <Reveal delay={160}>
            <div className="mt-10 text-center">
              <ButtonLink to="/signup" size="lg">
                Browse the full directory in Soba
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="py-20 lg:py-24">
        <div className="container-soba grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <SectionHeading eyebrow="Questions" title="Things people ask first." />
            <div className="mt-8">
              <AlertCard tone="urgent" title="Need support now?">
                Soba is not an emergency service. If there is immediate risk, contact emergency
                services on 112, or the SEJIWA support line on 119 extension 8.
              </AlertCard>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="space-y-4">
              {faqs.map((faq) => (
                <Card key={faq.q} padding="lg">
                  <h3 className="flex items-start gap-2.5 text-base font-semibold text-brown-dark">
                    <CircleHelp className="mt-0.5 h-[18px] w-[18px] shrink-0 text-apricot" aria-hidden="true" />
                    {faq.q}
                  </h3>
                  <p className="mt-2.5 pl-[30px] text-sm leading-relaxed text-ink-secondary">{faq.a}</p>
                </Card>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-brown py-16 text-cream">
        <div className="container-soba">
          <h2 className="heading-serif text-[30px] text-cream sm:text-[38px]">Crisis resources</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-cream/70">
            These services are staffed by people. Use them directly rather than through Soba if
            something is happening right now.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {crisisResources.map((resource) => (
              <div key={resource.id} className="rounded-3xl border border-cream/15 bg-cream/[0.06] p-6">
                <p className="text-base font-semibold text-cream">{resource.name}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-cream/70">{resource.detail}</p>
                <p className="mt-4 font-serif text-2xl text-custard">{resource.contact}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FinalCTA />
    </>
  )
}
