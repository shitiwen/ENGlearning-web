import type { DailyTask, DateOverride, TaskTier, TrainingSession } from './types'
import { localDateKey } from './date'

// 计划按用户本地日期归档。不能使用 toISOString()，否则中国时区凌晨会被写到前一天。
const dayKey = (date: Date) => localDateKey(date)

export function recommendedMinutes(tier: TaskTier, override: DateOverride | undefined, settings: { busyMinutes: number; normalMinutes: number; bonusMinutes: number }) {
  if (override?.availableMinutes != null) return override.availableMinutes
  if (tier === 'minimum') return settings.busyMinutes
  if (tier === 'bonus') return settings.bonusMinutes
  return override?.busy ? settings.busyMinutes : settings.normalMinutes
}

function adjustment(sessions: TrainingSession[], module: 'listening' | 'reading') {
  const recent = sessions.filter((s) => s.module === module && s.status === 'submitted').slice(-5)
  if (!recent.length) return { factor: 1, reason: '首次安排，先用标准题量建立真实记录' }
  const accuracy = recent.reduce((sum, s) => sum + (s.accuracy ?? 0), 0) / recent.length
  const uncertainty = recent.reduce((sum, s) => sum + (s.uncertaintyRate ?? 0), 0) / recent.length
  if (accuracy < 0.7 || uncertainty > 0.3) return { factor: 0.8, reason: '近期正确率或确定度偏低，本次减量并优先巩固' }
  const lastTwo = recent.slice(-2)
  if (lastTwo.length === 2 && lastTwo.every((s) => (s.accuracy ?? 0) >= 0.85 && (s.uncertaintyRate ?? 1) <= 0.2)) {
    return { factor: 1.1, reason: '最近两次表现稳定，本次小幅增加挑战' }
  }
  return { factor: 1, reason: '根据近期记录保持当前节奏' }
}

export function generateDailyTasks(args: {
  date: Date
  minutes: number
  tier: TaskTier
  dueWords: number
  sessions: TrainingSession[]
  deferred?: DailyTask[]
}): DailyTask[] {
  const { date, minutes, tier, dueWords, sessions, deferred = [] } = args
  const dateString = dayKey(date)
  const formalDay = [2, 4, 6].includes(date.getDay()) && minutes >= 20
  const formalModule = date.getDay() === 4 ? 'reading' : 'listening'
  const adj = adjustment(sessions, formalModule)
  const speakingMinutes = Math.min(10, Math.max(5, Math.round(minutes * .25)))
  const wordMinutes = Math.min(minutes <= 20 ? 5 : 8, Math.max(4, Math.round(minutes * 0.2)))
  const tasks: DailyTask[] = []
  if (dueWords > 0 || minutes >= 10) {
    tasks.push({ id: `${dateString}-vocabulary`, date: dateString, module: 'vocabulary', title: dueWords ? `复习 ${Math.min(dueWords, Math.max(4, wordMinutes))} 个到期词` : '少量单词热身', minutes: wordMinutes, itemCount: Math.min(Math.max(dueWords, 4), Math.max(4, wordMinutes)), tier, status: 'pending', reason: dueWords ? '优先处理到期词与猜对词' : '用少量词汇保持每日接触' })
  }
  tasks.push({ id:`${dateString}-speaking`, date:dateString, module:'speaking', title:`${speakingMinutes} 分钟开口练习`, minutes:speakingMinutes, tier, status:'pending', reason:'跟读、录音回放和自评，建立每日开口习惯' })
  const remaining = Math.max(5, minutes - wordMinutes - speakingMinutes)
  if (formalDay) {
    const formalMinutes = Math.max(8, Math.round((minutes >= 35 ? remaining * .7 : remaining) * adj.factor))
    tasks.push({ id: `${dateString}-${formalModule}`, date: dateString, module: formalModule, title: formalModule === 'listening' ? '听力轮换练习' : '阅读轮换练习', minutes: formalMinutes, tier, status: 'pending', reason: adj.reason })
    const contentMinutes = minutes - wordMinutes - speakingMinutes - formalMinutes
    if (contentMinutes >= 5) tasks.push({ id:`${dateString}-content`, date:dateString, module:'content', title:'短内容输入', minutes:contentMinutes, tier, status:'pending', reason:'时间充足，保留一小段自由英文输入' })
  } else {
    tasks.push({ id: `${dateString}-content`, date: dateString, module: 'content', title: '阅读一则今日内容', minutes: remaining, tier, status: 'pending', reason: '常规日以可理解英文输入为主' })
  }
  for (const old of deferred) {
    if (!tasks.some((t) => t.module === old.module)) tasks.push({ ...old, id: `${dateString}-${old.module}-deferred`, date: dateString, status: 'pending', reason: '由你主动顺延到今天' })
  }
  return tasks
}

export function deferTask(tasks: DailyTask[], taskId: string, nextDate: string) {
  const source = tasks.find((t) => t.id === taskId)
  if (!source) return tasks
  const marked = tasks.map((t) => t.id === taskId ? { ...t, status: 'deferred' as const } : t)
  const target = marked.filter((t) => t.date === nextDate && t.status === 'pending')
  const moved = { ...source, id: `${nextDate}-${source.module}-deferred`, date: nextDate, status: 'pending' as const, reason: '由你主动顺延到此日' }
  if (target.some((t) => t.module === source.module)) return marked
  return [...marked, moved]
}
