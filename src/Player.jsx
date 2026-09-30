import { useMemo, useRef, useEffect, useState } from 'react'
import ReactPlayer from 'react-player/youtube'
import useStore from './store'

function clamp01(n) {
  return Math.max(0, Math.min(1, Number(n) || 0))
}

export default function Player() {
  const currentlyStreaming = useStore((s) => s.currentlyStreaming)
  const isPaused = useStore((s) => s.isPaused)
  const gmMuted = useStore((s) => s.gmMuted)
  const localMuted = useStore((s) => s.localMuted)

  const poolRef = useRef(new Map())
  const [, bump] = useState(0)
  const force = () => bump((n) => n + 1)

  const desired = useMemo(() => {
    const list = []
    ;(currentlyStreaming || []).forEach((stream) => {
      ;(stream.links || []).forEach((link) => {
        if (!link.url || !/youtu/i.test(link.url)) return
        list.push({
          key: `\( {stream.id}:: \){link.id}`,
          streamId: stream.id,
          linkId: link.id,
          url: link.url,
          loop: link.loop !== false,
          streamVolume: stream.volume ?? 0.7,
          linkVolume: link.volume ?? 1,
        })
      })
    })
    return list
  }, [currentlyStreaming])

  useEffect(() => {
    const desiredKeys = new Set(desired.map((t) => t.key))

    desired.forEach((t) => {
      poolRef.current.set(t.key, { ...t, active: true })
    })

    poolRef.current.forEach((slot, key) => {
      if (!desiredKeys.has(key)) {
        poolRef.current.set(key, { ...slot, active: false })
      }
    })

    force()
  }, [desired])

  const anyPlaying = desired.length > 0
  useEffect(() => {
    if (anyPlaying) return
    const t = setTimeout(() => {
      poolRef.current.clear()
      force()
    }, 400)
    return () => clearTimeout(t)
  }, [anyPlaying])

  const slots = Array.from(poolRef.current.values())
  const silenced = isPaused || gmMuted || localMuted

  return (
    <div style={{ display: 'none' }}>
      {slots.map((slot) => (
        <StableYouTube
          key={slot.key}
          trackKey={slot.key}
          url={slot.url}
          streamVolume={slot.streamVolume ?? 0.7}
          linkVolume={slot.linkVolume ?? 1}
          playing={!!slot.active && !silenced}
          loop={slot.loop}
        />
      ))}
    </div>
  )
}

function StableYouTube({
  trackKey,
  url,
  streamVolume,
  linkVolume,
  playing,
  loop,
}) {
  const ref = useRef(null)
  const [ready, setReady] = useState(false)
  const globalVolume = useStore((s) => s.globalVolume)
  const silenced = useStore(
    (s) => s.isPaused || s.gmMuted || s.localMuted
  )
  const setPlaybackError = useStore((s) => s.setPlaybackError)
  const clearPlaybackError = useStore((s) => s.clearPlaybackError)

  const volume = silenced
    ? 0
    : clamp01(globalVolume * streamVolume * linkVolume)

  const applyVolume = () => {
    const yt = ref.current?.getInternalPlayer?.()
    if (!yt) return
    try {
      yt.setVolume?.(Math.round(clamp01(volume) * 100))
      if (volume <= 0) yt.mute?.()
      else yt.unMute?.()
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!ready) return
    applyVolume()
  }, [volume, ready])

  useEffect(() => {
    if (!ready) return
    const yt = ref.current?.getInternalPlayer?.()
    if (!yt) return
    try {
      if (playing) {
        yt.unMute?.()
        yt.playVideo?.()
        applyVolume()
      } else {
        yt.pauseVideo?.()
      }
    } catch {
      // ignore
    }
  }, [playing, ready])

  return (
    <ReactPlayer
      ref={ref}
      url={url}
      playing={playing}
      volume={volume}
      muted={volume <= 0 || !playing}
      loop={loop}
      width={0}
      height={0}
      progressInterval={500}
      onReady={() => {
        setReady(true)
        clearPlaybackError(trackKey)
        applyVolume()
        if (playing) {
          try {
            ref.current?.getInternalPlayer?.()?.playVideo?.()
          } catch {
            // ignore
          }
        }
      }}
      onError={() => {
        setPlaybackError(
          trackKey,
          `Cannot play: ${url || 'invalid link'} (private, blocked, or unavailable)`
        )
      }}
      onProgress={() => {
        if (playing) applyVolume()
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
