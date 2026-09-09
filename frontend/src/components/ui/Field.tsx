import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

const control =
  'w-full rounded-2xl border border-line bg-surface px-4 text-sm text-ink placeholder:text-ink-faint ' +
  'shadow-[inset_0_1px_2px_rgba(82,58,40,0.03)] transition-all duration-200 ease-soba ' +
  'hover:border-line-strong focus:border-apricot focus:outline-none focus:ring-[3px] focus:ring-apricot/20 ' +
  'focus:shadow-[inset_0_1px_2px_rgba(82,58,40,0.02),0_2px_10px_rgba(212,149,77,0.08)] ' +
  'disabled:cursor-not-allowed disabled:bg-muted disabled:text-ink-muted disabled:shadow-none'

interface FieldShellProps {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  children: (id: string, describedBy?: string) => ReactNode
  className?: string
}

export function FieldShell({ label, hint, error, required, children, className }: FieldShellProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <label htmlFor={id} className="text-sm font-medium text-brown-dark">
          {label}
          {required ? (
            <span className="ml-1 text-apricot" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children(id, describedBy)}
      {hint && !error ? (
        <p id={hintId} className="text-xs leading-relaxed text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-terracotta-dark">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label?: string
  hint?: string
  error?: string
  icon?: ReactNode
  className?: string
  wrapperClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, icon, className, wrapperClassName, required, ...props },
  ref,
) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
      {/* The input renders before the icon so the icon can use peer-focus. */}
      {(id, describedBy) => (
        <div className="relative">
          <input
            ref={ref}
            id={id}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            required={required}
            className={cn(
              control,
              'peer h-12',
              icon && 'pl-11',
              error && 'border-terracotta focus:border-terracotta focus:ring-terracotta/25',
              className,
            )}
            {...props}
          />
          {icon ? (
            <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-ink-muted transition-colors duration-200 peer-focus:text-apricot">
              {icon}
            </span>
          ) : null}
        </div>
      )}
    </FieldShell>
  )
})

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  label?: string
  hint?: string
  error?: string
  className?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, required, ...props },
  ref,
) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      {(id, describedBy) => (
        <textarea
          ref={ref}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          required={required}
          className={cn(control, 'min-h-[120px] resize-y py-3.5 leading-relaxed', className)}
          {...props}
        />
      )}
    </FieldShell>
  )
})

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  label?: string
  hint?: string
  error?: string
  className?: string
  options: { value: string; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, options, required, ...props },
  ref,
) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      {(id, describedBy) => (
        <select
          ref={ref}
          id={id}
          aria-describedby={describedBy}
          required={required}
          className={cn(control, 'h-12 appearance-none bg-[length:16px] pr-10', className)}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2378685C' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 1rem center',
          }}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  )
})
