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

const E164 = /^\+[1-9][0-9]{6,14}$/

export function normalizePhone(input: string) {
  const compact = input.replace(/[\s()./-]/g, '')
  if (compact.startsWith('+')) return compact
  if (compact.startsWith('0')) return `+62${compact.slice(1)}`
  if (compact.startsWith('62')) return `+${compact}`
  return compact
}

export function isValidPhone(value: string) {
  return E164.test(value)
}

export const PHONE_HINT =
  'Use the international format with a country code, for example +6281297894752.'
