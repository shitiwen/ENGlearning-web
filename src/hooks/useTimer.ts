import { useEffect, useRef, useState } from 'react'

export function useTimer(initialMs = 0, running = true) {
  const [elapsedMs, setElapsedMs] = useState(initialMs)
  const lastTick = useRef(Date.now())
  useEffect(() => {
    lastTick.current = Date.now()
    if (!running) return
    const timer = window.setInterval(() => {
      const now = Date.now()
      setElapsedMs((value) => value + now - lastTick.current)
      lastTick.current = now
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running])
  return [elapsedMs, setElapsedMs] as const
}

export function formatDuration(ms: number) {
  const total = Math.floor(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
