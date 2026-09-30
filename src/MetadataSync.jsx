import { useEffect, useRef } from 'react'
import OBR from '@owlbear-rodeo/sdk'
import useStore from './store'

/** Fade progress (fadeFactor) is LOCAL — do not sync every tick */
function serializeStreaming(list) {
  return (list || []).map((s) => ({
    id: s.id,
    name: s.name,
    emoji: s.emoji,
    volume: s.volume,
    muted: !!s.muted,
    fadeIn: s.fadeIn,
    fadeOut: s.fadeOut,
    fadingIn: !!s.fadingIn,
    fadingOut: !!s.fadingOut,
    links: s.links || [],
  }))
}

function stablePayload(state) {
  return JSON.stringify({
    isPaused: !!state.isPaused,
    gmMuted: !!state.gmMuted,
    isLocalOnly: !!state.isLocalOnly,
    currentlyStreaming: serializeStreaming(state.currentlyStreaming),
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
              currentlyStreaming: serializeStreaming(latest.currentlyStreaming),
            },
          })
        } catch (err) {
          console.warn('WarpSong metadata failed', err)
        }
      }, 100)
    })

    return () => {
      unsub()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [enabled])

  return null
}
