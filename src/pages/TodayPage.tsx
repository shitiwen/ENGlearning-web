import { ArrowRight, Check, Clock3, FastForward, RotateCcw, Sparkles } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import type { Page } from '../App'
import { academicWeek, localDateKey } from '../date'
import { db } from '../db'
import { generateDailyTasks, recommendedMinutes } from '../planner'
import type { DailyTask, TaskTier } from '../types'

const tierLabels: Record<TaskTier, string> = { minimum: '保底', standard: '标准', bonus: '加分' }
const moduleLabels = { vocabulary: '单词', content: '内容输入', listening: '听力', reading: '阅读', speaking:'口语' }
const dailyQuotes = [
  ['慢一点没关系，只要今天仍在向前。','Slow is still forward.'],
  ['把注意力交给这一刻，进步会自己累积。','Give this moment your full attention.'],
  ['不必一次走很远，先把眼前的一小步走稳。','Make the next small step a steady one.'],
  ['真正的自信，来自一次次完成说过要做的事。','Confidence grows from promises kept to yourself.'],
  ['今天学会的一点，会在未来某天连成答案。','Today’s small lesson will connect with tomorrow’s answer.'],
  ['允许自己不完美，但不要停止练习。','You may be imperfect; just keep practising.'],
  ['专注二十分钟，也是在为更大的目标投票。','Twenty focused minutes are a vote for your future.'],
  ['看懂世界之前，先耐心读完眼前这一段。','Read this paragraph patiently before reading the world.'],
  ['把困难拆小，行动就会比焦虑更有声音。','Make the problem smaller and let action speak louder.'],
  ['重复不是原地踏步，而是在给能力加深刻度。','Repetition is how ability gains depth.'],
  ['不用追赶别人，保持自己的学习节奏。','Keep your own pace; there is no race here.'],
  ['今天愿意开口，明天就少一分害怕。','Speak today, and fear a little less tomorrow.']
]

