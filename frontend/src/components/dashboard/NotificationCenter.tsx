import { Bell } from 'lucide-react'
import { Drawer } from '../ui/Modal'
import { AlertsPage } from '../../pages/connected/Connections'
import type { Role } from '../../types'
export function NotificationCenter({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
  audience: Role
}) {
  return (
    <Drawer open={open} onClose={onClose} title="Alerts">
      {open && (
        <div className="p-5">
          <AlertsPage />
        </div>
      )}
    </Drawer>
  )
}
export function NotificationBell({
  onClick,
}: {
  audience: Role
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open alerts"
      className="rounded-xl p-3"
    >
      <Bell className="h-5 w-5" />
    </button>
  )
}
