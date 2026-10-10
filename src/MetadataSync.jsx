import { useEffect, useRef } from 'react'
import OBR from '@owlbear-rodeo/sdk'
import useStore, { toRoomStreaming } from './store'

function structurePayload(state) {
  return JSON.stringify({
    isPaused: !!state.isPaused,
    gmMuted: !!state.gmMuted,
    isLocalOnly: !!state.isLocalOnly,
    currentlyStreaming: toRoomStreaming(state.roomStreaming),
  })
}

function writeMetadata(payload) {
  return OBR.room.setMetadata({
    warpsong: payload,
  })
}

export default function MetadataSync({ enabled }) {
  const lastStructure = useRef('')
  const lastGlobal = useRef(null)
  const lastLocalOnly = useRef(false)
  const structureTimer = useRef(null)
  const globalTimer = useRef(null)

  useEffect(() => {
    if (!enabled) return

    const clearTimers = () => {
      if (structureTimer.current) clearTimeout(structureTimer.current)
      if (globalTimer.current) clearTimeout(globalTimer.current)
      structureTimer.current = null
      globalTimer.current = null
    }

    const roomPayload = (state, streaming) => ({
      isPaused: !!state.isPaused,
      gmMuted: !!state.gmMuted,
      currentlyStreaming: toRoomStreaming(streaming),
      globalVolume: state.globalVolume,
    })

    const flushStructure = () => {
      const latest = useStore.getState()
      if (latest.isLocalOnly) return
      const json = structurePayload(latest)
      if (json === lastStructure.current) return
      lastStructure.current = json
      lastGlobal.current = latest.globalVolume
      try {
        writeMetadata(roomPayload(latest, latest.roomStreaming))
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
        writeMetadata(roomPayload(latest, latest.roomStreaming))
      } catch (err) {
        console.warn('WarpSong metadata global failed', err)
      }
    }

    const pushLocalOnlySilence = (state) => {
      lastStructure.current = ''
      lastGlobal.current = state.globalVolume
      try {
        writeMetadata({
          isPaused: !!state.isPaused,
          gmMuted: !!state.gmMuted,
          currentlyStreaming: [],
          globalVolume: state.globalVolume,
        })
      } catch (err) {
        console.warn('WarpSong metadata local-only failed', err)
      }
    }

    const unsub = useStore.subscribe((state) => {
      if (state.isLocalOnly) {
        clearTimers()
        if (!lastLocalOnly.current) {
          lastLocalOnly.current = true
          pushLocalOnlySilence(state)
        }
        return
      }

      const leftLocalOnly = lastLocalOnly.current
      lastLocalOnly.current = false

      const struct = structurePayload(state)
      if (leftLocalOnly || struct !== lastStructure.current) {
        if (structureTimer.current) clearTimeout(structureTimer.current)
        structureTimer.current = setTimeout(
          flushStructure,
          leftLocalOnly ? 0 : 100
        )
      }

      if (state.globalVolume !== lastGlobal.current) {
        if (globalTimer.current) clearTimeout(globalTimer.current)
        globalTimer.current = setTimeout(flushGlobal, 400)
      }
    })

    return () => {
      unsub()
      clearTimers()
    }
  }, [enabled])

  return null
}
