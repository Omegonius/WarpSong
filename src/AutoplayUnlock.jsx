import useStore from './store'

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
          onClick={() => unlockAudio()}
        >
          Unlock audio
        </button>
      </div>
    </div>
  )
}
