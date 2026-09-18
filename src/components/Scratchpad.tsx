import { Eraser, PenLine, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { db } from '../db'
import type { Scratchpad as ScratchpadData } from '../types'

export function Scratchpad({ contentId }: { contentId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<ScratchpadData>({ contentId, strokes: [], updatedAt: new Date().toISOString() })
  const drawing = useRef(false)

  useEffect(() => { db.scratchpads.get(contentId).then((saved) => saved && setData(saved)) }, [contentId])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !open) return
    const rect = canvas.getBoundingClientRect()
    const scale = window.devicePixelRatio || 1
    canvas.width = rect.width * scale
    canvas.height = rect.height * scale
    const ctx = canvas.getContext('2d')!
    ctx.scale(scale, scale)
    ctx.lineCap = 'round'
    for (const stroke of data.strokes) {
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.width
      ctx.beginPath()
      stroke.points.forEach((p, i) => i ? ctx.lineTo(p.x * rect.width, p.y * rect.height) : ctx.moveTo(p.x * rect.width, p.y * rect.height))
      ctx.stroke()
    }
  }, [open, data])

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }
  }
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    setData((old) => ({ ...old, strokes: [...old.strokes, { color: '#173c35', width: event.pointerType === 'pen' ? Math.max(1.5, event.pressure * 4) : 2.5, points: [point(event)] }] }))
  }
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const next = point(event)
    setData((old) => ({ ...old, strokes: old.strokes.map((s, i) => i === old.strokes.length - 1 ? { ...s, points: [...s.points, next] } : s) }))
  }
  const stop = async () => {
    if (!drawing.current) return
    drawing.current = false
    const saved = { ...data, updatedAt: new Date().toISOString() }
    await db.scratchpads.put(saved)
  }

  if (!open) return <button className="scratch-fab" onClick={() => setOpen(true)}><PenLine size={18} /> 手写草稿</button>
  return <aside className="scratch-panel" aria-label="独立手写草稿层">
    <div className="scratch-head"><strong>草稿纸</strong><span>退出后可继续选词</span><button className="icon-button" onClick={() => setOpen(false)} aria-label="关闭草稿"><X /></button></div>
    <canvas ref={canvasRef} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} />
    <button className="secondary compact" onClick={async () => { const empty = { contentId, strokes: [], updatedAt: new Date().toISOString() }; setData(empty); await db.scratchpads.put(empty) }}><Eraser size={16} /> 清空</button>
  </aside>
}
