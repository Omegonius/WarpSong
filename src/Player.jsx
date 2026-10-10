import { memo, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import ReactPlayer from 'react-player/youtube'
import useStore from './store'
import {
  computeVolume,
  isYouTubeUrl,
  shouldPlay,
  tracksFromState,
} from './playback.js'

function applyYoutube(yt, state, track) {
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

export default function Player() {
  const [trackKeys, setTrackKeys] = useState([])
  const tracksRef = useRef(new Map())
  const playersRef = useRef(new Map())
  const mountPropsRef = useRef(new Map())
  const lastKeysRef = useRef([])

  useEffect(() => {
    const reportLinkErrors = (state) => {
      const { setPlaybackError, clearPlaybackError } = useStore.getState()
      ;(state.currentlyStreaming || []).forEach((stream) => {
        ;(stream.links || []).forEach((link) => {
          if (!link?.url) return
          const key = stream.id + '::' + link.id
          if (!isYouTubeUrl(link.url)) {
            setPlaybackError(
              key,
              `Cannot play: ${link.url} (only YouTube links are supported)`
            )
          } else {
            const current = useStore.getState().playbackErrors[key]
            if (current && current.startsWith('Cannot play:') && current.includes('only YouTube')) {
              clearPlaybackError(key)
            }
          }
        })
      })
    }

    const apply = (state) => {
      reportLinkErrors(state)
      const activeList = tracksFromState(state)
      const activeMap = new Map(activeList.map((t) => [t.key, t]))

      const merged = new Map(tracksRef.current)
      merged.forEach((t, key) => {
        merged.set(key, { ...t, active: false })
      })
      activeMap.forEach((t, key) => {
        merged.set(key, { ...t, active: true })
        const prevMount = mountPropsRef.current.get(key)
        if (!prevMount) {
          mountPropsRef.current.set(key, {
            url: t.url,
            loop: t.loop,
            gen: 0,
          })
        } else if (prevMount.url !== t.url || prevMount.loop !== t.loop) {
          mountPropsRef.current.set(key, {
            url: t.url,
            loop: t.loop,
            gen: (prevMount.gen || 0) + 1,
          })
        }
      })
      tracksRef.current = merged

      const nextKeys = []
      merged.forEach((_t, key) => {
        const mount = mountPropsRef.current.get(key)
        nextKeys.push(key + '::g' + (mount?.gen ?? 0))
      })
      nextKeys.sort()

      const sameKeys =
        lastKeysRef.current.length === nextKeys.length &&
        lastKeysRef.current.every((k, i) => k === nextKeys[i])
      if (!sameKeys) {
        lastKeysRef.current = nextKeys
        const updateKeys = () => setTrackKeys(nextKeys)
        try {
          flushSync(updateKeys)
        } catch {
          updateKeys()
        }
      }

      merged.forEach((track, key) => {
        const slot = playersRef.current.get(key)
        if (!slot?.ready || !slot.getInternal) return
        applyYoutube(slot.getInternal(), state, track)
      })
    }

    apply(useStore.getState())
    const unsub = useStore.subscribe(apply)
    const delayTimer = setInterval(() => {
      const state = useStore.getState()
      const needsClock = (state.currentlyStreaming || []).some((s) =>
        (s.links || []).some((l) => (Number(l.delay) || 0) > 0)
      )
      if (needsClock) apply(state)
    }, 100)

    return () => {
      unsub()
      clearInterval(delayTimer)
    }
  }, [])

  return (
    <div className="yt-offscreen" aria-hidden>
      {trackKeys.map((renderKey) => {
        const trackKey = renderKey.includes('::g')
          ? renderKey.slice(0, renderKey.lastIndexOf('::g'))
          : renderKey

        const mount = mountPropsRef.current.get(trackKey)
        const track = tracksRef.current.get(trackKey)
        if (!mount && !track) return null
        const url = mount?.url || track?.url
        const loop = mount?.loop ?? track?.loop ?? true
        if (!url || !isYouTubeUrl(url)) return null
        return (
          <MountedYouTube
            key={renderKey}
            trackKey={trackKey}
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

const MountedYouTube = memo(function MountedYouTube({
  trackKey,
  url,
  loop,
  playersRef,
  tracksRef,
}) {
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
    applyYoutube(yt, state, track)
  }

  return (
    <ReactPlayer
      ref={playerRef}
      url={url}
      playing={true}
      volume={1}
      muted={false}
      loop={loop}
      width={1}
      height={1}
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
})
