import { useMemo, useRef, useEffect, useState } from 'react'
import ReactPlayer from 'react-player/youtube'
import useStore from './store'

function clamp01(n) {
  return Math.max(0, Math.min(1, Number(n) || 0))
}

export default function Player() {
  const folders = useStore((s) => s.folders)
  const playingStreams = useStore((s) => s.playingStreams)
  const syncedActiveStreams = useStore((s) => s.syncedActiveStreams)
  const isPaused = useStore((s) => s.isPaused)
  const gmMuted = useStore((s) => s.gmMuted)
  const localMuted = useStore((s) => s.localMuted)

  const desiredStreams = useMemo(() => {
    const local = []
    folders.forEach((folder) => {
      folder.streams.forEach((stream) => {
        if (playingStreams[stream.id]) local.push(stream)
      })
    })
    if (local.length > 0) return local
    return syncedActiveStreams || []
  }, [folders, playingStreams, syncedActiveStreams])

  const poolRef = useRef(new Map())
  const [, bump] = useState(0)
  const force = () => bump((n) => n + 1)

  useEffect(() => {
    const desiredKeys = new Set()

    desiredStreams.forEach((stream) => {
      ;(stream.links || []).forEach((link) => {
        if (!link.url || !/youtu/i.test(link.url)) return
        const key = `${stream.id}::${link.id}`
        desiredKeys.add(key)
        poolRef.current.set(key, {
          key,
          streamId: stream.id,
          linkId: link.id,
          url: link.url,
          loop: link.loop !== false,
          active: true,
        })
      })
    })

    poolRef.current.forEach((slot, key) => {
      if (!desiredKeys.has(key)) {
        poolRef.current.set(key, { ...slot, active: false })
      }
    })

    force()
  }, [desiredStreams])

  const anyPlaying = desiredStreams.length > 0
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
          streamId={slot.streamId}
          linkId={slot.linkId}
          url={slot.url}
          playing={!!slot.active && !silenced}
          loop={slot.loop}
        />
      ))}
    </div>
  )
}

function StableYouTube({ trackKey, streamId, linkId, url, playing, loop }) {
  const ref = useRef(null)
  const [ready, setReady] = useState(false)
  const setPlaybackError = useStore((s) => s.setPlaybackError)
  const clearPlaybackError = useStore((s) => s.clearPlaybackError)

  const volume = useStore((s) => {
    if (s.isPaused || s.gmMuted || s.localMuted) return 0
    const global = s.globalVolume

    for (const folder of s.folders) {
      const stream = folder.streams.find((st) => st.id === streamId)
      if (stream) {
        const link = (stream.links || []).find((l) => l.id === linkId)
        return clamp01(global * (stream.volume ?? 0.7) * (link?.volume ?? 1))
      }
    }

    const remote = (s.syncedActiveStreams || []).find((st) => st.id === streamId)
    if (remote) {
      const link = (remote.links || []).find((l) => l.id === linkId)
      return clamp01(global * (remote.volume ?? 0.7) * (link?.volume ?? 1))
    }

    return clamp01(global * 0.7)
  })

  const applyVolume = () => {
    const yt = ref.current?.getInternalPlayer?.()
    if (!yt) return
    try {
      if (typeof yt.setVolume === 'function') {
        yt.setVolume(Math.round(clamp01(volume) * 100))
      }
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
