import { useEffect, useRef, useState } from 'react'
import ReactPlayer from 'react-player/youtube'
import useStore from './store'

function clamp01(n) {
  return Math.max(0, Math.min(1, Number(n) || 0))
}

/** Build flat track list from currentlyStreaming snapshot */
function tracksFromState(state) {
  const list = []
  ;(state.currentlyStreaming || []).forEach((stream) => {
    ;(stream.links || []).forEach((link) => {
      if (!link.url || !/youtu/i.test(link.url)) return
      list.push({
        key: `${stream.id}::${link.id}`,
        streamId: stream.id,
        linkId: link.id,
        url: link.url,
        loop: link.loop !== false,
        streamVolume: stream.volume ?? 0.7,
        linkVolume: link.volume ?? 1,
        fadeFactor: stream.fadeFactor ?? 1,
        streamMuted: !!stream.muted,
      })
    })
  })
  return list
}

function computeVolume(state, track) {
  if (
    state.isPaused ||
    state.gmMuted ||
    state.localMuted ||
    !state.audioUnlocked ||
    track.streamMuted
  ) {
    return 0
  }
  return clamp01(
    state.globalVolume *
      (track.streamVolume ?? 0.7) *
      (track.linkVolume ?? 1) *
      (track.fadeFactor ?? 1)
  )
}

function shouldPlay(state, track) {
  if (!state.audioUnlocked) return false
  if (state.isPaused || state.gmMuted || state.localMuted) return false
  if (track.streamMuted) return false
  return true
}

/**
 * Mounts one ReactPlayer per YouTube link and keeps it mounted
 * until the link leaves currentlyStreaming. Volume / pause are
 * applied only through the YouTube iframe API — never by changing
 * ReactPlayer props after ready (that was restarting other streams).
 */
export default function Player() {
  // Only re-render this shell when the SET of track keys changes
  const [trackKeys, setTrackKeys] = useState([])
  const tracksRef = useRef(new Map()) // key -> track snapshot
  const playersRef = useRef(new Map()) // key -> { ref, ready }

  // Subscribe: update track snapshots; only setState when keys change
  useEffect(() => {
    const apply = (state) => {
      const next = tracksFromState(state)
      const nextMap = new Map(next.map((t) => [t.key, t]))
      tracksRef.current = nextMap

      const nextKeys = next.map((t) => t.key).sort()
      setTrackKeys((prev) => {
        if (
          prev.length === nextKeys.length &&
          prev.every((k, i) => k === nextKeys[i])
        ) {
          return prev
        }
        return nextKeys
      })

      // Push volume/play to already-mounted players (no React remount)
      nextMap.forEach((track, key) => {
        const slot = playersRef.current.get(key)
        if (!slot?.ready || !slot.getInternal) return
        const yt = slot.getInternal()
        if (!yt) return
        const vol = computeVolume(state, track)
        const play = shouldPlay(state, track)
        try {
          if (typeof yt.setVolume === 'function') {
            yt.setVolume(Math.round(vol * 100))
          }
          if (vol <= 0) yt.mute?.()
          else yt.unMute?.()
          if (play) yt.playVideo?.()
          else yt.pauseVideo?.()
        } catch {
          // ignore
        }
      })

      // Drop player bookkeeping for removed keys (component unmounts via trackKeys)
      playersRef.current.forEach((_, key) => {
        if (!nextMap.has(key)) playersRef.current.delete(key)
      })
    }

    apply(useStore.getState())
    const unsub = useStore.subscribe(apply)
    return unsub
  }, [])

  // Soft cleanup: if no tracks, clear map after short delay
  useEffect(() => {
    if (trackKeys.length > 0) return
    const t = setTimeout(() => {
      tracksRef.current.clear()
      playersRef.current.clear()
    }, 400)
    return () => clearTimeout(t)
  }, [trackKeys.length])

  return (
    <div style={{ display: 'none' }} aria-hidden>
      {trackKeys.map((key) => {
        const track = tracksRef.current.get(key)
        if (!track) return null
        return (
          <MountedYouTube
            key={key}
            trackKey={key}
            url={track.url}
            loop={track.loop}
            playersRef={playersRef}
            tracksRef={tracksRef}
          />
        )
      })}
    </div>
  )
}

function MountedYouTube({ trackKey, url, loop, playersRef, tracksRef }) {
  const playerRef = useRef(null)
  const [ready, setReady] = useState(false)
  const setPlaybackError = useStore((s) => s.setPlaybackError)
  const clearPlaybackError = useStore((s) => s.clearPlaybackError)

  // Register / unregister in parent map
  useEffect(() => {
    playersRef.current.set(trackKey, {
      ready: false,
      getInternal: () => playerRef.current?.getInternalPlayer?.() ?? null,
    })
    return () => {
      playersRef.current.delete(trackKey)
    }
  }, [trackKey, playersRef])

  useEffect(() => {
    const slot = playersRef.current.get(trackKey)
    if (slot) {
      slot.ready = ready
      slot.getInternal = () =>
        playerRef.current?.getInternalPlayer?.() ?? null
    }
  }, [ready, trackKey, playersRef])

  const applyNow = () => {
    const state = useStore.getState()
    const track = tracksRef.current.get(trackKey)
    if (!track) return
    const yt = playerRef.current?.getInternalPlayer?.()
    if (!yt) return
    const vol = computeVolume(state, track)
    const play = shouldPlay(state, track)
    try {
      if (typeof yt.setVolume === 'function') {
        yt.setVolume(Math.round(vol * 100))
      }
      if (vol <= 0) yt.mute?.()
      else yt.unMute?.()
      if (play) yt.playVideo?.()
      else yt.pauseVideo?.()
    } catch {
      // ignore
    }
  }

  return (
    <ReactPlayer
      ref={playerRef}
      url={url}
      // IMPORTANT: keep these stable after mount.
      // Control playback via iframe API only.
      playing={true}
      volume={1}
      muted={false}
      loop={loop}
      width={0}
      height={0}
      progressInterval={1000}
      onReady={() => {
        setReady(true)
        clearPlaybackError(trackKey)
        // small delay so internal player exists
        setTimeout(applyNow, 50)
      }}
      onError={() => {
        setPlaybackError(
          trackKey,
          `Cannot play: ${url || 'invalid link'} (private, blocked, or unavailable)`
        )
      }}
      config={{
        youtube: {
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
          },
        },
      }}
    />
  )
}