export function TodayPage({ navigate }: { navigate: (page: Page) => void }) {
  const [now, setNow] = useState(() => new Date())
  const today = localDateKey(now)
  const quote = dailyQuotes[[...today].reduce((sum, char) => sum + char.charCodeAt(0), 0) % dailyQuotes.length]
  const [tier, setTier] = useState<TaskTier>('standard')
  const settings = useLiveQuery(() => db.settings.get('app'))
  const override = useLiveQuery(() => db.overrides.get(today))
  const schedule = useLiveQuery(() => db.schedule.where('weekday').equals(now.getDay()).toArray(), [today]) ?? []
  const tasks = useLiveQuery(() => db.tasks.where('date').equals(today).toArray(), [today])
  const words = useLiveQuery(() => db.vocabulary.toArray()) ?? []
  const sessionsData = useLiveQuery(() => db.sessions.toArray())
  const sessions = useMemo(() => sessionsData ?? [], [sessionsData])
  const dueWords = words.filter((w) => new Date(w.dueAt) <= now).length
  const week = settings ? academicWeek(settings.semesterStartDate, now) : 1
  const activeSchedule = schedule.filter((block) => !block.weeks || block.weeks === 'all' || (block.weeks === 'odd' && week % 2 === 1) || (block.weeks === 'even' && week % 2 === 0))
  const scheduledMinutes = activeSchedule.reduce((sum, block) => {
    const [sh, sm] = block.start.split(':').map(Number), [eh, em] = block.end.split(':').map(Number)
    return sum + Math.max(0, eh * 60 + em - sh * 60 - sm)
  }, 0)
  const effectiveOverride = override ?? { date: today, busy: scheduledMinutes >= 240 }
  const minutes = settings ? recommendedMinutes(tier, effectiveOverride, settings) : 30

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!settings || tasks === undefined) return
    const created = generateDailyTasks({ date: now, minutes, tier, dueWords, sessions })
    if (!tasks.length) db.tasks.bulkPut(created)
    else if (!tasks.some((task) => task.module === 'speaking')) {
      const speaking = created.find((task) => task.module === 'speaking')
      if (speaking) db.tasks.put(speaking)
    }
  }, [settings, tasks, minutes, tier, dueWords, sessions, now])

  const completion = useMemo(() => {
    if (!tasks?.length) return 0
    return Math.round(tasks.filter((t) => t.status === 'completed').length / tasks.length * 100)
  }, [tasks])

  const rebuild = async (nextTier: TaskTier) => {
    if (!settings) return
    setTier(nextTier)
    const nextMinutes = recommendedMinutes(nextTier, effectiveOverride, settings)
    const generated = generateDailyTasks({ date: now, minutes: nextMinutes, tier: nextTier, dueWords, sessions })
    await db.transaction('rw', db.tasks, async () => { await db.tasks.where('date').equals(today).delete(); await db.tasks.bulkPut(generated) })
  }
  const update = (task: DailyTask, status: DailyTask['status']) => db.tasks.update(task.id, { status, ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {}) })
  const start = async (task: DailyTask) => {
    await db.tasks.update(task.id, { status: 'active', startedAt: task.startedAt ?? new Date().toISOString() })
    navigate(task.module === 'content' ? 'content' : task.module === 'vocabulary' ? 'vocabulary' : task.module === 'speaking' ? 'speaking' : 'training')
  }
  const defer = async (task: DailyTask) => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    const nextDate = localDateKey(tomorrow)
    await db.tasks.update(task.id, { status: 'deferred' })
    const tomorrowTasks = await db.tasks.where('date').equals(nextDate).toArray()
    const moved: DailyTask = { ...task, id: `${nextDate}-${task.module}-deferred`, date: nextDate, status: 'pending', reason: '由你主动顺延到此日' }
    const same = tomorrowTasks.find((t) => t.module === task.module)
    if (same) await db.tasks.put({ ...same, ...moved, id: same.id })
    else await db.tasks.put(moved)
  }

  return <div className="page-stack">
    <section className="hero">
      <div><p className="eyebrow">{new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(now)}</p><h1>今天，向前走一点。</h1><p className="daily-quote">{quote[0]}</p><span className="quote-english">{quote[1]}</span></div>
      <div className="progress-orbit"><strong>{completion}%</strong><span>今日完成</span></div>
    </section>

    <section className="today-console">
      <div className="console-topline"><section className="plan-control">
        <div><span className="section-kicker">今日节奏 · 第 {week} 周（{week % 2 ? '单周' : '双周'}）</span><h2>{minutes} 分钟计划</h2><p>{override?.availableMinutes != null ? '采用你为今天设置的可用时间' : effectiveOverride.busy ? `忙碌日：${scheduledMinutes ? `本周课表今日已有 ${Math.round(scheduledMinutes / 60)} 小时安排，` : ''}计划自动收紧` : '普通日：保持轻量输入与训练'}</p></div>
        <div className="segmented" aria-label="任务档位">{(['minimum', 'standard', 'bonus'] as TaskTier[]).map((value) => <button key={value} className={tier === value ? 'active' : ''} onClick={() => rebuild(value)}>{tierLabels[value]}</button>)}</div>
      </section><div className="console-status"><span>DAY PROGRESS</span><strong>{completion}%</strong></div></div>
      <div className="section-heading"><div><span className="section-kicker">TODAY’S LOOP</span><h2>按时间安排今天</h2></div><span className="quiet"><Clock3 size={16} /> 预计 {tasks?.filter((t) => !['completed', 'skipped', 'deferred'].includes(t.status)).reduce((s, t) => s + t.minutes, 0) ?? 0} 分钟</span></div>
      <div className="task-list">
        {tasks?.map((task, index) => <article className={`task-card ${task.status}`} key={task.id}>
          <div className="task-number">{task.status === 'completed' ? <Check /> : String(index + 1).padStart(2, '0')}</div>
          <div className="task-copy"><div className="task-meta"><span>{moduleLabels[task.module]}</span><span>{task.minutes} 分钟</span><span>{tierLabels[task.tier]}</span></div><h3>{task.title}</h3><p><Sparkles size={14} /> {task.reason}</p></div>
          <div className="task-actions">
            {task.status === 'completed' ? <span className="done-label">已完成</span> : task.status === 'skipped' ? <button className="text-button" onClick={() => update(task, 'pending')}><RotateCcw size={15} />恢复</button> : task.status === 'deferred' ? <span className="quiet">已顺延</span> : <>
              <button className="primary compact" onClick={() => start(task)}>开始 <ArrowRight size={16} /></button>
              <button className="text-button" onClick={() => update(task, 'completed')}><Check size={15} />完成</button>
              <button className="text-button" onClick={() => defer(task)}><FastForward size={15} />顺延</button>
              <button className="text-button" onClick={() => update(task, 'skipped')}>跳过</button>
            </>}
          </div>
        </article>)}
      </div><p className="debt-note">任务数量不设硬上限，以总时长接近当天预算为准；跳过不会累积成“欠债”。</p>
    </section>
  </div>
}
