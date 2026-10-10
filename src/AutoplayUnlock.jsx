import useStore from './store'

function unlockBrowserAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (Ctx) {
      const ctx = new Ctx()
      ctx.resume?.()
      const buf = ctx.createBuffer(1, 1, 22050)
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(ctx.destination)
      src.start(0)
    }
  } catch {
    // ignore
  }
  try {
    const a = new Audio(
      'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='
    )
    a.volume = 0.01
    a.play()?.catch(() => {})
  } catch {
    // ignore
  }
}

export default function AutoplayUnlock() {
  const audioUnlocked = useStore((s) => s.audioUnlocked)
  const unlockAudio = useStore((s) => s.unlockAudio)

  if (audioUnlocked) return null

  return (
    <div className="autoplay-unlock">
      <div className="autoplay-unlock-card">
        <h3>Enable audio</h3>
        <p>
          Browsers block sound until you interact. Click below once to unlock
          YouTube playback for this session.
        </p>
        <button
          type="button"
          className="autoplay-unlock-btn"
          onClick={() => {
            unlockBrowserAudio()
            unlockAudio()
          }}
        >
          Unlock audio
        </button>
      </div>
    </div>
  )
}
