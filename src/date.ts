export const localDateKey = (date = new Date()) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function nextLocalDay(date = new Date()) {
  const next = new Date(date)
  next.setDate(next.getDate() + 1)
  next.setHours(0, 0, 0, 0)
  return next
}

export function academicWeek(startDate: string, date = new Date()) {
  const start = new Date(`${startDate}T00:00:00`)
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (Number.isNaN(start.getTime()) || target < start) return 1
  return Math.floor((target.getTime() - start.getTime()) / 604800000) + 1
}
