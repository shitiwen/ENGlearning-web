import { CheckCircle2, ExternalLink, Mic2, Play, Square, Volume2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db } from '../db'
import { localDateKey } from '../date'
import { newId } from '../id'

interface SpeakingPrompt { id:string; level:string; title:string; text:string; task:string; cues:string[]; accessScope:'china'|'international'|'local'; audioUrl?:string; embedUrl?:string; sourceUrl?:string; sourceLabel?:string }

const prompts: SpeakingPrompt[] = [
  { id:'china-two-sessions-speaking', level:'国内短视频 · 时政', title:'中国日报｜60 秒介绍全国两会', text:'The Two Sessions are important annual meetings where China discusses national priorities, economic development, and policies that affect people’s lives.', task:'先关字幕听一遍，再在播放器中核对；最后用 30 秒说出会议讨论什么。下方文字是本站练习支架，不冒充视频逐字稿。', cues:['annual meetings','national priorities','affect people’s lives'], accessScope:'china', embedUrl:'https://player.bilibili.com/player.html?bvid=BV1c2PPzGEeA&autoplay=0&danmaku=0', sourceUrl:'https://www.bilibili.com/video/BV1c2PPzGEeA/', sourceLabel:'中国日报 · 哔哩哔哩' },
  { id:'china-atom-song-speaking', level:'国内短视频 · 趣味', title:'科普中国｜原子成键之歌', text:'Atoms can share or transfer electrons. These interactions form different kinds of chemical bonds.', task:'听一遍抓住重读词，再模仿其中一小段节奏；最后用两句话解释 chemical bonds。文字是练习支架，不是原字幕。', cues:['share electrons','transfer electrons','chemical bonds'], accessScope:'china', embedUrl:'https://player.bilibili.com/player.html?bvid=BV1NW411u7pk&autoplay=0&danmaku=0', sourceUrl:'https://www.bilibili.com/video/BV1NW411u7pk/', sourceLabel:'科普中国 · 哔哩哔哩' },
  { id:'bbc-work-speaking', level:'国外短视频 · 情景', title:'BBC｜English at Work', text:'Starting a new job can feel awkward. A clear introduction should say who you are, what you do, and how you can help the team.', task:'观看一小段办公室动画，暂停模仿角色语气；再给自己设计一段 30 秒入职自我介绍。', cues:['introduce yourself','describe your role','offer help'], accessScope:'international', embedUrl:'https://www.youtube.com/embed/Aj-EnsvU5Q0?rel=0&cc_lang_pref=en', sourceUrl:'https://www.youtube.com/watch?v=Aj-EnsvU5Q0', sourceLabel:'BBC Learning English · YouTube' },
  { id:'voa-laser-shadowing', level:'国外真人广播', title:'VOA｜激光改变世界', text:'This week, we tell about one of the most recognizable objects in science fiction — the laser. And we tell how the laser has made its mark in the fifty years since its invention.', task:'播放真人广播开头，按意群暂停并跟读；最后不看文本复述主旨。', cues:['recognizable objects','made its mark','since its invention'], accessScope:'international', audioUrl:'https://www.voanews.com/MediaAssets2/learningenglish/2010_08/se-exp-lasers-1sep10.mp3', sourceUrl:'https://learningenglish.voanews.com/a/after-50-years-lasers-have-made-their-mark-101939778/112858.html', sourceLabel:'VOA Learning English · 2010-08-31' },
  { id:'voa-recycling-shadowing', level:'国外真人广播', title:'VOA｜电子废弃物回收', text:'Each year, Americans throw away millions of tons of electronic devices. That means business is good for a small electronics recycler in Chantilly, Virginia.', task:'听真人新闻开头，模仿重音与停顿，然后用一句自己的话概括。', cues:['throw away','electronic devices','electronics recycler'], accessScope:'international', audioUrl:'https://www.voanews.com/MediaAssets2/learningenglish/dalet/se-tech-pcrecycler-30oct10.Mp3', sourceUrl:'https://learningenglish.voanews.com/a/pc-recycler-strikes-gold-in-old-computer-chips-106406314/116777.html', sourceLabel:'VOA Learning English · 2010-10-31' },
  { id:'campus-intro', level:'本站热身', title:'介绍你的学习生活', text:'I am an English learner. This week, I am learning how to balance study, rest, and English practice.', task:'先跟读两遍，再不用看文本，用 30–60 秒介绍今天的学习生活。', cues:['What did you study today?','What was difficult?','What will you do tomorrow?'], accessScope:'local' },
  { id:'explain-chip', level:'本站专业表达', title:'解释芯片为什么重要', text:'A chip contains many tiny electronic components. Together, they can process information, store data, or control a device. Reliable manufacturing is important because even a very small defect may affect performance.', task:'跟读后，用自己的话向非工科同学解释芯片。', cues:['What is inside a chip?','Where are chips used?','Why is manufacturing difficult?'], accessScope:'local' },
  { id:'opinion-tech', level:'本站观点表达', title:'科技是否让学习更专注', text:'Technology gives students quick access to information, but constant notifications can break their concentration. The useful question is not whether technology is good or bad, but how we choose to use it.', task:'给出观点、一个理由和一个自己的例子，连续说 45–90 秒。', cues:['State your opinion','Give one reason','Add a personal example'], accessScope:'local' }
]

