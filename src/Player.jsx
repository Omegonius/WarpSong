import { useMemo, useRef, useEffect, useState } from 'react'
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

  // Локально (GM) має пріоритет — без чекання metadata
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

  // Стабільний список слотів: key = streamId + linkId (НЕ url)
  // session зростає тільки коли слот ЗНОВУ з’являється після вимкнення
  const sessionsRef = useRef({}) // key -> session number
  const prevKeysRef = useRef(new Set())

  const tracks = useMemo(() => {
    const list = []
    const currentKeys = new Set()

    activeStreams.forEach((stream) => {
      ;(stream.links || []).forEach((link) => {
        if (!link.url || !/youtu/i.test(link.url)) return
        const key = `${stream.id}::${link.id}`
        currentKeys.add(key)

        // якщо слот новий (не грав минулого разу) — нова session
        if (!prevKeysRef.current.has(key)) {
          sessionsRef.current[key] = (sessionsRef.current[key] || 0) + 1
        }

        list.push({
          key,
          session: sessionsRef.current[key] || 1,
          url: link.url,
          streamVolume: stream.volume ?? 0.7,
          linkVolume: link.volume ?? 1,
          loop: link.loop !== false,
        })
      })
    })

    // прибрати session для тих, кого вже немає
    Object.keys(sessionsRef.current).forEach((k) => {
      if (!currentKeys.has(k)) {
        // лишаємо номер session, щоб при повторному старті був новий mount
      }
    })

    prevKeysRef.current = currentKeys
    return list
  }, [activeStreams])

  const muted = isMuted || isPaused
  // БЕЗ multiBoost — однакова база для всіх, гучність тільки з налаштувань стріму
  const base = muted ? 0 : globalVolume

  return (
    <div style={{ display: 'none' }}>
      {tracks.map((track) => (
        <StableYouTube
          key={`${track.key}::${track.session}`}
          url={track.url}
          playing={!muted}
          volume={clamp01(base * track.streamVolume * track.linkVolume)}
          loop={track.loop}
        />
      ))}
    </div>
  )
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n))
}

function StableYouTube({ url, playing, volume, loop }) {
  const ref = useRef(null)
  const [ready, setReady] = useState(false)

  // Тільки volume — НІКОЛИ не чіпаємо play через зміну volume
  useEffect(() => {
    if (!ready) return
    const yt = ref.current?.getInternalPlayer?.()
    if (!yt || typeof yt.setVolume !== 'function') return
    try {
      yt.setVolume(Math.round(clamp01(volume) * 100))
      if (volume <= 0 && typeof yt.mute === 'function') yt.mute()
      if (volume > 0 && typeof yt.unMute === 'function') yt.unMute()
    } catch {
      // ignore
    }
  }, [volume, ready])

  // Play / pause окремо
  useEffect(() => {
    if (!ready) return
    const yt = ref.current?.getInternalPlayer?.()
    if (!yt) return
    try {
      if (playing) {
        yt.unMute?.()
        yt.playVideo?.()
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
      volume={clamp01(volume)}
      muted={volume <= 0}
      loop={loop}
      width={0}
      height={0}
      onReady={() => {
        setReady(true)
        const yt = ref.current?.getInternalPlayer?.()
        try {
          yt?.setVolume?.(Math.round(clamp01(volume) * 100))
          if (playing) yt?.playVideo?.()
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
