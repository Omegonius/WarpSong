import { useEffect } from 'react'
import useStore from './store'

/** Runs fade in/out ticks (DJinni-style volume ramp) */
export default function FadeEngine() {
  useEffect(() => {
    const id = setInterval(() => {
      useStore.getState().tickFades(0.1)
    }, 100)
    return () => clearInterval(id)
  }, [])
  return null
}
