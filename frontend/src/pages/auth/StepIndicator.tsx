import { cn } from '../../lib/cn'

export function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-medium text-ink-muted">
        <span>
          Step {current} of {total}
        </span>
        <span>{Math.round((current / total) * 100)}%</span>
      </div>
      <div
        className="mt-2.5 flex gap-1.5"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Step ${current} of ${total}`}
      >
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-300',
              index < current ? 'bg-apricot' : 'bg-muted',
            )}
          />
        ))}
      </div>
    </div>
  )
}
