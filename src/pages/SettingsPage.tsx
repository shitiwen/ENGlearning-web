import { CalendarPlus, Database, Download, ImagePlus, Save, ScanText, Shield, Upload, WandSparkles } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db, exportBackup, importBackup } from '../db'
import { localDateKey, academicWeek } from '../date'
import { defaultBookForTarget, examTargets, wordBooks } from '../exam'
import { extractCurrentWeek, inferSemesterMonday, parseScheduleOcr, type ScheduleDraft } from '../scheduleOcr'
import type { ExamTarget, ScheduleBlock, WordBookId } from '../types'
import type { LearnerProfile } from '../types'
import type { LearnerProfileInput } from '../learnerProfile'
import { ProfileForm } from '../components/ProfileForm'
import { newId } from '../id'

const weekdays = ['周日','周一','周二','周三','周四','周五','周六']

export function SettingsPage({ profile, onProfileSave }:{ profile?:LearnerProfile|null; onProfileSave?:(input:LearnerProfileInput)=>Promise<void> }) {
  const settings = useLiveQuery(() => db.settings.get('app'))
  const schedule = useLiveQuery(() => db.schedule.orderBy('weekday').toArray()) ?? []
  const today = localDateKey()
  const override = useLiveQuery(() => db.overrides.get(today))
  const inputRef = useRef<HTMLInputElement>(null)
  const restoreRef = useRef<HTMLInputElement>(null)
  const timetableRef = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState('')
  const [ocrStatus, setOcrStatus] = useState('')
  const [ocrText, setOcrText] = useState('')
  const [drafts, setDrafts] = useState<ScheduleDraft[]>([])
  const [currentWeek, setCurrentWeek] = useState(1)
  useEffect(() => { if (settings) setCurrentWeek(academicWeek(settings.semesterStartDate)) }, [settings])
  if (!settings) return null

  const exportData = async () => {
    const backup = await exportBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type:'application/json' })
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `english-loop-backup-${today}.json`; anchor.click(); URL.revokeObjectURL(url)
    setNotice('备份已导出。请把文件保存到安全位置。')
  }
  const importData = async (file:File|undefined, mode:'merge'|'replace') => {
    if (!file) return
    try { await importBackup(JSON.parse(await file.text()), mode); setNotice(mode === 'merge' ? '备份已合并，刷新后可查看。':'已使用备份完整恢复本地数据。') }
    catch (error) { setNotice(error instanceof Error ? `导入失败：${error.message}`:'导入失败') }
  }
  const addSchedule = async (event:React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const fd = new FormData(event.currentTarget)
    const row:ScheduleBlock = { id:newId(), weekday:Number(fd.get('weekday')), label:String(fd.get('label')), start:String(fd.get('start')), end:String(fd.get('end')), weeks:fd.get('weeks') as ScheduleBlock['weeks'] }
    await db.schedule.put(row); event.currentTarget.reset()
  }
  const recognizeTimetable = async (file:File|undefined) => {
    if (!file) return
    setOcrStatus('正在载入中英文 OCR；首次使用会下载并缓存语言模型…'); setDrafts([])
    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker(['chi_sim','eng'], 1, { logger:(message) => {
        if (message.status === 'recognizing text') setOcrStatus(`正在识别图片：${Math.round((message.progress ?? 0)*100)}%`)
      } })
      const result = await worker.recognize(file, { rotateAuto:true })
      await worker.terminate()
      setOcrText(result.data.text)
      const rows = parseScheduleOcr(result.data.text); setDrafts(rows)
      const detectedWeek = extractCurrentWeek(result.data.text); if (detectedWeek) setCurrentWeek(detectedWeek)
      setOcrStatus(rows.length ? `识别出 ${rows.length} 条候选课程${detectedWeek ? `，并读到当前第 ${detectedWeek} 周`:''}，请逐条确认后再导入。`:'识别到了文字，但未找到带星期的完整课程行。可在下方修正文字后重新解析。')
    } catch (error) { setOcrStatus(`OCR 失败：${error instanceof Error ? error.message:'未知错误'}。可以把图片中的文字手动粘贴到下方解析。`) }
    finally { if (timetableRef.current) timetableRef.current.value = '' }
  }
  const parseOcrText = () => { const rows = parseScheduleOcr(ocrText); const detectedWeek = extractCurrentWeek(ocrText); if (detectedWeek) setCurrentWeek(detectedWeek); setDrafts(rows); setOcrStatus(rows.length ? `从文字中解析出 ${rows.length} 条候选课程${detectedWeek ? `，当前周次预填为 ${detectedWeek}`:''}。`:'暂未解析出课程；每行请包含星期、课程名、时间或节次。') }
  const updateDraft = (index:number, patch:Partial<ScheduleDraft>) => setDrafts((old) => old.map((row,i) => i === index ? { ...row, ...patch }:row))
  const importDrafts = async () => {
    const valid:ScheduleBlock[] = drafts.filter((row) => row.label.trim() && row.start && row.end).map((row) => ({ id:row.id, weekday:row.weekday, label:row.label, start:row.start, end:row.end, weeks:row.weeks }))
    if (!valid.length) { setOcrStatus('没有可导入的完整课程，请先补齐课程名和起止时间。'); return }
    await db.schedule.bulkPut(valid); setDrafts([]); setOcrStatus(`已导入 ${valid.length} 条课程；未完整的候选项没有写入。`)
  }
  const selectTarget = async (target:ExamTarget) => db.settings.update('app', { examTarget:target, wordBookId:defaultBookForTarget[target] })

  return <div className="page-stack"><section className="page-title"><div><span className="section-kicker">YOUR RHYTHM</span><h1>时间、目标与数据</h1><p>课表和考试目标会影响计划；识别结果始终由你确认后才保存。</p></div></section>
    {profile && onProfileSave && <section className="panel profile-settings"><div className="settings-title"><Save /><div><h2>个人资料与学习基础</h2><p>随账号跨设备同步；学习明细仍只在当前浏览器。</p></div></div><ProfileForm key={profile.updated_at} profile={profile} onSave={onProfileSave} /></section>}
    <section className="settings-grid"><article className="panel"><div className="settings-title"><CalendarPlus /><div><h2>今天可用时间</h2><p>当天覆盖值优先于默认建议。</p></div></div><div className="form-row"><label>可用分钟<input type="number" min="5" max="180" value={override?.availableMinutes ?? ''} placeholder={String(settings.normalMinutes)} onChange={(event) => db.overrides.put({ date:today, availableMinutes:event.target.value ? Number(event.target.value):undefined, busy:override?.busy ?? false, note:override?.note })} /></label><label className="check-label"><input type="checkbox" checked={override?.busy ?? false} onChange={(event) => db.overrides.put({ date:today, availableMinutes:override?.availableMinutes, busy:event.target.checked, note:override?.note })} /> 今天很忙／军训</label></div><label>临时占用备注<input value={override?.note ?? ''} onChange={(event) => db.overrides.put({ date:today, availableMinutes:override?.availableMinutes, busy:override?.busy ?? false, note:event.target.value })} placeholder="例如：18:30–21:00 军训" /></label></article>
      <article className="panel"><div className="settings-title"><Save /><div><h2>默认时长</h2><p>保底 20、标准 40、加分 55 分钟，可自由修改。</p></div></div><div className="three-fields"><label>保底<input type="number" min="5" max="60" defaultValue={settings.busyMinutes} onBlur={(event) => db.settings.update('app',{ busyMinutes:Number(event.target.value) })} /></label><label>标准<input type="number" min="10" max="90" defaultValue={settings.normalMinutes} onBlur={(event) => db.settings.update('app',{ normalMinutes:Number(event.target.value) })} /></label><label>加分<input type="number" min="15" max="120" defaultValue={settings.bonusMinutes} onBlur={(event) => db.settings.update('app',{ bonusMinutes:Number(event.target.value) })} /></label></div></article></section>

    <section className="panel exam-settings"><div className="settings-title"><WandSparkles /><div><h2>考试目标与词书</h2><p>目标筛选训练范围；词书随目标自动切换，也可以手动覆盖。</p></div></div><div className="exam-choice-grid">{examTargets.map((item) => <button aria-label={item.short} key={item.id} className={settings.examTarget === item.id ? 'active':''} onClick={() => selectTarget(item.id)}><strong>{item.label}</strong><span>{item.description}</span></button>)}</div><div className="form-row"><label>当前词书<select value={settings.wordBookId} onChange={(event) => db.settings.update('app',{ wordBookId:event.target.value as WordBookId })}>{wordBooks.map((book) => <option key={book.id} value={book.id}>{book.label}</option>)}</select></label><label className="check-label"><input type="checkbox" checked={settings.autoUpdatePractice} onChange={(event) => db.settings.update('app',{ autoUpdatePractice:event.target.checked })} /> 每天检查一次已配置的审核题包源</label></div><p className="privacy-note"><Shield size={17} /> 内置材料为原创或注明来源的演示包，不冒充真题；联网题包必须包含来源、许可和校验日期。</p></section>
    <section className="panel"><div className="settings-title"><Save /><div><h2>每轮单词数量</h2><p>默认复习 16 个、新学 8 个；四关训练量较大，可按当天精力调整。</p></div></div><div className="two-fields"><label>到期复习上限<input aria-label="每轮到期复习上限" type="number" min="4" max="40" defaultValue={settings.vocabReviewLimit} onBlur={(event) => db.settings.update('app',{ vocabReviewLimit:Math.max(4,Math.min(40,Number(event.target.value) || 16)) })} /></label><label>未学新词上限<input aria-label="每轮未学新词上限" type="number" min="0" max="20" defaultValue={settings.vocabNewLimit} onBlur={(event) => db.settings.update('app',{ vocabNewLimit:Math.max(0,Math.min(20,Number(event.target.value))) })} /></label></div></section>

    <section className="panel semester-panel"><div className="settings-title"><CalendarPlus /><div><h2>学期基准与单双周</h2><p>当前是第 {academicWeek(settings.semesterStartDate)} 周（{academicWeek(settings.semesterStartDate)%2 ? '单周':'双周'}）。第一周必须以学校校历为准。</p></div></div><div className="semester-infer"><label>本学期第一周周一<input type="date" value={settings.semesterStartDate} onChange={(event) => db.settings.update('app',{ semesterStartDate:event.target.value })} /></label><label>今天在校历中是第几周<input type="number" min="1" max="30" value={currentWeek} onChange={(event) => setCurrentWeek(Number(event.target.value))} /></label><button className="secondary" onClick={() => db.settings.update('app',{ semesterStartDate:inferSemesterMonday(new Date(),currentWeek) })}>反推第一周周一</button><label>听力过渡期<select value={settings.listeningTransitionDays} onChange={(event) => db.settings.update('app',{ listeningTransitionDays:Number(event.target.value) as 7|14 })}><option value="7">1 周</option><option value="14">2 周</option></select></label></div></section>

    <section className="panel timetable-import"><div className="settings-title"><ScanText /><div><h2>从课表图片识别</h2><p>图片仅在浏览器本地 OCR。网格和单双周可能误识别，确认表不会省略。</p></div></div><div className="data-actions"><button className="secondary" onClick={() => timetableRef.current?.click()}><ImagePlus size={17} /> 选择课表截图</button><input ref={timetableRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => recognizeTimetable(event.target.files?.[0])} /><button className="secondary" onClick={parseOcrText}>重新解析下方文字</button></div>{ocrStatus && <p className="notice" role="status">{ocrStatus}</p>}<label>OCR 原始文字（可修正）<textarea rows={5} value={ocrText} onChange={(event) => setOcrText(event.target.value)} placeholder="例如：周一 高等数学 第1-2节 单周" /></label>{drafts.length > 0 && <div className="ocr-drafts">{drafts.map((row,index) => <article key={row.id} className={row.confidence === 'review' ? 'needs-review':''}><select aria-label="候选星期" value={row.weekday} onChange={(event) => updateDraft(index,{ weekday:Number(event.target.value) })}>{weekdays.map((day,i) => <option key={day} value={i}>{day}</option>)}</select><input aria-label="候选课程名" value={row.label} onChange={(event) => updateDraft(index,{ label:event.target.value })} /><select aria-label="候选周次" value={row.weeks} onChange={(event) => updateDraft(index,{ weeks:event.target.value as ScheduleBlock['weeks'] })}><option value="all">每周</option><option value="odd">单周</option><option value="even">双周</option></select><input aria-label="候选开始时间" type="time" value={row.start} onChange={(event) => updateDraft(index,{ start:event.target.value })} /><input aria-label="候选结束时间" type="time" value={row.end} onChange={(event) => updateDraft(index,{ end:event.target.value })} /><button className="text-button" onClick={() => setDrafts((old) => old.filter((_,i) => i !== index))}>移除</button><small>{row.confidence === 'review' ? '需要补全':'字段较完整'} · 原文：{row.raw}</small></article>)}</div>} {drafts.length > 0 && <button className="primary" onClick={importDrafts}>确认并导入完整课程</button>}</section>

    <section className="panel"><div className="settings-title"><CalendarPlus /><div><h2>每周固定课表</h2><p>支持每周、单周和双周；也可继续手动添加。</p></div></div><form className="schedule-form" onSubmit={addSchedule}><select name="weekday" aria-label="星期">{weekdays.map((day,i) => <option value={i} key={day}>{day}</option>)}</select><select name="weeks" aria-label="周次"><option value="all">每周</option><option value="odd">单周</option><option value="even">双周</option></select><input name="label" required placeholder="课程名称" /><input name="start" type="time" required /><input name="end" type="time" required /><button className="secondary" type="submit">添加</button></form><div className="schedule-list">{schedule.map((row) => <div key={row.id}><strong>{weekdays[row.weekday]}</strong><span>{row.weeks === 'odd' ? '单周':row.weeks === 'even' ? '双周':'每周'}</span><span>{row.start}–{row.end}</span><span>{row.label}</span><button className="text-button" onClick={() => db.schedule.delete(row.id)}>删除</button></div>)}</div></section>
    <section className="panel data-panel"><div className="settings-title"><Database /><div><h2>本地数据备份</h2><p>进度只存在当前浏览器，不会自动跨设备同步。</p></div></div><div className="data-actions"><button className="secondary" onClick={exportData}><Download size={17} /> 导出完整 JSON</button><button className="secondary" onClick={() => inputRef.current?.click()}><Upload size={17} /> 合并导入</button><input ref={inputRef} hidden type="file" accept="application/json" onChange={(event) => importData(event.target.files?.[0],'merge')} /><button className="secondary" onClick={() => restoreRef.current?.click()}>完整恢复（替换）</button><input ref={restoreRef} hidden type="file" accept="application/json" onChange={(event) => importData(event.target.files?.[0],'replace')} /></div>{notice && <p className="notice">{notice}</p>}<p className="privacy-note"><Shield size={17} /> 没有账号、云端上传或假同步按钮。清理浏览器网站数据会删除进度，请定期导出。</p></section>
  </div>
}
