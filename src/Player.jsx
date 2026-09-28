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
  const isMuted = useStore((s) => s.isMuted)

  // Поточні «мають грати» стріми
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

  // Пул слотів: key -> { streamId, linkId, url, loop }
  // Слот НЕ видаляється одразу при stop — лише playing=false
  const poolRef = useRef(new Map())
  const [, bump] = useState(0)
  const force = () => bump((n) => n + 1)

  // Оновлюємо пул: додаємо нові, старі лишаємо
  useEffect(() => {
    const desiredKeys = new Set()

    desiredStreams.forEach((stream) => {
      ;(stream.links || []).forEach((link) => {
        if (!link.url || !/youtu/i.test(link.url)) return
        const key = `${stream.id}::${link.id}`
        desiredKeys.add(key)
        const prev = poolRef.current.get(key)
        poolRef.current.set(key, {
          key,
          streamId: stream.id,
          linkId: link.id,
          url: link.url,
          loop: link.loop !== false,
          // active = зараз має грати
          active: true,
        })
        // якщо url змінився — оновлюємо
        if (prev && prev.url !== link.url) {
          poolRef.current.set(key, {
            ...poolRef.current.get(key),
            url: link.url,
          })
        }
      })
    })

    // хто зник з desired — не active, але лишається в пулі
    poolRef.current.forEach((slot, key) => {
      if (!desiredKeys.has(key)) {
        poolRef.current.set(key, { ...slot, active: false })
      }
    })

    force()
  }, [desiredStreams])

  // Stop all / порожній playing — чистимо пул із затримкою,
  // щоб YouTube встиг pause перед unmount
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
  const globalMuted = isMuted || isPaused

  return (
    <div style={{ display: 'none' }}>
      {slots.map((slot) => (
        <StableYouTube
          key={slot.key}
          streamId={slot.streamId}
          linkId={slot.linkId}
          url={slot.url}
          playing={!!slot.active && !globalMuted}
          loop={slot.loop}
        />
      ))}
    </div>
  )
}

function StableYouTube({ streamId, linkId, url, playing, loop }) {
  const ref = useRef(null)
  const [ready, setReady] = useState(false)

  const volume = useStore((s) => {
    const global = s.isMuted || s.isPaused ? 0 : s.globalVolume

    for (const folder of s.folders) {
      const stream = folder.streams.find((st) => st.id === streamId)
      if (stream) {
        const link = (stream.links || []).find((l) => l.id === linkId)
        const sv = stream.volume ?? 0.7
        const lv = link?.volume ?? 1
        return clamp01(global * sv * lv)
      }
    }

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
      muted={volume <= 0 || !playing}
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
