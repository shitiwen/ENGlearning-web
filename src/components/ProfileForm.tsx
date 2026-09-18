import { useState } from 'react'
import { Save, Shield } from 'lucide-react'
import { examTargets } from '../exam'
import type { LearnerProfile } from '../types'
import type { LearnerProfileInput } from '../learnerProfile'

const ageBands = [['under-15','15 岁以下'],['15-17','15–17 岁'],['18-22','18–22 岁'],['23-30','23–30 岁'],['31-plus','31 岁及以上']] as const
const stages = [['middle-school','初中'],['high-school','高中'],['college','大学'],['postgraduate','研究生'],['working','工作'],['other','其他']] as const
const levels = [['beginner','入门'],['foundation','基础'],['intermediate','中等'],['strong','较强']] as const
const topicChoices = ['中国','国际新闻','科技','半导体','校园','文化','商业','体育','趣味']

export function ProfileForm({ profile, onboarding=false, onSave }:{ profile?:LearnerProfile|null; onboarding?:boolean; onSave:(input:LearnerProfileInput)=>Promise<void> }) {
  const [form,setForm] = useState<LearnerProfileInput>(() => ({
    display_name:profile?.display_name ?? '', age_band:profile?.age_band ?? '18-22', learner_stage:profile?.learner_stage ?? 'college', grade_label:profile?.grade_label ?? '', field_of_study:profile?.field_of_study ?? '', english_level:profile?.english_level ?? 'intermediate', recent_exam_name:profile?.recent_exam_name ?? '', recent_exam_score:profile?.recent_exam_score ?? null, recent_exam_max_score:profile?.recent_exam_max_score ?? null, recent_exam_date:profile?.recent_exam_date ?? null, primary_goal:profile?.primary_goal ?? 'cet4', interests:profile?.interests ?? []
  }))
  const [customTopic,setCustomTopic] = useState('')
  const [notice,setNotice] = useState('')
  const [busy,setBusy] = useState(false)
  const patch = <K extends keyof LearnerProfileInput>(key:K,value:LearnerProfileInput[K]) => setForm((old) => ({ ...old,[key]:value }))
  const toggleTopic = (topic:string) => patch('interests',form.interests.includes(topic) ? form.interests.filter((item) => item !== topic) : [...form.interests,topic].slice(0,12))
  const submit = async (event:React.FormEvent) => {
    event.preventDefault(); setNotice('')
    if (!form.display_name.trim() || !form.grade_label.trim()) { setNotice('请填写昵称和年级／当前阶段。'); return }
    if (!form.interests.length) { setNotice('请至少选择一个感兴趣的主题。'); return }
    if ((form.recent_exam_score ?? 0) < 0 || (form.recent_exam_max_score ?? 0) < 0 || (form.recent_exam_score != null && form.recent_exam_max_score != null && form.recent_exam_score > form.recent_exam_max_score)) { setNotice('考试得分不能高于满分。'); return }
    setBusy(true)
    try { await onSave({ ...form, display_name:form.display_name.trim(), grade_label:form.grade_label.trim(), field_of_study:form.field_of_study.trim(), recent_exam_name:form.recent_exam_name.trim() }); setNotice(onboarding ? '资料已保存，正在进入学习空间…':'个人资料已保存并同步。') }
    catch (error) { setNotice(`保存失败：${error instanceof Error ? error.message:'未知错误'}。表单内容已保留，请重试。`) }
    finally { setBusy(false) }
  }
  const fieldLabel = form.learner_stage === 'college' || form.learner_stage === 'postgraduate' ? '专业（可选）' : form.learner_stage === 'working' ? '职业方向（可选）':'学习方向（可选）'
  return <form className="profile-form" onSubmit={submit}>
    <div className="profile-grid"><label>昵称<input value={form.display_name} maxLength={40} onChange={(e) => patch('display_name',e.target.value)} placeholder="用于本站称呼你" /></label><label>年龄段<select value={form.age_band} onChange={(e) => patch('age_band',e.target.value as LearnerProfileInput['age_band'])}>{ageBands.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>学习身份<select value={form.learner_stage} onChange={(e) => patch('learner_stage',e.target.value as LearnerProfileInput['learner_stage'])}>{stages.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>年级／当前阶段<input value={form.grade_label} maxLength={40} onChange={(e) => patch('grade_label',e.target.value)} placeholder="例如：大一、高三、工作第 2 年" /></label><label>{fieldLabel}<input value={form.field_of_study} maxLength={80} onChange={(e) => patch('field_of_study',e.target.value)} /></label><label>英语基础<select value={form.english_level} onChange={(e) => patch('english_level',e.target.value as LearnerProfileInput['english_level'])}>{levels.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>当前主要目标<select value={form.primary_goal} onChange={(e) => patch('primary_goal',e.target.value as LearnerProfileInput['primary_goal'])}>{examTargets.map((target) => <option value={target.id} key={target.id}>{target.label}</option>)}</select></label></div>
    <fieldset><legend>兴趣主题（至少一项）</legend><div className="topic-picker">{topicChoices.map((topic) => <button type="button" className={form.interests.includes(topic)?'active':''} onClick={() => toggleTopic(topic)} key={topic}>{topic}</button>)}</div><div className="custom-topic"><input value={customTopic} maxLength={20} onChange={(e) => setCustomTopic(e.target.value)} placeholder="自定义主题" /><button type="button" className="secondary" onClick={() => { const value=customTopic.trim(); if (value && !form.interests.includes(value)) patch('interests',[...form.interests,value].slice(0,12)); setCustomTopic('') }}>添加</button></div></fieldset>
    <fieldset><legend>最近一次真实成绩（可选，不用于估算词汇量）</legend><div className="profile-grid score-grid"><label>考试名称<input value={form.recent_exam_name} maxLength={50} onChange={(e) => patch('recent_exam_name',e.target.value)} placeholder="例如：高考英语" /></label><label>得分<input type="number" min="0" value={form.recent_exam_score ?? ''} onChange={(e) => patch('recent_exam_score',e.target.value===''?null:Number(e.target.value))} /></label><label>满分<input type="number" min="1" value={form.recent_exam_max_score ?? ''} onChange={(e) => patch('recent_exam_max_score',e.target.value===''?null:Number(e.target.value))} /></label><label>考试日期<input type="date" value={form.recent_exam_date ?? ''} onChange={(e) => patch('recent_exam_date',e.target.value||null)} /></label></div></fieldset>
    <p className="privacy-note"><Shield size={17} /> 资料只用于当前账号的学习推荐，不发送手机号给 AI；可在设置中随时修改。</p>{notice && <p className="notice" role="status">{notice}</p>}<button className="primary" disabled={busy} type="submit"><Save size={17} /> {busy?'保存中…':onboarding?'保存并开始学习':'保存个人资料'}</button>
  </form>
}
