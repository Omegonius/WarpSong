import { useEffect, useRef } from 'react'
import OBR from '@owlbear-rodeo/sdk'
import useStore from './store'

function serializeRoom(list) {
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

/** Play/stop/pause/mute — faster debounce */
function structurePayload(state) {
  return JSON.stringify({
    isPaused: !!state.isPaused,
    gmMuted: !!state.gmMuted,
    isLocalOnly: !!state.isLocalOnly,
    currentlyStreaming: serializeRoom(state.roomStreaming),
  })
}

export default function MetadataSync({ enabled }) {
  const lastStructure = useRef('')
  const lastGlobal = useRef(null)
  const structureTimer = useRef(null)
  const globalTimer = useRef(null)

  useEffect(() => {
    if (!enabled) return

    const flushStructure = () => {
      const latest = useStore.getState()
      if (latest.isLocalOnly) return
      const json = structurePayload(latest)
      if (json === lastStructure.current) return
      lastStructure.current = json
      try {
        OBR.room.setMetadata({
          warpsong: {
            isPaused: !!latest.isPaused,
            gmMuted: !!latest.gmMuted,
            currentlyStreaming: serializeRoom(latest.roomStreaming),
            // keep last known global if any; global flush may patch separately
            globalVolume:
              lastGlobal.current != null
                ? lastGlobal.current
                : latest.globalVolume,
          },
        })
      } catch (err) {
        console.warn('WarpSong metadata failed', err)
      }
    }

    const flushGlobal = () => {
      const latest = useStore.getState()
      if (latest.isLocalOnly) return
      const g = latest.globalVolume
      if (g === lastGlobal.current) return
      lastGlobal.current = g
      try {
        OBR.room.setMetadata({
          warpsong: {
            isPaused: !!latest.isPaused,
            gmMuted: !!latest.gmMuted,
            currentlyStreaming: serializeRoom(latest.roomStreaming),
            globalVolume: g,
          },
        })
      } catch (err) {
        console.warn('WarpSong metadata global failed', err)
      }
    }

    const unsub = useStore.subscribe((state) => {
      if (state.isLocalOnly) return

      const struct = structurePayload(state)
      if (struct !== lastStructure.current) {
        if (structureTimer.current) clearTimeout(structureTimer.current)
        structureTimer.current = setTimeout(flushStructure, 100)
      }

      if (state.globalVolume !== lastGlobal.current) {
        if (globalTimer.current) clearTimeout(globalTimer.current)
        // Checklist: global volume → players with 300–500ms debounce
        globalTimer.current = setTimeout(flushGlobal, 400)
      }
    })

    return () => {
      unsub()
      if (structureTimer.current) clearTimeout(structureTimer.current)
      if (globalTimer.current) clearTimeout(globalTimer.current)
    }
  }, [enabled])

  return null
}
