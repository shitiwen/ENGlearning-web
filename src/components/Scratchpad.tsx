import { Eraser, PenLine, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { db } from '../db'
import type { Scratchpad as ScratchpadData } from '../types'

export function Scratchpad({ contentId,inline=false }:{ contentId:string;inline?:boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [open,setOpen] = useState(false)
  const [ready,setReady] = useState(false)
  const [error,setError] = useState('')
  const [data,setData] = useState<ScratchpadData>({ contentId,strokes:[],updatedAt:new Date().toISOString() })
  const latest = useRef(data)
  const pointer = useRef<number | null>(null)
  const database = useRef(db)
  const update = (next:ScratchpadData) => { latest.current = next; setData(next) }
  const persist = useCallback(async () => {
    const saved = { ...latest.current,updatedAt:new Date().toISOString() }
    try {
      await database.current.transaction('rw',database.current.scratchpads,async () => {
        const existing = await database.current.scratchpads.get(contentId)
        await database.current.scratchpads.put({ ...existing,...saved,note:existing?.note })
      }); setError('')
    } catch { setError('笔迹保存失败，当前改动仍在页面。请重试保存。') }
  }, [contentId])
  const stop = useCallback(() => {
    const id = pointer.current
    if (id === null) return
    pointer.current = null
    const canvas = canvasRef.current
    if (canvas?.hasPointerCapture(id)) canvas.releasePointerCapture(id)
    void persist()
  }, [persist])
  useEffect(() => {
    let disposed = false
    void database.current.scratchpads.get(contentId).then(saved => { if (!disposed) { if (saved) { latest.current = saved; setData(saved) }; setReady(true) } }).catch(() => { if (!disposed) setError('笔迹读取失败，请重新打开草稿纸。') })
    return () => { disposed = true }
  }, [contentId])
  useEffect(() => {
    window.addEventListener('blur',stop)
    return () => { window.removeEventListener('blur',stop); stop() }
  }, [stop])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !open) return
    const rect = canvas.getBoundingClientRect(), scale = window.devicePixelRatio || 1
    canvas.width = rect.width*scale; canvas.height = rect.height*scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(scale,scale); ctx.lineCap = 'round'
    for (const stroke of data.strokes) {
      ctx.strokeStyle = stroke.color; ctx.lineWidth = stroke.width; ctx.beginPath()
      stroke.points.forEach((p,i) => i ? ctx.lineTo(p.x*rect.width,p.y*rect.height) : ctx.moveTo(p.x*rect.width,p.y*rect.height)); ctx.stroke()
    }
  }, [open,data])
  const point = (event:React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height }
  }
  const start = (event:React.PointerEvent<HTMLCanvasElement>) => {
    if (!ready || pointer.current !== null) return
    pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId)
    update({ ...latest.current,strokes:[...latest.current.strokes,{ color:'#173c35',width:event.pointerType === 'pen' ? Math.max(1.5,event.pressure*4) : 2.5,points:[point(event)] }] })
  }
  const move = (event:React.PointerEvent<HTMLCanvasElement>) => {
    if (pointer.current !== event.pointerId) return
    const next = point(event)
    update({ ...latest.current,strokes:latest.current.strokes.map((stroke,i) => i === latest.current.strokes.length-1 ? { ...stroke,points:[...stroke.points,next] } : stroke) })
  }
  if (!open) return <><button className={inline ? 'secondary compact' : 'scratch-fab'} disabled={!ready} onClick={() => setOpen(true)}><PenLine size={18} /> 手写草稿</button>{error && <p role="alert">{error}</p>}</>
  return <aside className={inline ? 'scratch-panel scratch-inline' : 'scratch-panel'} aria-label="独立手写草稿层">
    <div className="scratch-head"><strong>草稿纸</strong><span>{inline ? '笔迹绑定当前题目' : '退出后可继续选词'}</span><button className="icon-button" onClick={() => { stop(); setOpen(false) }} aria-label="关闭草稿"><X /></button></div>
    <canvas ref={canvasRef} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} />
    {error && <p role="alert">{error}</p>}<div className="data-actions"><button className="secondary compact" onClick={() => void persist()}>保存笔迹</button><button className="secondary compact" onClick={() => { stop(); update({ ...latest.current,strokes:[] }); void persist() }}><Eraser size={16} /> 清空笔迹</button></div>
  </aside>
}
