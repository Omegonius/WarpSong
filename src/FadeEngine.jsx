import { useEffect } from 'react'
import useStore from './store'

/**
 * Fade ticks (~100 ms). Uses real elapsed time, so a fade keeps its duration
 * even when the browser throttles timers in a background tab.
 */
export default function FadeEngine() {
  useEffect(() => {
    let last = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      const dt = Math.min(60, Math.max(0, (now - last) / 1000))
      last = now
      useStore.getState().tickFades(dt)
    }, 100)
    return () => clearInterval(id)
  }, [])
  return null
}