function speak(text:string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'en-US'; utterance.rate = .86
  window.speechSynthesis.speak(utterance)
}

const stopReference = () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel() }

export function SpeakingPage() {
  const recent = useLiveQuery(() => db.sessions.where('module').equals('speaking').reverse().sortBy('startedAt')) ?? []
  const [prompt, setPrompt] = useState<SpeakingPrompt | null>(null)
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState('')
  const [repetitions, setRepetitions] = useState(0)
  const [fluency, setFluency] = useState<1|2|3|4|5>(3)
  const [clarity, setClarity] = useState<1|2|3|4|5>(3)
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  const [scope, setScope] = useState<'china'|'international'|'local'>('china')
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const chunks = useRef<Blob[]>([])
  const startedAt = useRef(0)
  const referenceAudio = useRef<HTMLAudioElement | null>(null)

  useEffect(() => () => { stopReference(); referenceAudio.current?.pause(); stream.current?.getTracks().forEach((track) => track.stop()); if (audioUrl) URL.revokeObjectURL(audioUrl) }, [audioUrl])

  const begin = (item:SpeakingPrompt) => {
    stopReference()
    setPrompt(item); setDone(false); setRepetitions(0); setNote(''); setMessage(''); startedAt.current = Date.now()
  }
  const startRecording = async () => {
    stopReference(); referenceAudio.current?.pause()
    if (!navigator.mediaDevices?.getUserMedia || !('MediaRecorder' in window)) { setMessage('当前地址或浏览器不支持录音。你仍可计时开口并完成自评；录音通常需要 HTTPS 或 localhost。'); return }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio:true })
      chunks.current = []
      const next = new MediaRecorder(stream.current)
      next.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data) }
      next.onstop = () => {
        if (audioUrl) URL.revokeObjectURL(audioUrl)
        setAudioUrl(URL.createObjectURL(new Blob(chunks.current, { type:next.mimeType || 'audio/webm' })))
        stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null
        setRepetitions((value) => value + 1)
      }
      recorder.current = next; next.start(); setRecording(true); setMessage('正在录音，只保留在当前页面用于回放。')
    } catch { setMessage('未获得麦克风权限。可以在浏览器站点设置中允许麦克风，或直接完成无录音练习。') }
  }
  const stopRecording = () => { recorder.current?.stop(); setRecording(false); setMessage('已录好。先回放一次，再根据真实感受自评。') }
  const exitPractice = () => {
    stopReference(); referenceAudio.current?.pause()
    if (recorder.current?.state === 'recording') recorder.current.stop()
    stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null
    setRecording(false); setPrompt(null)
  }
  const finish = async () => {
    if (!prompt) return
    const now = new Date().toISOString(), elapsedMs = Math.max(60_000, Date.now() - startedAt.current)
    await db.sessions.put({ id:newId(), packId:`speaking-${prompt.id}`, module:'speaking', startedAt:new Date(startedAt.current).toISOString(), updatedAt:now, submittedAt:now, elapsedMs, answers:[], status:'submitted', speakingResult:{ promptId:prompt.id, repetitions, fluency, clarity, note:note.trim() || undefined } })
    const task = await db.tasks.where('date').equals(localDateKey()).filter((row) => row.module === 'speaking' && row.status !== 'completed').first()
    if (task) await db.tasks.update(task.id, { status:'completed', completedAt:now })
    setDone(true)
  }

  if (done) return <section className="empty-state"><CheckCircle2 /><h1>今天已经真正开口了</h1><p>记录了 {repetitions} 轮录音、流利度 {fluency}/5、清晰度 {clarity}/5。评分是你的自评，不是假装精确的 AI 分数。</p><button className="primary" onClick={() => setPrompt(null)}>返回口语专栏</button></section>
  if (prompt) return <div className="speaking-session page-stack">
    <button className="back-button" onClick={exitPractice}>← 退出本次练习</button>
    <section className="speaking-prompt panel"><span className="section-kicker">{prompt.level}</span><h1>{prompt.title}</h1>{prompt.embedUrl && <iframe className="speaking-embed" src={prompt.embedUrl} title={`${prompt.title} 播放器`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />}<blockquote>{prompt.text}</blockquote>{prompt.audioUrl ? <div className="human-reference"><audio ref={referenceAudio} controls preload="metadata" src={prompt.audioUrl} onPlay={stopReference} /><span>{prompt.sourceLabel}</span>{prompt.sourceUrl && <a href={prompt.sourceUrl} target="_blank" rel="noreferrer">查看真人素材来源 <ExternalLink size={14} /></a>}</div> : !prompt.embedUrl ? <div className="reference-actions"><button className="secondary" onClick={() => speak(prompt.text)}><Volume2 size={17} /> 听设备参考音</button><button className="text-button" onClick={stopReference}><Square size={15} /> 停止参考音</button></div> : prompt.sourceUrl && <a className="source-inline" href={prompt.sourceUrl} target="_blank" rel="noreferrer">打开素材来源 <ExternalLink size={14} /></a>}<p>{prompt.task}</p><div className="cue-row">{prompt.cues.map((cue) => <span key={cue}>{cue}</span>)}</div></section>
    <section className="recording-panel panel"><h2>录音、回放、再说一遍</h2><p>建议录 2–3 轮，每轮只改一个问题：停顿、重音或表达组织。</p><div className="record-actions">{!recording ? <button className="primary" onClick={startRecording}><Mic2 /> 开始录音</button> : <button className="danger-button" onClick={stopRecording}><Square /> 停止录音</button>}<strong>已录 {repetitions} 轮</strong></div>{audioUrl && <audio controls src={audioUrl} />} {message && <p className="notice">{message}</p>}<small>录音不会上传，也不会写入长期备份；离开页面后释放。练习结果会保存在本地。</small></section>
    <section className="panel self-rating"><h2>完成前自评</h2><div className="rating-grid"><Rating label="流利度" value={fluency} setValue={setFluency} /><Rating label="清晰度" value={clarity} setValue={setClarity} /></div><label>下次只改一件事<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：少用 um；句尾不要吞音；先说结论。" /></label><button className="primary full-button" disabled={recording} onClick={finish}>完成并保存记录</button></section>
  </div>

  return <div className="page-stack"><section className="page-title"><div><span className="section-kicker">SPEAKING</span><h1>每天开口 10 分钟</h1><p>素材不再只有 VOA；国内短视频、国外真人内容和本站话题分开选择。录音不上传。</p></div></section><section className="source-filter panel"><div><strong>口语素材线路</strong><span>国内源优先，国外源受网络影响，本站话题无需联网。</span></div><div className="segmented"><button className={scope === 'china' ? 'active' : ''} onClick={() => setScope('china')}>国内源</button><button className={scope === 'international' ? 'active' : ''} onClick={() => setScope('international')}>国外源</button><button className={scope === 'local' ? 'active' : ''} onClick={() => setScope('local')}>本站话题</button></div></section><div className="speaking-grid">{prompts.filter((item) => item.accessScope === scope).map((item) => <article className="training-card" key={item.id}><span className="content-kind">{item.level}</span><h2>{item.title}</h2><p>{item.task}</p><button className="primary" onClick={() => begin(item)}>开始练习 <Play size={16} /></button></article>)}</div><section className="panel"><h2>近期口语记录</h2>{recent.length ? <div className="speaking-history">{recent.slice(0,6).map((session) => <p key={session.id}><strong>{new Date(session.startedAt).toLocaleDateString('zh-CN')}</strong><span>录音 {session.speakingResult?.repetitions ?? 0} 轮 · 流利度 {session.speakingResult?.fluency ?? '-'}/5 · 清晰度 {session.speakingResult?.clarity ?? '-'}/5</span></p>)}</div> : <p className="empty-copy">完成第一次练习后，这里会出现真实记录。</p>}</section></div>
}

function Rating({ label, value, setValue }:{ label:string; value:1|2|3|4|5; setValue:(value:1|2|3|4|5)=>void }) {
  return <div><strong>{label}</strong><div className="rating-buttons">{([1,2,3,4,5] as const).map((score) => <button className={value === score ? 'selected' : ''} onClick={() => setValue(score)} key={score}>{score}</button>)}</div></div>
}
