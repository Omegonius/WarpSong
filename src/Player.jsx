import { useMemo, useRef, useEffect } from 'react'
import ReactPlayer from 'react-player/youtube'
import useStore from './store'

export default function Player() {
  const {
    folders,
    playingStreams,
    syncedActiveStreams,
    isPaused,
    globalVolume,
    isMuted,
  } = useStore()

  // 1) Спочатку локальні (GM) — миттєво, без metadata
  // 2) Якщо локально нічого не грає — беремо sync від GM (гравці)
  const activeStreams = useMemo(() => {
    const local = []
    folders.forEach((folder) => {
      folder.streams.forEach((stream) => {
        if (playingStreams[stream.id]) {
          local.push(stream)
        }
      })
    })
    if (local.length > 0) return local
    return syncedActiveStreams || []
  }, [folders, playingStreams, syncedActiveStreams])

  const tracks = useMemo(() => {
    const list = []
    const seen = new Set()
    activeStreams.forEach((stream) => {
      ;(stream.links || []).forEach((link) => {
        if (!link.url || !/youtu/i.test(link.url)) return
        // один плеєр на унікальний url — не дублюємо
        if (seen.has(link.url)) return
        seen.add(link.url)
        list.push({
          key: link.url,
          url: link.url,
          streamVolume: stream.volume ?? 0.7,
          linkVolume: link.volume ?? 1,
          loop: link.loop !== false,
        })
      })
    })
    return list
  }, [activeStreams])

  // щоб 2 стріми не здавались тихішими — легкий буст при кількох треках
  const trackCount = tracks.length
  const multiBoost = trackCount >= 2 ? 1.15 : 1
  const baseVolume = isMuted || isPaused ? 0 : Math.min(1, globalVolume * multiBoost)

  return (
    <div style={{ display: 'none' }}>
      {tracks.map((track) => (
        <StableYouTube
          key={track.key}
          url={track.url}
          playing={!isPaused && !isMuted}
          volume={Math.min(1, baseVolume * track.streamVolume * track.linkVolume)}
          loop={track.loop}
          muted={isMuted || isPaused}
        />
      ))}
    </div>
  )
}

function StableYouTube({ url, playing, volume, loop, muted }) {
  const playerRef = useRef(null)
  const startedRef = useRef(false)

  // volume через YouTube API, без remount
  useEffect(() => {
    const internal = playerRef.current?.getInternalPlayer?.()
    if (!internal || typeof internal.setVolume !== 'function') return
    try {
      internal.setVolume(Math.round(Math.max(0, Math.min(1, volume)) * 100))
    } catch {
      // ignore
    }
  }, [volume])

  // play/pause через API
  useEffect(() => {
    const internal = playerRef.current?.getInternalPlayer?.()
    if (!internal) return
    try {
      if (playing && !muted) {
        if (typeof internal.unMute === 'function') internal.unMute()
        if (typeof internal.playVideo === 'function') internal.playVideo()
        startedRef.current = true
      } else {
        if (typeof internal.pauseVideo === 'function') internal.pauseVideo()
      }
    } catch {
      // ignore
    }
  }, [playing, muted])

  return (
    <ReactPlayer
      ref={playerRef}
      url={url}
      playing={playing}
      volume={volume}
      muted={muted}
      loop={loop}
      width={0}
      height={0}
      onReady={() => {
        // після ready ще раз форсуємо play (Chrome autoplay)
        if (!playing || muted) return
        const internal = playerRef.current?.getInternalPlayer?.()
        try {
          internal?.playVideo?.()
        } catch {
          // ignore
        }
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
