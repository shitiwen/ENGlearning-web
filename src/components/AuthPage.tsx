import { KeyRound, LoaderCircle, LogIn, Phone, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { normalizePhone, phoneToAuthEmail, supabase } from '../supabase'

type Mode = 'login' | 'register'

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event:React.FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    const normalized = normalizePhone(phone)
    if (!/^\+\d{8,15}$/.test(normalized)) { setNotice('请输入手机号，例如 13800138000 或 +8613800138000。'); return }
    if (password.length < 8) { setNotice('密码至少需要 8 位。'); return }
    setBusy(true); setNotice('')
    try {
      const email = phoneToAuthEmail(normalized)
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { phone: normalized } },
        })
        if (error) throw error
        if (!data.session) setNotice('账号已创建，但未自动登录。请在 Supabase 后台关闭 Confirm email 后重试登录；本产品不发送短信或邮件。')
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : '操作失败，请稍后再试。') }
    finally { setBusy(false) }
  }

  return <main className="auth-shell"><section className="auth-card panel"><span className="section-kicker">ENGLISH LOOP ACCOUNT</span><h1>{mode === 'login' ? '登录你的学习空间' : '创建学习账号'}</h1><p>使用手机号和密码。第一版不发送短信或邮件验证码；手机号只是未验证的账号名。学习明细仍保存在当前浏览器；云端只保存账号资料与汇总统计。</p><div className="auth-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setNotice('') }}><LogIn size={16} /> 登录</button><button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setNotice('') }}><UserPlus size={16} /> 注册</button></div><form onSubmit={submit}><label><Phone size={16} /> 手机号<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" placeholder="13800138000" /></label><label><KeyRound size={16} /> 密码<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="至少 8 位" /></label>{notice && <p className="notice" role="status">{notice}</p>}<button className="primary auth-submit" disabled={busy} type="submit">{busy ? <LoaderCircle className="spin" size={17} /> : mode === 'login' ? <LogIn size={17} /> : <UserPlus size={17} />}{busy ? '正在处理…' : mode === 'login' ? '登录' : '注册并进入'}</button></form><small>手机号并未验证归属，且暂不支持自助找回密码。请妥善保管密码；正式公开前应增加找回或二次验证机制。</small></section></main>
}
