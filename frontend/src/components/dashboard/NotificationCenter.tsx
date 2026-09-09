import { Bell, BellRing, CircleCheck, HeartHandshake, Info, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Drawer } from '../ui/Modal'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/Feedback'
import { useAppData } from '../../context/AppDataContext'
import type { Role } from '../../types'

const kindIcon: Record<string, LucideIcon> = {
  reminder: Bell,
  update: Info,
  connection: HeartHandshake,
  safety: TriangleAlert,
}

interface NotificationCenterProps {
  open: boolean
  onClose: () => void
  audience: Role
}

export function NotificationCenter({ open, onClose, audience }: NotificationCenterProps) {
  const { notifications, markNotificationRead, markAllRead } = useAppData()
  const visible = notifications.filter((item) => item.audience === audience)
  const unread = visible.filter((item) => !item.read).length

  return (
    <Drawer open={open} onClose={onClose} title="Notifications">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <p className="text-sm text-ink-secondary">
          {unread > 0 ? `${unread} unread` : 'All caught up'}
        </p>
        {unread > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => markAllRead(audience)}>
            <CircleCheck className="h-4 w-4" aria-hidden="true" />
            Mark all read
          </Button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="p-5">
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="Reminders and updates from Soba will appear here."
          />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((item) => {
            const Icon = kindIcon[item.kind] ?? Info
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => markNotificationRead(item.id)}
                  className={cn(
                    'flex w-full gap-3.5 px-5 py-4 text-left transition-colors hover:bg-muted/60',
                    !item.read && 'bg-cream/50',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                      item.kind === 'safety'
                        ? 'bg-terracotta-soft text-terracotta-dark'
                        : 'bg-cream text-brown',
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-sm font-semibold text-brown-dark">{item.title}</span>
                      {!item.read ? (
                        <span
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-apricot"
                          aria-label="Unread"
                        />
                      ) : null}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-ink-secondary">
                      {item.body}
                    </span>
                    <span className="mt-1.5 block text-xs text-ink-muted">{item.time}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Drawer>
  )
}

export function NotificationBell({
  audience,
  onClick,
}: {
  audience: Role
  onClick: () => void
}) {
  const { notifications } = useAppData()
  const unread = notifications.filter((item) => item.audience === audience && !item.read).length

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-line bg-surface text-brown transition-colors hover:bg-cream"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
    >
      {unread > 0 ? <BellRing className="h-[18px] w-[18px]" /> : <Bell className="h-[18px] w-[18px]" />}
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-apricot px-1 text-[10px] font-bold text-white">
          {unread}
        </span>
      ) : null}
    </button>
  )
}
