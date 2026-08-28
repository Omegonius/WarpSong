import { useEffect, useState } from 'react'
import OBR from '@owlbear-rodeo/sdk'
import useStore from './store'
import Player from './Player'
import './index.css'

const STREAM_EMOJIS = [
  '⚔️', '🗡️', '🛡️', '🏹',
  '🌲', '🌳', '🍃', '🍄',
  '💨', '🌪️', '🌊', '🌧️',
  '🔥', '💥', '⚡', '🌋',
  '😠', '😈', '💀', '🩸',
  '💃', '🕺', '🎉', '🍻',
  '🏰', '🏚️', '🌙', '⭐',
  '🐉', '🐺', '🦇', '🕷️',
  '🎵', '🎶', '🥁', '🎻',
  '🏙️', '🚢', '🚂', '✈️',
]

function App() {
  const [ready, setReady] = useState(false)
  const [role, setRole] = useState(null)

  const [view, setView] = useState('home')
  const [activeFolderId, setActiveFolderId] = useState(null)
  const [activeStreamId, setActiveStreamId] = useState(null)

  const {
    folders,
    playingStreams,
    isPaused,
    isLocalOnly,
    globalVolume,
    isMuted,
    toggleStream,
    stopAll,
    setPaused,
    setLocalOnly,
    setGlobalVolume,
    setMuted,
    addFolder,
    updateFolder,
    deleteFolder,
    addStream,
    updateStream,
    deleteStream,
    addLink,
    updateLink,
    deleteLink,
    applyRemoteState,
    exportData,
    importData,
  } = useStore()

  useEffect(() => {
    OBR.onReady(async () => {
      setReady(true)
      const playerRole = await OBR.player.getRole()
      setRole(playerRole)

      OBR.room.onMetadataChange((metadata) => {
        const data = metadata['warpsong']
        if (data) applyRemoteState(data)
      })

      const current = await OBR.room.getMetadata()
      if (current['warpsong']) applyRemoteState(current['warpsong'])
    })
  }, [])

  useEffect(() => {
    if (role !== 'GM') return
    if (isLocalOnly) return

    OBR.room.setMetadata({
      warpsong: {
        playingStreams,
        isPaused,
        isLocalOnly,
      },
    })
  }, [playingStreams, isPaused, isLocalOnly, role])

  const handleSave = () => {
    const data = exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'warpsong.djinni.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleLoad = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.djinni,application/json'
    input.onchange = (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          importData(JSON.parse(reader.result))
        } catch {
          alert('Invalid file')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const activeFolder = folders.find((f) => f.id === activeFolderId)
  const activeStream = activeFolder?.streams.find((s) => s.id === activeStreamId)

  const openFolder = (folderId) => {
    setActiveFolderId(folderId)
    setActiveStreamId(null)
    setView('folder')
  }

  const openStream = (streamId) => {
    setActiveStreamId(streamId)
    setView('stream')
  }

  const goBack = () => {
    if (view === 'stream') {
      setActiveStreamId(null)
      setView('folder')
    } else if (view === 'folder') {
      setActiveFolderId(null)
      setView('home')
    }
  }

  if (!ready) {
    return <div className="loading">Loading WarpSong...</div>
  }

  // ---------- PLAYER VIEW ----------
  if (role === 'PLAYER') {
    return (
      <div className="app">
        <div className="topbar">
          <h2>WarpSong</h2>
          <span className="subtitle">Player</span>
        </div>
        <div className="player-view">
          <p>GM is controlling the music</p>
          <label className="control-row">
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
        <Player />
      </div>
    )
  }

  // ---------- GM VIEW ----------
  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-left">
          {view !== 'home' && (
            <button className="back-btn" onClick={goBack}>
              ← Back
            </button>
          )}
          <div>
            <h2>
              {view === 'home' && 'WarpSong'}
              {view === 'folder' && (activeFolder?.name || 'Folder')}
              {view === 'stream' && (activeStream?.name || 'Stream')}
            </h2>
            <span className="subtitle">
              {view === 'home' && 'Folders'}
              {view === 'folder' && `${activeFolder?.streams.length || 0} streams`}
              {view === 'stream' && 'Settings'}
            </span>
          </div>
        </div>

        {view === 'home' && (
          <div className="topbar-actions">
            <button onClick={handleLoad}>Load</button>
            <button onClick={handleSave}>Save</button>
            <button onClick={() => addFolder()}>+ Folder</button>
          </div>
        )}
      </div>

      <div className="global-controls">
        <button
          className={isLocalOnly ? 'active' : ''}
          onClick={() => setLocalOnly(!isLocalOnly)}
        >
          {isLocalOnly ? 'Local' : 'Shared'}
        </button>
        <button onClick={() => setPaused(!isPaused)}>
          {isPaused ? 'Resume' : 'Pause'}
        </button>
        <button onClick={stopAll}>Stop</button>
        <label className="volume">
          Vol
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

      {/* HOME */}
      {view === 'home' && (
        <div className="grid">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="tile folder-tile"
              style={{ borderColor: folder.color || '#4CAF50' }}
              onClick={() => openFolder(folder.id)}
            >
              <div className="tile-emoji">{folder.emoji || '📁'}</div>
              <div className="tile-name">{folder.name}</div>
              <div className="tile-meta">{folder.streams.length} streams</div>
            </div>
          ))}

          <div className="tile add-tile" onClick={() => addFolder()}>
            <div className="tile-emoji">＋</div>
            <div className="tile-name">New Folder</div>
          </div>

          {folders.length === 0 && (
            <div className="empty-hint">No folders yet. Create one.</div>
          )}
        </div>
      )}

      {/* FOLDER */}
      {view === 'folder' && activeFolder && (
        <div className="folder-screen">
          <div className="folder-toolbar">
            <input
              className="inline-input"
              value={activeFolder.name}
              onChange={(e) =>
                updateFolder(activeFolder.id, { name: e.target.value })
              }
              placeholder="Folder name"
            />
            <input
              className="emoji-input"
              value={activeFolder.emoji || '📁'}
              maxLength={4}
              onChange={(e) =>
                updateFolder(activeFolder.id, { emoji: e.target.value })
              }
              title="Emoji"
            />
            <input
              type="color"
              value={activeFolder.color || '#4CAF50'}
              onChange={(e) =>
                updateFolder(activeFolder.id, { color: e.target.value })
              }
            />
            <button
              className="danger"
              onClick={() => {
                if (window.confirm(`Delete folder "${activeFolder.name}"?`)) {
                  deleteFolder(activeFolder.id)
                  setView('home')
                  setActiveFolderId(null)
                }
              }}
            >
              Delete
            </button>
          </div>

          <div className="grid">
            {activeFolder.streams.map((stream) => {
              const isPlaying = !!playingStreams[stream.id]
              return (
                <div
                  key={stream.id}
                  className={`tile stream-tile ${isPlaying ? 'playing' : ''}`}
                >
                  <div
                    className="tile-main"
                    onClick={() => toggleStream(stream.id)}
                  >
                    <div className="tile-emoji">
                      {isPlaying ? '🔊' : stream.emoji || '🎵'}
                    </div>
                    <div className="tile-name">{stream.name}</div>
                    <div className="tile-meta">
                      {stream.links.length} link
                      {stream.links.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <button
                    className="tile-settings"
                    onClick={(e) => {
                      e.stopPropagation()
                      openStream(stream.id)
                    }}
                  >
                    ⚙
                  </button>
                </div>
              )
            })}

            <div
              className="tile add-tile"
              onClick={() => addStream(activeFolder.id)}
            >
              <div className="tile-emoji">＋</div>
              <div className="tile-name">New Stream</div>
            </div>
          </div>
        </div>
      )}

      {/* STREAM SETTINGS */}
      {view === 'stream' && activeFolder && activeStream && (
        <div className="stream-screen">
          <div className="settings-block">
            <label>
              Name
              <input
                value={activeStream.name}
                onChange={(e) =>
                  updateStream(activeFolder.id, activeStream.id, {
                    name: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Emoji
              <div className="emoji-picker-row">
                <input
                  className="emoji-input"
                  value={activeStream.emoji || '🎵'}
                  maxLength={4}
                  onChange={(e) =>
                    updateStream(activeFolder.id, activeStream.id, {
                      emoji: e.target.value,
                    })
                  }
                  title="Emoji"
                />
                <div className="emoji-presets">
                  {STREAM_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      className={`emoji-preset-btn ${
                        activeStream.emoji === em ? 'selected' : ''
                      }`}
                      onClick={() =>
                        updateStream(activeFolder.id, activeStream.id, {
                          emoji: em,
                        })
                      }
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            </label>

            <label>
              Stream volume
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={activeStream.volume}
                onChange={(e) =>
                  updateStream(activeFolder.id, activeStream.id, {
                    volume: Number(e.target.value),
                  })
                }
              />
            </label>

            <div className="two-columns">
              <label>
                Fade In (sec)
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={activeStream.fadeIn}
                  onChange={(e) =>
                    updateStream(activeFolder.id, activeStream.id, {
                      fadeIn: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Fade Out (sec)
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={activeStream.fadeOut}
                  onChange={(e) =>
                    updateStream(activeFolder.id, activeStream.id, {
                      fadeOut: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>

            <button
              className="danger"
              onClick={() => {
                if (window.confirm(`Delete stream "${activeStream.name}"?`)) {
                  deleteStream(activeFolder.id, activeStream.id)
                  setView('folder')
                  setActiveStreamId(null)
                }
              }}
            >
              Delete Stream
            </button>
          </div>

          <div className="settings-block">
            <div className="links-header">
              <strong>Sources (YouTube)</strong>
              <button onClick={() => addLink(activeFolder.id, activeStream.id)}>
                + Link
              </button>
            </div>

            {activeStream.links.map((link, index) => (
              <div key={link.id} className="link-card">
                <div className="link-top">
                  <span>#{index + 1}</span>
                  <button
                    className="danger-text"
                    onClick={() =>
                      deleteLink(activeFolder.id, activeStream.id, link.id)
                    }
                  >
                    ×
                  </button>
                </div>
                <input
                  className="url-input"
                  placeholder="https://youtube.com/watch?v=..."
                  value={link.url}
                  onChange={(e) =>
                    updateLink(activeFolder.id, activeStream.id, link.id, {
                      url: e.target.value,
                    })
                  }
                />
                <label>
                  Source volume
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={link.volume ?? 1}
                    onChange={(e) =>
                      updateLink(activeFolder.id, activeStream.id, link.id, {
                        volume: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={!!link.loop}
                    onChange={(e) =>
                      updateLink(activeFolder.id, activeStream.id, link.id, {
                        loop: e.target.checked,
                      })
                    }
                  />
                  Loop
                </label>
              </div>
            ))}

            {activeStream.links.length === 0 && (
              <div className="empty-hint">No sources. Add a YouTube link.</div>
            )}
          </div>
        </div>
      )}

      <Player />
    </div>
  )
}

export default App