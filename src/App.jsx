import { useEffect, useState } from 'react'
import OBR from '@owlbear-rodeo/sdk'
import useStore from './store'
import './index.css'

function App() {
  const [ready, setReady] = useState(false)
  const [role, setRole] = useState(null)
  const [editingFolder, setEditingFolder] = useState(null)
  const [editingStream, setEditingStream] = useState(null)

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
    toggleFolder,

    addStream,
    updateStream,
    deleteStream,

    addLink,
    updateLink,
    deleteLink,
  } = useStore()

  useEffect(() => {
    OBR.onReady(async () => {
      setReady(true)
      const playerRole = await OBR.player.getRole()
      setRole(playerRole)
    })
  }, [])

  if (!ready) {
    return <div className="loading">Loading WarpSong...</div>
  }

  if (role === 'PLAYER') {
    return (
      <div className="app">
        <div className="header">
          <h2>WarpSong</h2>
          <span className="subtitle">Player View</span>
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
              onChange={(e) =>
                setGlobalVolume(Number(e.target.value))
              }
            />
          </label>

          <button onClick={() => setMuted(!isMuted)}>
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {/* HEADER */}

      <div className="header">
        <div className="title-row">
          <div>
            <h2>WarpSong</h2>
            <span className="subtitle">Music Player</span>
          </div>

          <button
            className="add-folder-button"
            onClick={addFolder}
          >
            + Folder
          </button>
        </div>

        <div className="header-controls">
          <button
            className={isLocalOnly ? 'active' : ''}
            onClick={() => setLocalOnly(!isLocalOnly)}
          >
            {isLocalOnly ? 'Local' : 'Shared'}
          </button>

          <button onClick={() => setPaused(!isPaused)}>
            {isPaused ? 'Resume' : 'Pause'}
          </button>

          <button onClick={stopAll}>
            Stop All
          </button>

          <label className="volume">
            Volume
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={globalVolume}
              onChange={(e) =>
                setGlobalVolume(Number(e.target.value))
              }
            />
          </label>

          <button onClick={() => setMuted(!isMuted)}>
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
        </div>
      </div>

      {/* FOLDERS */}

      <div className="folders">
        {folders.map((folder) => (
          <div
            key={folder.id}
            className="folder"
          >
            {/* FOLDER HEADER */}

            <div
              className="folder-header"
              style={{
                borderLeft: `4px solid ${folder.color}`,
              }}
            >
              <button
                className="collapse-button"
                onClick={() => toggleFolder(folder.id)}
              >
                {folder.collapsed ? '▶' : '▼'}
              </button>

              {editingFolder === folder.id ? (
                <input
                  className="edit-name"
                  autoFocus
                  defaultValue={folder.name}
                  onBlur={(e) => {
                    updateFolder(folder.id, {
                      name: e.target.value || 'Folder',
                    })
                    setEditingFolder(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      updateFolder(folder.id, {
                        name: e.target.value || 'Folder',
                      })
                      setEditingFolder(null)
                    }

                    if (e.key === 'Escape') {
                      setEditingFolder(null)
                    }
                  }}
                />
              ) : (
                <span
                  className="folder-name"
                  onDoubleClick={() =>
                    setEditingFolder(folder.id)
                  }
                >
                  {folder.name}
                </span>
              )}

              <input
                className="color-picker"
                type="color"
                value={folder.color}
                onChange={(e) =>
                  updateFolder(folder.id, {
                    color: e.target.value,
                  })
                }
              />

              <button
                className="folder-action"
                onClick={() =>
                  setEditingFolder(folder.id)
                }
                title="Rename"
              >
                ✎
              </button>

              <button
                className="folder-action danger"
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete folder "${folder.name}"?`
                    )
                  ) {
                    deleteFolder(folder.id)
                  }
                }}
                title="Delete folder"
              >
                ×
              </button>
            </div>

            {/* STREAMS */}

            {!folder.collapsed && (
              <>
                <div className="streams">
                  {folder.streams.map((stream) => {
                    const isPlaying =
                      !!playingStreams[stream.id]

                    return (
                      <div
                        key={stream.id}
                        className={`stream ${
                          isPlaying ? 'playing' : ''
                        }`}
                      >
                        <div
                          className="stream-main"
                          onClick={() =>
                            toggleStream(stream.id)
                          }
                        >
                          <div className="stream-name">
                            {isPlaying ? '▶ ' : '▶︎ '}
                            {stream.name}
                          </div>

                          <div className="stream-meta">
                            {stream.links.length} link
                            {stream.links.length === 1
                              ? ''
                              : 's'}
                          </div>
                        </div>

                        <button
                          className="stream-edit"
                          onClick={() =>
                            setEditingStream(
                              editingStream === stream.id
                                ? null
                                : stream.id
                            )
                          }
                        >
                          ⚙
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* STREAM EDITOR */}

                {folder.streams.map((stream) =>
                  editingStream === stream.id ? (
                    <div
                      key={`editor-${stream.id}`}
                      className="stream-editor"
                    >
                      <div className="editor-title">
                        <strong>Stream Settings</strong>

                        <button
                          className="danger-text"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete "${stream.name}"?`
                              )
                            ) {
                              deleteStream(
                                folder.id,
                                stream.id
                              )
                              setEditingStream(null)
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>

                      {/* NAME */}

                      <label>
                        Name
                        <input
                          value={stream.name}
                          onChange={(e) =>
                            updateStream(
                              folder.id,
                              stream.id,
                              {
                                name: e.target.value,
                              }
                            )
                          }
                        />
                      </label>

                      {/* VOLUME */}

                      <label>
                        Volume
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={stream.volume}
                          onChange={(e) =>
                            updateStream(
                              folder.id,
                              stream.id,
                              {
                                volume: Number(
                                  e.target.value
                                ),
                              }
                            )
                          }
                        />
                      </label>

                      {/* FADE */}

                      <div className="two-columns">
                        <label>
                          Fade In (sec)
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={stream.fadeIn}
                            onChange={(e) =>
                              updateStream(
                                folder.id,
                                stream.id,
                                {
                                  fadeIn: Number(
                                    e.target.value
                                  ),
                                }
                              )
                            }
                          />
                        </label>

                        <label>
                          Fade Out (sec)
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={stream.fadeOut}
                            onChange={(e) =>
                              updateStream(
                                folder.id,
                                stream.id,
                                {
                                  fadeOut: Number(
                                    e.target.value
                                  ),
                                }
                              )
                            }
                          />
                        </label>
                      </div>

                      {/* LINKS */}

                      <div className="links-header">
                        <strong>Sources</strong>

                        <button
                          onClick={() =>
                            addLink(
                              folder.id,
                              stream.id
                            )
                          }
                        >
                          + Link
                        </button>
                      </div>

                      {stream.links.map((link, index) => (
                        <div
                          key={link.id}
                          className="link-editor"
                        >
                          <div className="link-number">
                            #{index + 1}
                          </div>

                          <input
                            className="url-input"
                            placeholder="YouTube URL"
                            value={link.url}
                            onChange={(e) =>
                              updateLink(
                                folder.id,
                                stream.id,
                                link.id,
                                {
                                  url: e.target.value,
                                }
                              )
                            }
                          />

                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={link.loop}
                              onChange={(e) =>
                                updateLink(
                                  folder.id,
                                  stream.id,
                                  link.id,
                                  {
                                    loop: e.target.checked,
                                  }
                                )
                              }
                            />
                            Loop
                          </label>

                          <button
                            className="delete-link"
                            onClick={() =>
                              deleteLink(
                                folder.id,
                                stream.id,
                                link.id
                              )
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null
                )}

                <button
                  className="add-stream"
                  onClick={() => addStream(folder.id)}
                >
                  + Add Stream
                </button>
              </>
            )}
          </div>
        ))}

        {folders.length === 0 && (
          <div className="empty">
            No folders.
            <button onClick={addFolder}>
              Create Folder
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
