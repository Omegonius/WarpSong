import { useEffect, useRef } from 'react'
import OBR from '@owlbear-rodeo/sdk'
import useStore, { toRoomStreaming } from './store'

const STRUCTURE_DEBOUNCE_MS = 100
const GLOBAL_DEBOUNCE_MS = 400
const COMMIT_DEBOUNCE_MS = 600

function structurePayload(state) {
  return JSON.stringify({
    isPaused: !!state.isPaused,
    gmMuted: !!state.gmMuted,
    isLocalOnly: !!state.isLocalOnly,
    currentlyStreaming: toRoomStreaming(state.roomStreaming),
  })
}

/** What players would see if the current GM mixer were committed (no fade ticks) */
function snapshot(list) {
  return JSON.stringify(toRoomStreaming(list))
}

function hasUncommittedChanges(state) {
  if (state.isLocalOnly) return false
  return snapshot(state.currentlyStreaming) !== snapshot(state.roomStreaming)
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
  const lastCurrentSnap = useRef('')
  const structureTimer = useRef(null)
  const globalTimer = useRef(null)
  const commitTimer = useRef(null)

  useEffect(() => {
    if (!enabled) return

    const clearTimers = () => {
      if (structureTimer.current) clearTimeout(structureTimer.current)
      if (globalTimer.current) clearTimeout(globalTimer.current)
      if (commitTimer.current) clearTimeout(commitTimer.current)
      structureTimer.current = null
      globalTimer.current = null
      commitTimer.current = null
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

    // Popover closed without pressing Back: push whatever is pending right now
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
        lastCurrentSnap.current = ''
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

      // Stream/link volume edits: commit to the room shortly after the last
      // change (debounced), so players get it even if the GM never presses Back.
      // Re-armed only when the mixer snapshot really changed, not on fade ticks.
      const currentSnap = snapshot(state.currentlyStreaming)
      if (currentSnap !== lastCurrentSnap.current) {
        lastCurrentSnap.current = currentSnap
        if (commitTimer.current) clearTimeout(commitTimer.current)
        commitTimer.current = null
        if (currentSnap !== snapshot(state.roomStreaming)) {
          commitTimer.current = setTimeout(() => {
            commitTimer.current = null
            const latest = useStore.getState()
            if (hasUncommittedChanges(latest)) latest.commitRoomStreaming()
          }, COMMIT_DEBOUNCE_MS)
        }
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
