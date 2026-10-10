export function clamp01(n) {
  const x = Number(n)
  if (Number.isNaN(x)) return 0
  return Math.max(0, Math.min(1, x))
}

export function isYouTubeUrl(url) {
  if (!url || typeof url !== 'string') return false
  return /youtu\.be\/|youtube\.com\/|youtube-nocookie\.com\//i.test(url)
}

export function trackDue(track, now = Date.now()) {
  const delayMs = Math.max(0, Number(track.delay) || 0) * 1000
  if (delayMs <= 0) return true
  const start = Number(track.startedAt) || 0
  if (!start) return true
  return now >= start + delayMs
}

function mapPlaybackLinks(links) {
  return (links || [])
    .filter((l) => l && l.url)
    .map((l) => ({
      id: l.id,
      url: l.url,
      volume: l.volume ?? 1,
      loop: l.loop !== false,
      delay: Math.max(0, Number(l.delay) || 0),
    }))
}

export function tracksFromState(state) {
  const list = []
  ;(state.currentlyStreaming || []).forEach((stream) => {
    mapPlaybackLinks(stream.links).forEach((link) => {
      list.push({
        key: stream.id + '::' + link.id,
        streamId: stream.id,
        linkId: link.id,
        url: link.url,
        loop: link.loop !== false,
        delay: link.delay,
        startedAt: stream.startedAt,
        streamVolume: stream.volume ?? 0.7,
        linkVolume: link.volume ?? 1,
        fadeFactor: stream.fadeFactor ?? 1,
        streamMuted: !!stream.muted,
        isYouTube: isYouTubeUrl(link.url),
        active: true,
      })
    })
  })
  return list
}

export function computeVolume(state, track, now = Date.now()) {
  if (!track || !track.active) return 0
  if (!trackDue(track, now)) return 0
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
  const master = (state.globalVolume ?? 1) * roomMaster
  return clamp01(
    master *
      (track.streamVolume ?? 0.7) *
      (track.linkVolume ?? 1) *
      (track.fadeFactor ?? 1)
  )
}

/** Pause only for hard pause / locked audio / not due yet. Mute stays playing at vol 0. */
export function shouldPlay(state, track, now = Date.now()) {
  if (!track || !track.active) return false
  if (!state.audioUnlocked) return false
  if (state.isPaused) return false
  if (!trackDue(track, now)) return false
  return true
}

export { mapPlaybackLinks }
