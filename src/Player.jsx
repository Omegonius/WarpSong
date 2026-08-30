import { useMemo, useRef, useEffect, useState } from 'react'
import ReactPlayer from 'react-player/youtube'
import useStore from './store'

export default function Player() {
  const folders = useStore((s) => s.folders)
  const playingStreams = useStore((s) => s.playingStreams)
  const syncedActiveStreams = useStore((s) => s.syncedActiveStreams)
  const isPaused = useStore((s) => s.isPaused)
  const isMuted = useStore((s) => s.isMuted)

  const activeStreams = useMemo(() => {
    const local = []
    folders.forEach((folder) => {
      folder.streams.forEach((stream) => {
        if (playingStreams[stream.id]) local.push(stream)
      })
    })
    if (local.length > 0) return local
    return syncedActiveStreams || []
  }, [folders, playingStreams, syncedActiveStreams])

  const sessionsRef = useRef({})
  const prevKeysRef = useRef(new Set())

  const tracks = useMemo(() => {
    const list = []
    const currentKeys = new Set()

    activeStreams.forEach((stream) => {
      ;(stream.links || []).forEach((link) => {
        if (!link.url || !/youtu/i.test(link.url)) return
        const key = `${stream.id}::${link.id}`
        currentKeys.add(key)

        if (!prevKeysRef.current.has(key)) {
          sessionsRef.current[key] = (sessionsRef.current[key] || 0) + 1
        }

        list.push({
          key,
          session: sessionsRef.current[key] || 1,
          streamId: stream.id,
          linkId: link.id,
          url: link.url,
          loop: link.loop !== false,
        })
      })
    })

    prevKeysRef.current = currentKeys
    return list
  }, [activeStreams])

  const muted = isMuted || isPaused

  return (
    <div style={{ display: 'none' }}>
      {tracks.map((track) => (
        <StableYouTube
          key={`${track.key}::${track.session}`}
          streamId={track.streamId}
          linkId={track.linkId}
          url={track.url}
          playing={!muted}
          loop={track.loop}
        />
      ))}
    </div>
  )
}

function clamp01(n) {
  return Math.max(0, Math.min(1, Number(n) || 0))
}

function StableYouTube({ streamId, linkId, url, playing, loop }) {
  const ref = useRef(null)
  const [ready, setReady] = useState(false)

  // Жива гучність зі store — реагує на слайдери без рестарту
  const volume = useStore((s) => {
    const global = s.isMuted || s.isPaused ? 0 : s.globalVolume

    // 1) локальні folders (GM)
    for (const folder of s.folders) {
      const stream = folder.streams.find((st) => st.id === streamId)
      if (stream) {
        const link = (stream.links || []).find((l) => l.id === linkId)
        const sv = stream.volume ?? 0.7
        const lv = link?.volume ?? 1
        return clamp01(global * sv * lv)
      }
    }

    // 2) sync від GM (гравці)
    const remote = (s.syncedActiveStreams || []).find((st) => st.id === streamId)
    if (remote) {
      const link = (remote.links || []).find((l) => l.id === linkId)
      const sv = remote.volume ?? 0.7
      const lv = link?.volume ?? 1
      return clamp01(global * sv * lv)
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
      muted={volume <= 0}
      loop={loop}
      width={0}
      height={0}
      progressInterval={500}
      onReady={() => {
        setReady(true)
        applyVolume()
        if (playing) {
          try {
            ref.current?.getInternalPlayer?.()?.playVideo?.()
          } catch {
            // ignore
          }
        }
      }}
      onProgress={() => {
        // підстрахування: інколи YT скидає volume
        applyVolume()
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
