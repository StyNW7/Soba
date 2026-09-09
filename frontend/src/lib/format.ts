import { format, parseISO } from 'date-fns'

export function formatDate(iso: string, pattern = 'd MMM yyyy') {
  try {
    return format(parseISO(iso), pattern)
  } catch {
    return iso
  }
}

export function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
