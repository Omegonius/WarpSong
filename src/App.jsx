import { useEffect, useState } from 'react'
import OBR from '@owlbear-rodeo/sdk'
import useStore from './store'
import './index.css'

function App() {
  const [ready, setReady] = useState(false)
  const [role, setRole] = useState(null)

  const {
    folders,
    playingStreams,
    isPaused,
    isLocalOnly,
    globalVolume,
    isMuted,
    toggleStream,
    setPaused,
    setLocalOnly,
    setGlobalVolume,
    setMuted,
  } = useStore()

  useEffect(() => {
    OBR.onReady(async () => {
      setReady(true)
      const playerRole = await OBR.player.getRole()
      setRole(playerRole)
    })
  }, [])

  if (!ready) {
    return (
      <div className="loading">
        Loading WarpSong...
      </div>
    )
  }

  // Якщо гравець — показуємо спрощений вигляд
  if (role === 'PLAYER') {
    return (
      <div className="app">
        <div className="header">
          <h2>WarpSong</h2>
          <p className="subtitle">Player View</p>
        </div>
        <div className="player-view">
          <p>GM is controlling the music</p>
          <label>
            Volume
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={globalVolume}
              onChange={(e) => setGlobalVolume(Number(e.target.value))}
            />
          </label>
          <button onClick={() => setMuted(!isMuted)}>
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
        </div>
      </div>
    )
  }

  // GM View
  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <h2>WarpSong</h2>
        <div className="header-controls">
          <button
            className={isLocalOnly ? 'active' : ''}
            onClick={() => setLocalOnly(!isLocalOnly)}
            title="Local only / Share with players"
          >
            {isLocalOnly ? 'Local' : 'Shared'}
          </button>

          <button onClick={() => setPaused(!isPaused)}>
            {isPaused ? 'Resume' : 'Pause'}
          </button>

          <button onClick={() => useStore.setState({ playingStreams: {} })}>
            Stop All
          </button>

          <label className="volume">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={globalVolume}
              onChange={(e) => setGlobalVolume(Number(e.target.value))}
            />
          </label>

          <button onClick={() => setMuted(!isMuted)}>
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
        </div>
      </div>

      {/* Folders */}
      <div className="folders">
        {folders.map((folder) => (
          <div key={folder.id} className="folder">
            <div
              className="folder-header"
              style={{ borderLeft: `4px solid ${folder.color}` }}
            >
              <span className="folder-name">{folder.name}</span>
            </div>

            <div className="streams">
              {folder.streams.map((stream) => {
                const isPlaying = !!playingStreams[stream.id]
                return (
                  <div
                    key={stream.id}
                    className={`stream ${isPlaying ? 'playing' : ''}`}
                    onClick={() => toggleStream(stream.id)}
                  >
                    <div className="stream-name">
                      {isPlaying ? '▶ ' : ''}
                      {stream.name}
                    </div>
                    <div className="stream-meta">
                      {stream.links.length} link(s)
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
