import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'dark' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary:
    'bg-apricot text-white shadow-[0_6px_18px_rgba(212,149,77,0.28)] hover:bg-apricot-hover active:bg-apricot-storm',
  secondary: 'bg-cream text-brown-dark border border-line hover:bg-custard/60',
  outline: 'border border-brown/25 text-brown-dark hover:border-brown/50 hover:bg-cream/60',
  ghost: 'text-ink-secondary hover:bg-muted hover:text-brown-dark',
  dark: 'bg-brown text-cream hover:bg-brown-dark shadow-[0_6px_18px_rgba(82,58,40,0.22)]',
  danger: 'bg-terracotta text-white hover:bg-terracotta-dark shadow-[0_6px_18px_rgba(181,101,79,0.25)]',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-5 text-sm gap-2 rounded-2xl',
  lg: 'h-[52px] px-7 text-base gap-2.5 rounded-2xl',
}

interface BaseProps {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  loading?: boolean
  children?: ReactNode
  className?: string
}

export interface ButtonProps extends BaseProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> {}

const base =
  'inline-flex items-center justify-center font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-55 select-none whitespace-nowrap'

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
