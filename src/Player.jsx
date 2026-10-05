import { useEffect, useRef, useState } from 'react'
import ReactPlayer from 'react-player/youtube'
import useStore from './store'

function clamp01(n) {
  return Math.max(0, Math.min(1, Number(n) || 0))
}

function tracksFromState(state) {
  const list = []
  ;(state.currentlyStreaming || []).forEach((stream) => {
    ;(stream.links || []).forEach((link) => {
      if (!link.url || !/youtu/i.test(link.url)) return
      list.push({
        key: stream.id + '::' + link.id,
        streamId: stream.id,
        linkId: link.id,
        url: link.url,
        loop: link.loop !== false,
        streamVolume: stream.volume ?? 0.7,
        linkVolume: link.volume ?? 1,
        fadeFactor: stream.fadeFactor ?? 1,
        streamMuted: !!stream.muted,
        active: true,
      })
    })
  })
  return list
}

function computeVolume(state, track) {
  if (!track || !track.active) return 0
  if (
    state.isPaused ||
    state.gmMuted ||
    state.localMuted ||
    !state.audioUnlocked ||
    track.streamMuted
  ) {
    return 0
  }
  const roomMaster =
    typeof state.roomGlobalVolume === 'number' ? state.roomGlobalVolume : 1
  const master = state.globalVolume * roomMaster
  return clamp01(
    master *
      (track.streamVolume ?? 0.7) *
      (track.linkVolume ?? 1) *
      (track.fadeFactor ?? 1)
  )
}

function shouldPlay(state, track) {
  if (!track || !track.active) return false
  if (!state.audioUnlocked) return false
  if (state.isPaused || state.gmMuted || state.localMuted) return false
  if (track.streamMuted) return false
  return true
}

export default function Player() {
  const [trackKeys, setTrackKeys] = useState([])
  const tracksRef = useRef(new Map())
  const playersRef = useRef(new Map())
  const mountPropsRef = useRef(new Map())

  useEffect(() => {
    const apply = (state) => {
      const activeList = tracksFromState(state)
      const activeMap = new Map(activeList.map((t) => [t.key, t]))

      const merged = new Map(tracksRef.current)
      merged.forEach((t, key) => {
        merged.set(key, { ...t, active: false })
      })
      activeMap.forEach((t, key) => {
        merged.set(key, { ...t, active: true })
        if (!mountPropsRef.current.has(key)) {
          mountPropsRef.current.set(key, { url: t.url, loop: t.loop })
        }
      })
      tracksRef.current = merged

      const allKeys = Array.from(merged.keys()).sort()
      setTrackKeys((prev) => {
        if (
          prev.length === allKeys.length &&
          prev.every((k, i) => k === allKeys[i])
        ) {
          return prev
        }
        const set = new Set(prev)
        const next = [...prev]
        allKeys.forEach((k) => {
          if (!set.has(k)) next.push(k)
        })
        return next
      })

      merged.forEach((track, key) => {
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
    }

    apply(useStore.getState())
    const unsub = useStore.subscribe(apply)
    return unsub
  }, [])

  return (
    <div style={{ display: 'none' }} aria-hidden>
      {trackKeys.map((key) => {
        const mount = mountPropsRef.current.get(key)
        const track = tracksRef.current.get(key)
        if (!mount && !track) return null
        const url = mount?.url || track?.url
        const loop = mount?.loop ?? track?.loop ?? true
        if (!url) return null
        return (
          <MountedYouTube
            key={key}
            trackKey={key}
            url={url}
            loop={loop}
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
      playing={true}
      volume={1}
      muted={false}
      loop={loop}
      width={0}
      height={0}
      progressInterval={2000}
      onReady={() => {
        setReady(true)
        clearPlaybackError(trackKey)
        setTimeout(applyNow, 80)
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
