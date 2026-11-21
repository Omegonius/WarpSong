import { memo, useEffect, useMemo, useState } from 'react'
import ReactPlayer from 'react-player/youtube'
import useStore from './store'
import {
  computeVolume,
  isYouTubeUrl,
  shouldPlay,
  tracksFromState,
} from './playback.js'

// No `autoplay` here: the `playing` prop decides when a track starts
const PLAYER_CONFIG = {
  youtube: {
    playerVars: {
      controls: 0,
      disablekb: 1,
      fs: 0,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
    },
  },
}

const YT_ERRORS = {
  2: 'invalid video link',
  5: 'player error, try again',
  100: 'video removed or private',
  101: 'embedding disabled by the owner',
  150: 'embedding disabled by the owner',
}

function canPlayUrl(url) {
  if (!isYouTubeUrl(url)) return false
  return typeof ReactPlayer.canPlay === 'function'
    ? ReactPlayer.canPlay(url)
    : true
}

function errorText(url, e) {
  const code = typeof e === 'number' ? e : e?.data
  const why = YT_ERRORS[code] || 'private, blocked, or unavailable'
  return `Cannot play: ${url || 'invalid link'} (${why})`
}

/**
 * Declarative player: every active track is one mounted <ReactPlayer>.
 * Volume / play / mute are plain props, so the iframe is only touched when
 * a value really changes. A track that leaves the list is unmounted, which
 * destroys its YouTube iframe (no leftover iframes after Stop).
 */
export default function Player() {
  const currentlyStreaming = useStore((s) => s.currentlyStreaming)
  const isPaused = useStore((s) => s.isPaused)
  const gmMuted = useStore((s) => s.gmMuted)
  const localMuted = useStore((s) => s.localMuted)
  const audioUnlocked = useStore((s) => s.audioUnlocked)
  const globalVolume = useStore((s) => s.globalVolume)
  const roomGlobalVolume = useStore((s) => s.roomGlobalVolume)

  // Links that can never play (not a YouTube video link)
  useEffect(() => {
    const { setPlaybackError, clearPlaybackError } = useStore.getState()
    currentlyStreaming.forEach((stream) => {
      ;(stream.links || []).forEach((link) => {
        if (!link?.url) return
        const key = stream.id + '::' + link.id
        if (!canPlayUrl(link.url)) {
          setPlaybackError(
            key,
            `Cannot play: ${link.url} (not a valid YouTube video link)`
          )
        } else {
          const current = useStore.getState().playbackErrors[key]
          if (current && current.includes('not a valid YouTube')) {
            clearPlaybackError(key)
          }
        }
      })
    })
  }, [currentlyStreaming])

  const tracks = useMemo(
    () =>
      tracksFromState({ currentlyStreaming }).filter((t) => canPlayUrl(t.url)),
    [currentlyStreaming]
  )

  // Clock is only needed for links with a start delay
  const needsClock = tracks.some((t) => t.delay > 0)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!needsClock) return undefined
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [needsClock])

  const gate = {
    isPaused,
    gmMuted,
    localMuted,
    audioUnlocked,
    globalVolume,
    roomGlobalVolume,
  }

  return (
    <div className="yt-offscreen" aria-hidden>
      {tracks.map((track) => {
        const volume = Math.round(computeVolume(gate, track, now) * 100) / 100
        const playing = shouldPlay(gate, track, now)
        return (
          <TrackPlayer
            key={`${track.key}|${track.url}|${track.loop ? 1 : 0}`}
            trackKey={track.key}
            url={track.url}
            loop={track.loop}
            volume={volume}
            playing={playing}
          />
        )
      })}
    </div>
  )
}

const TrackPlayer = memo(function TrackPlayer({
  trackKey,
  url,
  loop,
  volume,
  playing,
}) {
  const setPlaybackError = useStore((s) => s.setPlaybackError)
  const clearPlaybackError = useStore((s) => s.clearPlaybackError)

  useEffect(() => () => clearPlaybackError(trackKey), [trackKey, clearPlaybackError])

  return (
    <ReactPlayer
      url={url}
      playing={playing}
      volume={volume}
      muted={volume <= 0}
      loop={loop}
      width={1}
      height={1}
      progressInterval={10000}
      onReady={() => clearPlaybackError(trackKey)}
      onError={(e) => setPlaybackError(trackKey, errorText(url, e))}
      config={PLAYER_CONFIG}
    />
  )
})
