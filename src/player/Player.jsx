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

  // Збираємо список активних стрімів один раз
  const activeStreams = useMemo(() => {
    if (syncedActiveStreams && syncedActiveStreams.length > 0) {
      return syncedActiveStreams
    }
    const local = []
    folders.forEach((folder) => {
      folder.streams.forEach((stream) => {
        if (playingStreams[stream.id]) {
          local.push(stream)
        }
      })
    })
    return local
  }, [syncedActiveStreams, folders, playingStreams])

  // Плоский список лінків з стабільним key = url
  // key тільки по url — щоб React не пересоздавав плеєр при оновленні volume/name
  const tracks = useMemo(() => {
    const list = []
    activeStreams.forEach((stream) => {
      ;(stream.links || []).forEach((link) => {
        if (link.url && /youtu/i.test(link.url)) {
          list.push({
            key: link.url, // стабільний ключ
            url: link.url,
            streamVolume: stream.volume ?? 0.7,
            linkVolume: link.volume ?? 1,
            loop: !!link.loop,
          })
        }
      })
    })
    return list
  }, [activeStreams])

  const effectiveMuted = isMuted || isPaused
  const baseVolume = isMuted || isPaused ? 0 : globalVolume

  // Зберігаємо попередній набір url, щоб розуміти що нове
  const prevUrlsRef = useRef(new Set())

  useEffect(() => {
    const current = new Set(tracks.map((t) => t.url))
    prevUrlsRef.current = current
  }, [tracks])

  return (
    <div style={{ display: 'none' }}>
      {tracks.map((track) => (
        <StableYouTube
          key={track.key}
          url={track.url}
          playing={!isPaused}
          volume={baseVolume * track.streamVolume * track.linkVolume}
          loop={track.loop}
          muted={effectiveMuted}
        />
      ))}
    </div>
  )
}

/** Окремий компонент — щоб ReactPlayer не ресетився без потреби */
function StableYouTube({ url, playing, volume, loop, muted }) {
  // volume міняємо через ref-колбек, не форсуючи remount
  const playerRef = useRef(null)

  useEffect(() => {
    const internal = playerRef.current?.getInternalPlayer?.()
    if (internal && typeof internal.setVolume === 'function') {
      // YouTube API: 0–100
      try {
        internal.setVolume(Math.round(Math.max(0, Math.min(1, volume)) * 100))
      } catch {
        // ignore
      }
    }
  }, [volume])

  useEffect(() => {
    const internal = playerRef.current?.getInternalPlayer?.()
    if (!internal) return
    try {
      if (muted || !playing) {
        if (typeof internal.pauseVideo === 'function') internal.pauseVideo()
      } else {
        if (typeof internal.playVideo === 'function') internal.playVideo()
      }
    } catch {
      // ignore
    }
  }, [playing, muted])

  return (
    <ReactPlayer
      ref={playerRef}
      url={url}
      playing={playing && !muted}
      // volume лишаємо стартовий; далі крутимо через API
      volume={volume}
      muted={muted}
      loop={loop}
      width={0}
      height={0}
      config={{
        youtube: {
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
          },
        },
      }}
    />
  )
}
