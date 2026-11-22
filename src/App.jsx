import { useEffect, useState } from 'react'
import OBR from '@owlbear-rodeo/sdk'
import useStore from './store'
import Player from './Player'
import MetadataSync from './MetadataSync'
import FadeEngine from './FadeEngine'
import AutoplayUnlock from './AutoplayUnlock'
import { canPlayUrl } from './youtube.js'
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
  '👁️', '🌀', '✨', '🔮',
]

function ErrorBanner() {
  const playbackErrors = useStore((s) => s.playbackErrors)
  const entries = Object.entries(playbackErrors || {})
  if (!entries.length) return null
  return (
    <div className="error-banner">
      <div className="error-banner-head">
        <strong>Playback errors</strong>
        <button
          type="button"
          onClick={() => useStore.getState().clearAllPlaybackErrors()}
        >
          Clear all
        </button>
      </div>
      {entries.map(([key, msg]) => (
        <div key={key} className="error-item">
          <span>{msg}</span>
          <button
            type="button"
            onClick={() => useStore.getState().clearPlaybackError(key)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
/** Two-step delete without window.confirm (native dialogs can be blocked inside the iframe) */
function ConfirmButton({ label, onConfirm, className }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return undefined
    const id = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(id)
  }, [armed])
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else {
          setArmed(true)
        }
      }}
    >
      {armed ? 'Click again to delete' : label}
    </button>
  )
}

/** URL field: applies the link after a short pause / on blur / Enter, not on every keystroke */
function UrlInput({ value, onCommit }) {
  const [text, setText] = useState(value)
  useEffect(() => {
    setText(value)
  }, [value])

  const trimmed = text.trim()
  useEffect(() => {
    if (trimmed === value) return undefined
    const id = setTimeout(() => onCommit(trimmed), 600)
    return () => clearTimeout(id)
  }, [trimmed, value]) // eslint-disable-line react-hooks/exhaustive-deps

  const invalid = trimmed !== '' && !canPlayUrl(trimmed)
  return (
    <>
      <input
        className={`url-input${invalid ? ' invalid' : ''}`}
        placeholder="https://youtube.com/watch?v=..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (trimmed !== value) onCommit(trimmed)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
      {invalid && <div className="field-hint">Not a valid YouTube video link</div>}
    </>
  )
}

function App() {
  const [ready, setReady] = useState(false)
  const [role, setRole] = useState(null)
  const [view, setView] = useState('home')
  const [activeFolderId, setActiveFolderId] = useState(null)
  const [activeStreamId, setActiveStreamId] = useState(null)
  const [importError, setImportError] = useState('')
  
  const folders = useStore((s) => s.folders)
  const playingStreams = useStore((s) => s.playingStreams)
  const currentlyStreaming = useStore((s) => s.currentlyStreaming)
  const isPaused = useStore((s) => s.isPaused)
  const isLocalOnly = useStore((s) => s.isLocalOnly)
  const globalVolume = useStore((s) => s.globalVolume)
  const gmMuted = useStore((s) => s.gmMuted)
  const localMuted = useStore((s) => s.localMuted)

  useEffect(() => {
    let disposed = false
    let unsubscribe = null
    OBR.onReady(async () => {
      const playerRole = await OBR.player.getRole()
      if (disposed) return

      // Other extensions also write room metadata: skip updates that don't change our data
      let lastApplied = ''
      const applyIfChanged = (data, opts) => {
        const json = JSON.stringify(data)
        if (json === lastApplied) return
        lastApplied = json
        useStore.getState().applyRemoteState(data, opts)
      }

      unsubscribe = OBR.room.onMetadataChange((metadata) => {
        if (playerRole === 'GM') return
        const data = metadata['warpsong']
        if (data) applyIfChanged(data)
      })

      try {
        const current = await OBR.room.getMetadata()
        if (current['warpsong']) {
          applyIfChanged(current['warpsong'], {
            hydrateMaster: playerRole === 'GM',
          })
        }
      } catch (err) {
        console.warn('WarpSong getMetadata failed', err)
      }

      setRole(playerRole)
      setReady(true)
    })
    return () => {
      disposed = true
      unsubscribe?.()
    }
  }, [])

  const handleSave = () => {
    const data = useStore.getState().exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'warpsong.json'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    // Revoking right away cancels the download in Firefox/Safari
    setTimeout(() => {
      a.remove()
      URL.revokeObjectURL(url)
    }, 1500)
  }

  const handleLoad = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.djinni,application/json'
    input.onchange = (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onerror = () => setImportError('Could not read the file')
      reader.onload = () => {
        let parsed
        try {
          parsed = JSON.parse(reader.result)
        } catch {
          setImportError('Invalid file: not valid JSON')
          return
        }
        try {
          const result = useStore.getState().importData(parsed)
          if (!result.ok) {
            setImportError(result.error || 'Invalid file')
            return
          }
          setImportError('')
          setView('home')
          setActiveFolderId(null)
          setActiveStreamId(null)
        } catch (err) {
          console.warn('WarpSong import failed', err)
          setImportError('Invalid file: unexpected structure')
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

  const openFolderVisual = () => setView('folder-visual')

  const openStream = (streamId) => {
    setActiveStreamId(streamId)
    setView('stream')
  }

  const openStreamVisual = (streamId) => {
    setActiveStreamId(streamId)
    setView('stream-visual')
  }

  const goBack = () => {
    if (view === 'stream' || view === 'stream-visual') {
      useStore.getState().commitRoomStreaming()
      setActiveStreamId(null)
      setView('folder')
    } else if (view === 'folder-visual') {
      setView('folder')
    } else if (view === 'folder') {
      setActiveFolderId(null)
      setView('home')
    }
  }

  const streamIsActive = (streamId) =>
    !!playingStreams[streamId] ||
    currentlyStreaming.some((e) => e.id === streamId)

  if (!ready || !role) {
    return <div className="loading">Loading WarpSong…</div>
  }

  if (role === 'PLAYER') {
    return (
      <div className="app">
        <FadeEngine />
        <AutoplayUnlock />
        <div className="topbar">
          <div>
            <h2>WarpSong</h2>
            <span className="subtitle">Player</span>
          </div>
        </div>
        <ErrorBanner />
        <div className="player-view">
          <p className="player-hint">The Changer weaves the score…</p>
          {isPaused && <p className="status-pill">GM paused</p>}
          {gmMuted && <p className="status-pill">GM muted</p>}
          {currentlyStreaming?.length > 0 ? (
            <div className="now-playing">
              <strong>Now playing</strong>
              <ul>
                {currentlyStreaming.map((s) => (
                  <li key={s.id}>
                    {s.emoji || '🎵'} {s.name}
                    {s.fadingIn ? ' (fade in)' : ''}
                    {s.fadingOut ? ' (fade out)' : ''}
                    {s.muted ? ' (muted)' : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="empty-hint">Silence in the warp</p>
          )}
          <label className="control-row">
            Volume
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={globalVolume}
              onChange={(e) =>
                useStore.getState().setGlobalVolume(Number(e.target.value))
              }
            />
          </label>
          <button
            type="button"
            onClick={() => useStore.getState().setLocalMuted(!localMuted)}
          >
            {localMuted ? 'Unmute (local)' : 'Mute (local)'}
          </button>
        </div>
        <Player />
      </div>
    )
  }

  return (
    <div className="app">
      <MetadataSync enabled />
      <FadeEngine />
      <AutoplayUnlock />
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
              {(view === 'folder' || view === 'folder-visual') &&
                (activeFolder?.name || 'Folder')}
              {(view === 'stream' || view === 'stream-visual') &&
                (activeStream?.name || 'Stream')}
            </h2>
            <span className="subtitle">
              {view === 'home' && 'Folders'}
              {view === 'folder' &&
                `${activeFolder?.streams.length || 0} streams`}
              {view === 'folder-visual' && 'Folder look'}
              {view === 'stream' && 'Sound & sources'}
              {view === 'stream-visual' && 'Stream look'}
            </span>
          </div>
        </div>

        {view === 'home' && (
          <div className="topbar-actions">
            <button type="button" onClick={handleLoad}>Load</button>
            <button type="button" onClick={handleSave}>Save</button>
            <button type="button" onClick={() => useStore.getState().addFolder()}>
              + Folder
            </button>
          </div>
        )}
      </div>

      <ErrorBanner />
      
      {importError && (
        <div className="error-banner">
          <div className="error-item">
            <span>{importError}</span>
            <button type="button" onClick={() => setImportError('')}>
              ×
            </button>
          </div>
        </div>
      )}
      <div className="global-controls">
        <button
          type="button"
          className={isLocalOnly ? 'active' : ''}
          onClick={() => useStore.getState().setLocalOnly(!isLocalOnly)}
        >
          {isLocalOnly ? 'Local' : 'Shared'}
        </button>
        <button
          type="button"
          onClick={() => useStore.getState().setPaused(!isPaused)}
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>
        <button type="button" onClick={() => useStore.getState().stopAll()}>
          Stop
        </button>
        <label className="volume">
          Vol
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={globalVolume}
            onChange={(e) =>
              useStore.getState().setGlobalVolume(Number(e.target.value))
            }
          />
        </label>
        <button
          type="button"
          className={gmMuted ? 'active' : ''}
          onClick={() => useStore.getState().setGmMuted(!gmMuted)}
          title="Mutes everyone (synced)"
        >
          {gmMuted ? 'Unmute' : 'Mute'}
        </button>
      </div>

      {view === 'home' && (
        <div className="grid">
          {folders.map((folder) => {
            const folderPlaying = folder.streams.some((s) =>
              streamIsActive(s.id)
            )
            return (
              <div
                key={folder.id}
                className={`tile folder-tile ${folderPlaying ? 'has-playing' : ''}`}
                style={{ borderColor: folder.color || '#7B5CFF' }}
              >
                <div className="tile-main" onClick={() => openFolder(folder.id)}>
                  <div className="tile-emoji">{folder.emoji || '📁'}</div>
                  <div className="tile-name">{folder.name}</div>
                  <div className="tile-meta">{folder.streams.length} streams</div>
                </div>
                {folderPlaying && (
                  <div className="tile-playing-badge" title="Playing">🔊</div>
                )}
                <button
                  type="button"
                  className="tile-settings"
                  title="Folder look"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveFolderId(folder.id)
                    setView('folder-visual')
                  }}
                >
                  ⚙
                </button>
              </div>
            )
          })}
          <div className="tile add-tile" onClick={() => useStore.getState().addFolder()}>
            <div className="tile-emoji">＋</div>
            <div className="tile-name">New Folder</div>
          </div>
          {folders.length === 0 && (
            <div className="empty-hint">No folders yet. Create one.</div>
          )}
        </div>
      )}

      {view === 'folder' && activeFolder && (
        <div className="folder-screen">
          <div className="folder-toolbar">
            <input
              className="inline-input"
              value={activeFolder.name}
              onChange={(e) =>
                useStore.getState().updateFolder(activeFolder.id, {
                  name: e.target.value,
                })
              }
              placeholder="Folder name"
            />
            <button type="button" onClick={openFolderVisual}>Look</button>
            <ConfirmButton
              className="danger"
              label="Delete"
              onConfirm={() => {
                useStore.getState().deleteFolder(activeFolder.id)
                setView('home')
                setActiveFolderId(null)
              }}
            />
          </div>
          <div className="grid">
            {activeFolder.streams.map((stream) => {
              const isPlaying = streamIsActive(stream.id)
              const fading = currentlyStreaming.some(
                (e) => e.id === stream.id && e.fadingOut
              )
              return (
                <div
                  key={stream.id}
                  className={`tile stream-tile ${isPlaying ? 'playing' : ''}`}
                  style={{
                    borderColor: stream.color || (isPlaying ? '#C9A227' : '#3a2f6b'),
                  }}
                >
                  <button
                    type="button"
                    className="tile-visual"
                    title="Stream look"
                    onClick={(e) => {
                      e.stopPropagation()
                      openStreamVisual(stream.id)
                    }}
                  >
                    🎨
                  </button>
                  <div
                    className="tile-main"
                    onClick={() => useStore.getState().toggleStream(stream.id)}
                  >
                    <div className="tile-emoji">{stream.emoji || '🎵'}</div>
                    <div className="tile-name">{stream.name}</div>
                    <div className="tile-meta">
                      {fading ? 'fading out · ' : isPlaying ? 'playing · ' : ''}
                      {stream.muted ? 'muted · ' : ''}
                      {stream.links.length} link{stream.links.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="tile-settings"
                    title="Sound & links"
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
              onClick={() => useStore.getState().addStream(activeFolder.id)}
            >
              <div className="tile-emoji">＋</div>
              <div className="tile-name">New Stream</div>
            </div>
          </div>
        </div>
      )}

      {view === 'folder-visual' && activeFolder && (
        <div className="stream-screen">
          <div className="settings-block">
            <label>
              Emoji
              <div className="emoji-picker-row">
                <input
                  className="emoji-input"
                  value={activeFolder.emoji || '📁'}
                  maxLength={4}
                  onChange={(e) =>
                    useStore.getState().updateFolder(activeFolder.id, {
                      emoji: e.target.value,
                    })
                  }
                />
                <div className="emoji-presets">
                  {STREAM_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      className={`emoji-preset-btn ${
                        activeFolder.emoji === em ? 'selected' : ''
                      }`}
                      onClick={() =>
                        useStore.getState().updateFolder(activeFolder.id, {
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
              Border color
              <input
                type="color"
                value={activeFolder.color || '#7B5CFF'}
                onChange={(e) =>
                  useStore.getState().updateFolder(activeFolder.id, {
                    color: e.target.value,
                  })
                }
              />
            </label>
          </div>
        </div>
      )}

      {view === 'stream' && activeFolder && activeStream && (
        <div className="stream-screen">
          <div className="settings-block">
            <label>
              Name
              <input
                value={activeStream.name}
                onChange={(e) =>
                  useStore.getState().updateStream(activeFolder.id, activeStream.id, {
                    name: e.target.value,
                  })
                }
              />
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
                  useStore.getState().updateStream(activeFolder.id, activeStream.id, {
                    volume: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={!!activeStream.muted}
                onChange={(e) =>
                  useStore.getState().updateStream(activeFolder.id, activeStream.id, {
                    muted: e.target.checked,
                  })
                }
              />
              Mute this stream
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
                    useStore.getState().updateStream(activeFolder.id, activeStream.id, {
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
                    useStore.getState().updateStream(activeFolder.id, activeStream.id, {
                      fadeOut: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <ConfirmButton
              className="danger"
              label="Delete Stream"
              onConfirm={() => {
                useStore.getState().deleteStream(activeFolder.id, activeStream.id)
                setView('folder')
                setActiveStreamId(null)
              }}
            />
          </div>

          <div className="settings-block">
            <div className="links-header">
              <strong>Sources (YouTube)</strong>
              <button
                type="button"
                onClick={() =>
                  useStore.getState().addLink(activeFolder.id, activeStream.id)
                }
              >
                + Link
              </button>
            </div>
            {activeStream.links.map((link, index) => (
              <div key={link.id} className="link-card">
                <div className="link-top">
                  <span>#{index + 1}</span>
                  <button
                    type="button"
                    className="danger-text"
                    onClick={() =>
                      useStore.getState().deleteLink(
                        activeFolder.id,
                        activeStream.id,
                        link.id
                      )
                    }
                  >
                    ×
                  </button>
                </div>
                <UrlInput
                  value={link.url}
                  onCommit={(url) =>
                    useStore.getState().updateLink(
                      activeFolder.id,
                      activeStream.id,
                      link.id,
                      { url }
                    )
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
                      useStore.getState().updateLink(
                        activeFolder.id,
                        activeStream.id,
                        link.id,
                        { volume: Number(e.target.value) }
                      )
                    }
                  />
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={!!link.loop}
                    onChange={(e) =>
                      useStore.getState().updateLink(
                        activeFolder.id,
                        activeStream.id,
                        link.id,
                        { loop: e.target.checked }
                      )
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

      {view === 'stream-visual' && activeFolder && activeStream && (
        <div className="stream-screen">
          <div className="settings-block">
            <label>
              Emoji
              <div className="emoji-picker-row">
                <input
                  className="emoji-input"
                  value={activeStream.emoji || '🎵'}
                  maxLength={4}
                  onChange={(e) =>
                    useStore.getState().updateStream(activeFolder.id, activeStream.id, {
                      emoji: e.target.value,
                    })
                  }
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
                        useStore.getState().updateStream(
                          activeFolder.id,
                          activeStream.id,
                          { emoji: em }
                        )
                      }
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            </label>
            <label>
              Border color
              <input
                type="color"
                value={activeStream.color || '#5C7CFF'}
                onChange={(e) =>
                  useStore.getState().updateStream(activeFolder.id, activeStream.id, {
                    color: e.target.value,
                  })
                }
              />
            </label>
          </div>
        </div>
      )}

      <Player />
    </div>
  )
}

export default App
