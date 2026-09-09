import type { TrustedContact } from '../types'

export const trustedContacts: TrustedContact[] = [
  {
    id: 'c1',
    name: 'Maria',
    relationship: 'Mother',
    phone: '+62 812 1100 4421',
    status: 'active',
    priority: 'primary',
    canReceiveAlerts: true,
    avatarInitials: 'M',
  },
  {
    id: 'c2',
    name: 'Daniel',
    relationship: 'Brother',
    phone: '+62 813 5522 8090',
    status: 'active',
    priority: 'secondary',
    canReceiveAlerts: false,
    avatarInitials: 'D',
  },
  {
    id: 'c3',
    name: 'Sarah',
    relationship: 'Best Friend',
    phone: '+62 811 9080 3312',
    status: 'invited',
    priority: 'backup',
    canReceiveAlerts: false,
    avatarInitials: 'S',
  },
]
