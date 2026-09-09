import { ButtonLink } from '../../components/ui/Button'

export default function NotFound() {
  return (
    <section className="container-soba flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-serif text-[72px] leading-none text-apricot/50">404</p>
      <h1 className="mt-4 heading-serif text-[32px] sm:text-[40px]">This page could not be found.</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-secondary">
        The page you were looking for may have moved. Everything else is still where you left it.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink to="/" size="lg">
          Back to home
        </ButtonLink>
        <ButtonLink to="/support" variant="secondary" size="lg">
          Get support
        </ButtonLink>
      </div>
    </section>
  )
}
