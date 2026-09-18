import { BarChart3, BookOpen, CalendarCheck, GraduationCap, KeyRound, Languages, Mic2, Settings as SettingsIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { activateDatabaseForUser, db, seedDatabase } from './db'
import { ContentPage } from './pages/ContentPage'
import { ReviewPage } from './pages/ReviewPage'
import { SettingsPage } from './pages/SettingsPage'
import { TodayPage } from './pages/TodayPage'
import { TrainingPage } from './pages/TrainingPage'
import { VocabularyPage } from './pages/VocabularyPage'
import { SpeakingPage } from './pages/SpeakingPage'
import { AiSettingsPage } from './pages/AiSettingsPage'
import { AuthPage } from './components/AuthPage'
import { isSupabaseConfigured, supabase } from './supabase'
import { CloudStatsAutoSync } from './components/CloudStatsAutoSync'
import type { CloudSyncStatus } from './cloudSyncStatus'
import { ProfileForm } from './components/ProfileForm'
import { cachedLearnerProfile, fetchLearnerProfile, saveLearnerProfile, type LearnerProfileInput } from './learnerProfile'
import { defaultBookForTarget } from './exam'
import type { LearnerProfile } from './types'

export type Page = 'today' | 'content' | 'vocabulary' | 'speaking' | 'training' | 'review' | 'ai' | 'settings'

const nav: Array<{ id: Page; label: string; icon: typeof CalendarCheck }> = [
  { id: 'today', label: '今天', icon: CalendarCheck },
  { id: 'content', label: '内容', icon: BookOpen },
  { id: 'vocabulary', label: '单词', icon: Languages },
  { id: 'speaking', label: '口语', icon: Mic2 },
  { id: 'training', label: '训练', icon: GraduationCap },
  { id: 'review', label: '复盘', icon: BarChart3 },
  { id: 'ai', label: 'AI 接口', icon: KeyRound },
  { id: 'settings', label: '设置', icon: SettingsIcon }
]

export function App() {
  const [page, setPage] = useState<Page>('today')
  const [ready, setReady] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured)
  const [user, setUser] = useState<User | null>(null)
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>()
  const [profile, setProfile] = useState<LearnerProfile|null>(null)
  const [profileReady, setProfileReady] = useState(!isSupabaseConfigured)
  const [profileError, setProfileError] = useState('')
  useEffect(() => {
    if (!supabase) return
    let live = true
    void supabase.auth.getSession()
      .then(({ data }) => { if (live) setUser(data.session?.user ?? null) })
      .catch(() => { if (live) setUser(null) })
      .finally(() => { if (live) setAuthReady(true) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!live) return
      setUser(session?.user ?? null); setAuthReady(true)
    })
    return () => { live = false; listener.subscription.unsubscribe() }
  }, [])
  useEffect(() => {
    if (!authReady) return
    let live = true
    setReady(false)
    void activateDatabaseForUser(user?.id).then(() => seedDatabase()).then(() => { if (live) setReady(true) }).catch(() => { if (live) setReady(true) })
    return () => { live = false }
  }, [authReady, user?.id])
  const reloadProfile = async (userId:string) => {
    setProfileError('')
    const cached = cachedLearnerProfile(userId)
    if (cached) { setProfile(cached); setProfileReady(true) } else setProfileReady(false)
    try { setProfile(await fetchLearnerProfile(userId)); setProfileReady(true) }
    catch (error) { if (!cached) { setProfileError(error instanceof Error ? error.message:'读取资料失败'); setProfileReady(true) } }
  }
  useEffect(() => {
    if (!user) { setProfile(null); setProfileReady(!isSupabaseConfigured); setProfileError(''); return }
    void reloadProfile(user.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24)
    update(); window.addEventListener('scroll', update, { passive:true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  if (!ready || !authReady) return <main className="loading">正在打开你的学习空间…</main>
  if (isSupabaseConfigured && !user) return <AuthPage />
  if (!profileReady) return <main className="loading">正在读取你的个人资料…</main>
  if (user && profileError) return <main className="auth-shell"><section className="auth-card panel"><h1>暂时无法读取个人资料</h1><p>{profileError}</p><p>如果刚升级，请先在 Supabase SQL Editor 执行新的个人资料 migration。</p><button className="primary" onClick={() => void reloadProfile(user.id)}>重试</button></section></main>
  const saveProfile = async (input:LearnerProfileInput, onboarding=false) => {
    if (!user) return
    const saved = await saveLearnerProfile(user.id,input)
    if (onboarding) await db.settings.update('app',{ examTarget:input.primary_goal, wordBookId:defaultBookForTarget[input.primary_goal], preferredTopics:input.interests })
    setProfile(saved)
  }
  if (user && !profile?.onboarding_completed_at) return <main className="auth-shell onboarding-shell"><section className="auth-card onboarding-card panel"><span className="section-kicker">ONE-MINUTE SETUP</span><h1>先认识一下你</h1><p>这些资料只属于当前账号，用来调整内容、训练推荐和 AI 回答。</p><ProfileForm profile={profile} onboarding onSave={(input) => saveProfile(input,true)} /></section></main>
  const signOut = () => { void supabase?.auth.signOut() }
  return <div className={`app-shell page-${page} ${scrolled ? 'is-scrolled' : ''}`}>
    <header className="topbar">
      <button className="brand" onClick={() => setPage('today')} aria-label="回到今天">
        <span className="brand-mark">E</span><span><strong>English Loop</strong><small>每天的英语输入与训练</small></span>
      </button>
      {user ? <div className="account-chip"><span>{user.phone ?? '已登录'}</span><button onClick={signOut}>退出</button></div> : <span className="local-pill">LOCAL · PRIVATE</span>}
    </header>
    <div className="layout">
      <nav className="side-nav" aria-label="主导航">
        {nav.map((item) => <button key={item.id} aria-label={item.label} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}><item.icon size={20} /><span>{item.label}</span></button>)}
      </nav>
      <main className="main-content">
        {page === 'today' && <TodayPage navigate={setPage} />}
        {page === 'content' && <ContentPage profile={profile} />}
        {page === 'vocabulary' && <VocabularyPage />}
        {page === 'speaking' && <SpeakingPage />}
        {page === 'training' && <TrainingPage profile={profile} />}
        {page === 'review' && <ReviewPage userId={user?.id} cloudSyncStatus={cloudSyncStatus} />}
        {page === 'ai' && <AiSettingsPage />}
        {page === 'settings' && <SettingsPage profile={profile} onProfileSave={(input) => saveProfile(input,false)} />}
      </main>
    </div>
    {user && <CloudStatsAutoSync key={user.id} userId={user.id} onStatusChange={setCloudSyncStatus} />}
  </div>
}
