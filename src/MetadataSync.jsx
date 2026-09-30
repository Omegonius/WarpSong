import { useEffect, useRef } from 'react'
import OBR from '@owlbear-rodeo/sdk'
import useStore from './store'

function stablePayload(state) {
  return JSON.stringify({
    isPaused: !!state.isPaused,
    gmMuted: !!state.gmMuted,
    isLocalOnly: !!state.isLocalOnly,
    currentlyStreaming: state.currentlyStreaming || [],
  })
}

export default function MetadataSync({ enabled }) {
  const lastSent = useRef('')
  const timer = useRef(null)

  useEffect(() => {
    if (!enabled) return

    const unsub = useStore.subscribe((state) => {
      if (state.isLocalOnly) return

      const json = stablePayload(state)
      if (json === lastSent.current) return

      if (timer.current) clearTimeout(timer.current)

      // fades tick often — slightly longer debounce still ok for volume;
      // play/stop uses same path but 80ms is fine
      timer.current = setTimeout(() => {
        const latest = useStore.getState()
        if (latest.isLocalOnly) return
        const payload = stablePayload(latest)
        if (payload === lastSent.current) return

        lastSent.current = payload
        try {
          OBR.room.setMetadata({
            warpsong: {
              isPaused: !!latest.isPaused,
              gmMuted: !!latest.gmMuted,
              currentlyStreaming: latest.currentlyStreaming || [],
            },
          })
        } catch (err) {
          console.warn('WarpSong metadata failed', err)
        }
      }, 80)
    })

    return () => {
      unsub()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [enabled])

  return null
}
