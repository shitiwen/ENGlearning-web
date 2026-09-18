import type { ScheduleBlock } from './types'
import { newId } from './id'

const dayAliases:Array<[RegExp,number]> = [
  [/(周日|星期日|星期天)/,0], [/(周一|星期一)/,1], [/(周二|星期二)/,2], [/(周三|星期三)/,3],
  [/(周四|星期四)/,4], [/(周五|星期五)/,5], [/(周六|星期六)/,6]
]
const periodTimes:Record<string,[string,string]> = {
  '1-2':['08:00','09:35'], '3-4':['09:55','11:30'], '5-6':['14:00','15:35'],
  '7-8':['15:55','17:30'], '9-10':['18:30','20:05'], '11-12':['20:15','21:50']
}

export interface ScheduleDraft extends ScheduleBlock { confidence:'high'|'review'; raw:string }

function joinSpacedChinese(value:string) {
  let result = value
  const pattern = /([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g
  while (pattern.test(result)) { pattern.lastIndex = 0; result = result.replace(pattern,'$1') }
  return result
}

export function inferWeekPattern(text:string):ScheduleBlock['weeks'] {
  if (/双周|偶数周/.test(text)) return 'even'
  if (/单周|奇数周/.test(text)) return 'odd'
  const numbers = [...text.matchAll(/\d+/g)].map((item) => Number(item[0])).filter((value) => value > 0 && value <= 30)
  if (numbers.length >= 3 && numbers.every((value) => value % 2 === 0)) return 'even'
  if (numbers.length >= 3 && numbers.every((value) => value % 2 === 1)) return 'odd'
  return 'all'
}

export function extractCurrentWeek(text:string) {
  const match = text.replace(/\s+/g,'').match(/第(\d{1,2})周/)
  if (!match) return undefined
  const week = Number(match[1])
  return week >= 1 && week <= 30 ? week : undefined
}

export function parseScheduleOcr(text:string):ScheduleDraft[] {
  const rows:ScheduleDraft[] = []
  for (const raw of text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)) {
    const normalized = joinSpacedChinese(raw)
    const day = dayAliases.find(([pattern]) => pattern.test(normalized))
    if (!day) continue
    const time = normalized.match(/([01]?\d|2[0-3])[:：.]([0-5]\d)\s*[-—~至]\s*([01]?\d|2[0-3])[:：.]([0-5]\d)/)
    const periods = normalized.match(/第?\s*(\d{1,2})\s*[-—~至]\s*(\d{1,2})\s*节/)
    const mapped = periods ? periodTimes[`${periods[1]}-${periods[2]}`] : undefined
    const start = time ? `${time[1].padStart(2,'0')}:${time[2]}` : mapped?.[0] ?? ''
    const end = time ? `${time[3].padStart(2,'0')}:${time[4]}` : mapped?.[1] ?? ''
    const cleaned = normalized
      .replace(day[0], '').replace(time?.[0] ?? '', '').replace(periods?.[0] ?? '', '')
      .replace(/\(?\s*(单周|双周|每周|奇数周|偶数周|\d+\s*[-—~至]\s*\d+周)\s*\)?/g,'')
      .replace(/[|｜]+/g,' ').trim()
    rows.push({ id:newId(), weekday:day[1], label:cleaned || '待确认课程', start, end, weeks:inferWeekPattern(normalized), confidence:start && end && cleaned ? 'high':'review', raw })
  }
  return rows
}

export function inferSemesterMonday(today:Date, currentWeek:number) {
  const local = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const day = local.getDay() || 7
  local.setDate(local.getDate() - day + 1 - (Math.max(1,currentWeek)-1)*7)
  return `${local.getFullYear()}-${String(local.getMonth()+1).padStart(2,'0')}-${String(local.getDate()).padStart(2,'0')}`
}
