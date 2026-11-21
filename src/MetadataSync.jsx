import { useEffect, useRef } from 'react'
import OBR from '@owlbear-rodeo/sdk'
import useStore, { toRoomStreaming } from './store'

const STRUCTURE_DEBOUNCE_MS = 100
const GLOBAL_DEBOUNCE_MS = 400

function structurePayload(state) {
  return JSON.stringify({
    isPaused: !!state.isPaused,
    gmMuted: !!state.gmMuted,
    isLocalOnly: !!state.isLocalOnly,
    currentlyStreaming: toRoomStreaming(state.roomStreaming),
  })
}

function hasUncommittedChanges(state) {
  if (state.isLocalOnly) return false
  return (
    JSON.stringify(toRoomStreaming(state.currentlyStreaming)) !==
    JSON.stringify(toRoomStreaming(state.roomStreaming))
  )
}

function writeMetadata(payload) {
  try {
    return Promise.resolve(OBR.room.setMetadata({ warpsong: payload })).catch(
      (err) => console.warn('WarpSong metadata write failed', err)
    )
  } catch (err) {
    console.warn('WarpSong metadata write failed', err)
    return Promise.resolve()
  }
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
      writeMetadata(roomPayload(latest, latest.roomStreaming))
    }

    const flushGlobal = () => {
      const latest = useStore.getState()
      if (latest.isLocalOnly) return
      const g = latest.globalVolume
      if (g === lastGlobal.current) return
      lastGlobal.current = g
      writeMetadata(roomPayload(latest, latest.roomStreaming))
    }

    const pushLocalOnlySilence = (state) => {
      lastStructure.current = ''
      lastGlobal.current = state.globalVolume
      writeMetadata({
        isPaused: !!state.isPaused,
        gmMuted: !!state.gmMuted,
        currentlyStreaming: [],
        globalVolume: state.globalVolume,
      })
    }

    // Popover closed without pressing Back: still commit pending stream edits
    const onPageHide = () => {
      const latest = useStore.getState()
      if (latest.isLocalOnly) return
      if (hasUncommittedChanges(latest)) latest.commitRoomStreaming()
      flushStructure()
      flushGlobal()
    }
    window.addEventListener('pagehide', onPageHide)

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
          leftLocalOnly ? 0 : STRUCTURE_DEBOUNCE_MS
        )
      }

      if (state.globalVolume !== lastGlobal.current) {
        if (globalTimer.current) clearTimeout(globalTimer.current)
        globalTimer.current = setTimeout(flushGlobal, GLOBAL_DEBOUNCE_MS)
      }
    })

    return () => {
      unsub()
      window.removeEventListener('pagehide', onPageHide)
      clearTimers()
    }
  }, [enabled])

  return null
}
