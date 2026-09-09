import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'dark' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-apricot-400 to-apricot text-white shadow-apricot-glow hover:from-apricot hover:to-apricot-600 hover:shadow-[0_6px_16px_rgba(212,149,77,0.32),0_16px_40px_rgba(212,149,77,0.20)] active:from-apricot-600 active:to-apricot-700',
  secondary:
    'bg-surface text-brown-dark border border-line shadow-card hover:border-apricot-300 hover:bg-cream-tint hover:shadow-soft active:bg-cream',
  outline:
    'border border-brown/25 text-brown-dark hover:border-brown/45 hover:bg-cream/70 active:bg-cream',
  ghost: 'text-ink-secondary hover:bg-muted hover:text-brown-dark active:bg-muted-deep',
  dark: 'bg-gradient-to-b from-brown-600 to-brown-800 text-cream shadow-brown-glow hover:from-brown-700 hover:to-brown-900 active:from-brown-800 active:to-brown-900',
  danger:
    'bg-gradient-to-b from-terracotta to-terracotta-dark text-white shadow-[0_4px_12px_rgba(181,101,79,0.24)] hover:shadow-[0_6px_18px_rgba(181,101,79,0.30)] active:from-terracotta-dark active:to-terracotta-dark',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-5 text-sm gap-2 rounded-2xl',
  lg: 'h-[52px] px-7 text-[15px] gap-2.5 rounded-2xl',
}

interface BaseProps {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  loading?: boolean
  children?: ReactNode
  className?: string
}

export interface ButtonProps
  extends BaseProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> {}

/* A 1px lift on hover and a 1px settle on press: enough to feel physical,
   small enough that nothing shifts around it. */
const base =
  'inline-flex items-center justify-center font-semibold tracking-[-0.005em] whitespace-nowrap select-none ' +
  'transition-all duration-200 ease-soba will-change-transform ' +
  'hover:-translate-y-px active:translate-y-0 active:duration-75 ' +
  'disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:shadow-none'

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', fullWidth, loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  )
})

interface ButtonLinkProps extends BaseProps {
  to: string
  'aria-label'?: string
}

export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      to={to}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...rest}
    >
      {children}
    </Link>
  )
}

/** Compact icon-only control used in toolbars and card corners. */
export function IconButton({
  label,
  children,
  className,
  variant = 'secondary',
  ...props
}: Omit<ButtonProps, 'children'> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        base,
        variants[variant],
        'h-10 w-10 rounded-2xl p-0',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
