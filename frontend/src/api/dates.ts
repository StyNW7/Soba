function calendarDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}
export function trendRange(now = new Date()) {
  const start = new Date(now)
  start.setDate(start.getDate() - 29)
  const end = new Date(now)
  end.setDate(end.getDate() + 1)
  return `from=${calendarDate(start)}&to=${calendarDate(end)}`
}
export function completeWeeks(weeks: number, now = new Date()) {
  const end = new Date(now)
  end.setDate(end.getDate() - ((end.getDay() + 6) % 7))
  const start = new Date(end)
  start.setDate(start.getDate() - weeks * 7)
  return `from=${calendarDate(start)}&to=${calendarDate(end)}`
}
