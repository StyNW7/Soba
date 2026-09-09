import type { MoodEntry, MoodLabel } from '../types'

export const weeklyMood = [
  { date: 'Mon', score: 72, label: 'Calm' as MoodLabel },
  { date: 'Tue', score: 64, label: 'Okay' as MoodLabel },
  { date: 'Wed', score: 61, label: 'Tired' as MoodLabel },
  { date: 'Thu', score: 58, label: 'Stressed' as MoodLabel },
  { date: 'Fri', score: 70, label: 'Okay' as MoodLabel },
  { date: 'Sat', score: 76, label: 'Calm' as MoodLabel },
  { date: 'Sun', score: 69, label: 'Okay' as MoodLabel },
]

const thirtyDayScores = [
  68, 71, 66, 59, 62, 74, 77, 73, 65, 58, 55, 61, 67, 72, 70, 63, 60, 57, 64, 69, 75, 78, 72, 66,
  61, 58, 70, 76, 69, 71,
]

function labelFor(score: number): MoodLabel {
  if (score >= 74) return 'Calm'
  if (score >= 66) return 'Okay'
  if (score >= 60) return 'Tired'
  if (score >= 56) return 'Stressed'
  return 'Overwhelmed'
}

export const thirtyDayMood = thirtyDayScores.map((score, index) => {
  const dayNumber = index + 1
  const label = dayNumber <= 20 ? `Aug ${dayNumber + 10}` : `Sep ${dayNumber - 20}`
  return {
    date: label,
    score,
    label: labelFor(score),
  }
})

export const moodDistribution = [
  { name: 'Calm', value: 9, color: '#D4954D' },
  { name: 'Okay', value: 11, color: '#E3DEA4' },
  { name: 'Tired', value: 5, color: '#A98970' },
  { name: 'Stressed', value: 4, color: '#775533' },
  { name: 'Overwhelmed', value: 1, color: '#B5654F' },
]

export const weekdayPattern = [
  { day: 'Mon', score: 70 },
  { day: 'Tue', score: 66 },
  { day: 'Wed', score: 60 },
  { day: 'Thu', score: 58 },
  { day: 'Fri', score: 71 },
  { day: 'Sat', score: 77 },
  { day: 'Sun', score: 73 },
]

export const checkinFrequency = [
  { week: 'Week 1', count: 4 },
  { week: 'Week 2', count: 6 },
  { week: 'Week 3', count: 3 },
  { week: 'Week 4', count: 5 },
]

export const moodEntries: MoodEntry[] = [
  {
    id: 'm1',
    date: 'Today',
    isoDate: '2026-09-09',
    score: 69,
    label: 'Okay',
    source: 'check-in',
    note: 'Slept better than the night before.',
  },
  { id: 'm2', date: 'Yesterday', isoDate: '2026-09-08', score: 76, label: 'Calm', source: 'conversation' },
  { id: 'm3', date: '7 Sep', isoDate: '2026-09-07', score: 70, label: 'Okay', source: 'check-in' },
  {
    id: 'm4',
    date: '6 Sep',
    isoDate: '2026-09-06',
    score: 58,
    label: 'Stressed',
    source: 'conversation',
    note: 'Presentation coming up.',
  },
  { id: 'm5', date: '5 Sep', isoDate: '2026-09-05', score: 61, label: 'Tired', source: 'check-in' },
  { id: 'm6', date: '4 Sep', isoDate: '2026-09-04', score: 64, label: 'Okay', source: 'check-in' },
  { id: 'm7', date: '3 Sep', isoDate: '2026-09-03', score: 72, label: 'Calm', source: 'conversation' },
]

export const moodInsights = [
  'Your check-ins were slightly more difficult around Wednesday and Thursday.',
  'You tend to report more stress during weekday evenings.',
  'Weekends have felt steadier for you over the past month.',
]
