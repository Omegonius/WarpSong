import { create } from 'zustand'
import { clamp01, mapPlaybackLinks } from './playback.js'

const defaultFolders = () => [
  {
    id: 'folder-weather',
    name: 'Weather',
    color: '#4A90D9',
    emoji: '🌧️',
    collapsed: false,
    streams: [
      {
        id: 'stream-rain',
        name: 'Rain',
        emoji: '🌧️',
        color: '#4A90D9',
        volume: 0.7,
        fadeOut: 3,
        fadeIn: 0,
        muted: false,
        links: [
          {
            id: 'link-rain',
            url: 'https://www.youtube.com/watch?v=q76bMs-NwRk',
            volume: 1,
            loop: true,
            delay: 0,
          },
        ],
      },
      {
        id: 'stream-thunder',
        name: 'Thunder',
        emoji: '⚡',
        color: '#7B8CDE',
        volume: 0.65,
        fadeOut: 3,
        fadeIn: 1.5,
        muted: false,
        links: [
          {
            id: 'link-thunder',
            url: 'https://www.youtube.com/watch?v=xK_m77VZYnc',
            volume: 1,
            loop: true,
            delay: 0,
          },
        ],
      },
      {
        id: 'stream-wind-cave',
        name: 'Wind in Cave',
        emoji: '🕳️',
        color: '#6B7B8A',
        volume: 0.65,
        fadeOut: 3,
        fadeIn: 0,
        muted: false,
        links: [
          {
            id: 'link-wind-cave',
            url: 'https://www.youtube.com/watch?v=Xi4DZOhHkI4',
            volume: 1,
            loop: true,
            delay: 0,
          },
        ],
      },
      {
        id: 'stream-wind',
        name: 'Wind',
        emoji: '💨',
        color: '#8EBBD9',
        volume: 0.65,
        fadeOut: 3,
        fadeIn: 0,
        muted: false,
        links: [
          {
            id: 'link-wind',
            url: 'https://www.youtube.com/watch?v=sT5f1jBJHng',
            volume: 1,
            loop: true,
            delay: 0,
          },
        ],
      },
    ],
  },
  {
    id: 'folder-ambient',
    name: 'Ambient',
    color: '#4CAF50',
    emoji: '🌿',
    collapsed: false,
    streams: [
      {
        id: 'stream-forest',
        name: 'Forest',
        emoji: '🌲',
        color: '#5C7CFF',
        volume: 0.7,
        fadeOut: 3,
        fadeIn: 0,
        muted: false,
        links: [
          {
            id: 'link-forest',
            url: 'https://www.youtube.com/watch?v=xNN7iTA57jM',
            volume: 1,
            loop: true,
            delay: 0,
          },
        ],
      },
      {
        id: 'stream-river',
        name: 'River',
        emoji: '🏞️',
        color: '#3D9B8F',
        volume: 0.7,
        fadeOut: 3,
        fadeIn: 0,
        muted: false,
        links: [
          {
            id: 'link-river',
            url: 'https://www.youtube.com/watch?v=nE_XAauwu1I',
            volume: 1,
            loop: true,
            delay: 0,
          },
        ],
      },
      {
        id: 'stream-ocean',
        name: 'Ocean',
        emoji: '🌊',
        color: '#2E6B9E',
        volume: 0.7,
        fadeOut: 3,
        fadeIn: 0,
        muted: false,
        links: [
          {
            id: 'link-ocean',
            url: 'https://www.youtube.com/watch?v=bn9F19Hi1Lk',
            volume: 1,
            loop: true,
            delay: 0,
          },
        ],
      },
      {
        id: 'stream-city',
        name: 'City',
        emoji: '🏙️',
        color: '#8B7355',
        volume: 0.65,
        fadeOut: 3,
        fadeIn: 0,
        muted: false,
        links: [
          {
            id: 'link-city',
            url: 'https://www.youtube.com/watch?v=_52K0E_gNY0',
            volume: 1,
            loop: true,
            delay: 0,
          },
        ],
      },
      {
        id: 'stream-campfire',
        name: 'Campfire',
        emoji: '🔥',
        color: '#E07A3D',
        volume: 0.7,
        fadeOut: 3,
        fadeIn: 0,
        muted: false,
        links: [
          {
            id: 'link-campfire',
            url: 'https://www.youtube.com/watch?v=ghvLSUXD5pU',
            volume: 1,
            loop: true,
            delay: 0,
          },
        ],
      },
    ],
  },
  {
    id: 'folder-battle',
    name: 'Battle',
    color: '#C44B4B',
    emoji: '⚔️',
    collapsed: false,
    streams: [
      {
        id: 'stream-battle-ambient',
        name: 'Battle Ambient',
        emoji: '⚔️',
        color: '#C44B4B',
        volume: 0.7,
        fadeOut: 4,
        fadeIn: 0.5,
        muted: false,
        links: [
          {
            id: 'link-battle',
            url: 'https://www.youtube.com/watch?v=nJTyTFi9Tho',
            volume: 1,
            loop: true,
            delay: 0,
          },
        ],
      },
    ],
  },
]

function sanitizeFolders(folders) {
  if (!Array.isArray(folders)) return null
  return folders.map((folder, fi) => ({
    id: folder.id || `folder-${fi}-${Date.now()}`,
    name: String(folder.name ?? 'Folder'),
    color: folder.color || '#7B5CFF',
    emoji: folder.emoji || '📁',
    collapsed: !!folder.collapsed,
    streams: Array.isArray(folder.streams)
      ? folder.streams.map((stream, si) => ({
          id: stream.id || `stream-${si}-${Date.now()}`,
          name: String(stream.name ?? 'Stream'),
          emoji: stream.emoji || '🎵',
          color: stream.color || '#5C7CFF',
          volume: clamp01(stream.volume ?? 0.7),
          fadeIn: Math.max(0, Number(stream.fadeIn) || 0),
          fadeOut: Math.max(0, Number(stream.fadeOut) || 0),
          muted: !!stream.muted,
          links: Array.isArray(stream.links)
            ? stream.links.map((link, li) => ({
                id: link.id || `link-${li}-${Date.now()}`,
                url: String(link.url ?? ''),
                volume: clamp01(link.volume ?? 1),
                loop: link.loop !== false,
                delay: Math.max(0, Number(link.delay) || 0),
              }))
            : [],
        }))
      : [],
  }))
}

function streamToPlaybackEntry(stream, prev) {
  const fadeIn = Math.max(0, Number(stream.fadeIn) || 0)
  const fadeOut = Math.max(0, Number(stream.fadeOut) || 0)
  return {
    id: stream.id,
    name: stream.name,
    emoji: stream.emoji || '🎵',
    volume: stream.volume ?? 0.7,
    muted: !!stream.muted,
    fadeIn,
    fadeOut,
    fadeFactor: fadeIn > 0 ? 0 : 1,
    fadingIn: fadeIn > 0,
    fadingOut: false,
    startedAt: prev?.startedAt || Date.now(),
    links: mapPlaybackLinks(stream.links),
  }
}

/** Snapshot for Owlbear metadata (no fadeFactor ticks) */
export function toRoomStreaming(list) {
  return (list || []).map((s) => ({
    id: s.id,
    name: s.name,
    emoji: s.emoji,
    volume: s.volume,
    muted: !!s.muted,
    fadeIn: s.fadeIn,
    fadeOut: s.fadeOut,
    fadingIn: !!s.fadingIn,
    fadingOut: !!s.fadingOut,
    startedAt: s.startedAt || null,
    links: mapPlaybackLinks(s.links),
  }))
}

function findStream(folders, streamId) {
  for (const folder of folders) {
    const stream = (folder.streams || []).find((s) => s.id === streamId)
    if (stream) return stream
  }
  return null
}

function rebuildFromFolders(folders, playingStreams, prevList = []) {
  const prevById = {}
  prevList.forEach((e) => {
    prevById[e.id] = e
  })
  const list = []
  folders.forEach((folder) => {
    ;(folder.streams || []).forEach((stream) => {
      if (!playingStreams[stream.id]) return
      const prev = prevById[stream.id]
      if (prev && (prev.fadingOut || prev.fadingIn)) {
        list.push({
          ...prev,
          name: stream.name,
          emoji: stream.emoji || prev.emoji,
          volume: stream.volume ?? prev.volume,
          muted: !!stream.muted,
          fadeIn: Math.max(0, Number(stream.fadeIn) || 0),
          fadeOut: Math.max(0, Number(stream.fadeOut) || 0),
          startedAt: prev.startedAt,
          links: mapPlaybackLinks(stream.links),
        })
      } else {
        const entry = streamToPlaybackEntry(stream, prev)
        if (prev && !prev.fadingOut) {
          entry.fadeFactor = prev.fadeFactor ?? 1
          entry.fadingIn = false
          entry.startedAt = prev.startedAt || entry.startedAt
        }
        list.push(entry)
      }
    })
  })
  prevList.forEach((e) => {
    if (e.fadingOut && !list.some((x) => x.id === e.id)) {
      list.push(e)
    }
  })
  return list
}

function mergeRemotePlayback(remoteList, localList) {
  const localById = {}
  localList.forEach((e) => {
    localById[e.id] = e
  })

  const merged = []
  const playingStreams = {}

  remoteList.forEach((remote) => {
    if (!remote || !remote.id) return
    const local = localById[remote.id]
    const fadingOut = !!remote.fadingOut
    const fadingIn = !!remote.fadingIn

    let fadeFactor = 1
    if (local) {
      if (fadingOut && local.fadingOut) {
        fadeFactor = local.fadeFactor ?? 1
      } else if (fadingOut && !local.fadingOut) {
        fadeFactor = local.fadeFactor ?? 1
      } else if (fadingIn && local.fadingIn) {
        fadeFactor = local.fadeFactor ?? 0
      } else if (fadingIn && !local.fadingIn) {
        fadeFactor = 0
      } else {
        fadeFactor = 1
      }
    } else if (fadingIn) {
      fadeFactor = 0
    } else if (fadingOut) {
      fadeFactor = 1
    }

    merged.push({
      id: remote.id,
      name: remote.name,
      emoji: remote.emoji || '🎵',
      volume: remote.volume ?? 0.7,
      muted: !!remote.muted,
      fadeIn: Math.max(0, Number(remote.fadeIn) || 0),
      fadeOut: Math.max(0, Number(remote.fadeOut) || 0),
      fadingIn,
      fadingOut,
      fadeFactor,
      startedAt: remote.startedAt || local?.startedAt || Date.now(),
      links: mapPlaybackLinks(remote.links),
    })
    playingStreams[remote.id] = true
  })

  localList.forEach((local) => {
    if (local.fadingOut && !playingStreams[local.id]) {
      merged.push(local)
      playingStreams[local.id] = true
    }
  })

  return { merged, playingStreams }
}

const useStore = create((set, get) => ({
  folders: defaultFolders(),
  /** Local playback (GM hears live volume while editing) */
  currentlyStreaming: [],
  /**
   * Committed snapshot for room metadata.
   * Stream/link volume updates only land here on commitRoomStreaming (Back)
   * or on play/stop/structure changes.
   */
  roomStreaming: [],
  playingStreams: {},
  isPaused: false,
  isLocalOnly: false,
  gmMuted: false,
  localMuted: false,
  globalVolume: 0.8,
  /** GM master from metadata (players multiply; GM ignores) */
  roomGlobalVolume: 1,
  audioUnlocked: false,
  playbackErrors: {},

  unlockAudio: () => set({ audioUnlocked: true }),

  /** Commit current playback volumes/flags to room (call on Back from stream settings) */
  commitRoomStreaming: () =>
    set((state) => ({
      roomStreaming: toRoomStreaming(state.currentlyStreaming),
    })),

  addFolder: () =>
    set((state) => ({
      folders: [
        ...state.folders,
        {
          id: `folder-${Date.now()}`,
          name: 'New Folder',
          color: '#7B5CFF',
          emoji: '📁',
          collapsed: false,
          streams: [],
        },
      ],
    })),

  updateFolder: (folderId, changes) =>
    set((state) => ({
      folders: state.folders.map((folder) =>
        folder.id === folderId ? { ...folder, ...changes } : folder
      ),
    })),

  deleteFolder: (folderId) =>
    set((state) => {
      const folder = state.folders.find((f) => f.id === folderId)
      const playingStreams = { ...state.playingStreams }
      folder?.streams.forEach((stream) => {
        delete playingStreams[stream.id]
      })
      const folders = state.folders.filter((f) => f.id !== folderId)
      const currentlyStreaming = state.currentlyStreaming.filter(
        (e) => !folder?.streams.some((s) => s.id === e.id)
      )
      return {
        folders,
        playingStreams,
        currentlyStreaming,
        roomStreaming: toRoomStreaming(currentlyStreaming),
      }
    }),

  addStream: (folderId) =>
    set((state) => ({
      folders: state.folders.map((folder) =>
        folder.id === folderId
          ? {
              ...folder,
              streams: [
                ...folder.streams,
                {
                  id: `stream-${Date.now()}`,
                  name: 'New Stream',
                  emoji: '🎵',
                  color: '#5C7CFF',
                  volume: 0.7,
                  fadeOut: 3,
                  fadeIn: 0,
                  muted: false,
                  links: [],
                },
              ],
            }
          : folder
      ),
    })),

  /**
   * Edit stream fields. Updates folders + local currentlyStreaming (GM hears).
   * Does NOT update roomStreaming — call commitRoomStreaming on panel close.
   */
  updateStream: (folderId, streamId, changes) =>
    set((state) => {
      const folders = state.folders.map((folder) =>
        folder.id === folderId
          ? {
              ...folder,
              streams: folder.streams.map((stream) =>
                stream.id === streamId ? { ...stream, ...changes } : stream
              ),
            }
          : folder
      )
      const currentlyStreaming =
        state.playingStreams[streamId] ||
        state.currentlyStreaming.some((e) => e.id === streamId)
          ? rebuildFromFolders(
              folders,
              state.playingStreams,
              state.currentlyStreaming
            )
          : state.currentlyStreaming
      return { folders, currentlyStreaming }
    }),

  deleteStream: (folderId, streamId) =>
    set((state) => {
      const playingStreams = { ...state.playingStreams }
      delete playingStreams[streamId]
      const folders = state.folders.map((folder) =>
        folder.id === folderId
          ? {
              ...folder,
              streams: folder.streams.filter((s) => s.id !== streamId),
            }
          : folder
      )
      const currentlyStreaming = state.currentlyStreaming.filter(
        (e) => e.id !== streamId
      )
      return {
        folders,
        playingStreams,
        currentlyStreaming,
        roomStreaming: toRoomStreaming(currentlyStreaming),
      }
    }),

  addLink: (folderId, streamId) =>
    set((state) => {
      const folders = state.folders.map((folder) =>
        folder.id === folderId
          ? {
              ...folder,
              streams: folder.streams.map((stream) =>
                stream.id === streamId
                  ? {
                      ...stream,
                      links: [
                        ...stream.links,
                        {
                          id: `link-${Date.now()}`,
                          url: '',
                          volume: 1,
                          loop: true,
                          delay: 0,
                        },
                      ],
                    }
                  : stream
              ),
            }
          : folder
      )
      const currentlyStreaming = state.playingStreams[streamId]
        ? rebuildFromFolders(
            folders,
            state.playingStreams,
            state.currentlyStreaming
          )
        : state.currentlyStreaming
      return { folders, currentlyStreaming }
    }),

  updateLink: (folderId, streamId, linkId, changes) =>
    set((state) => {
      const folders = state.folders.map((folder) =>
        folder.id === folderId
          ? {
              ...folder,
              streams: folder.streams.map((stream) =>
                stream.id === streamId
                  ? {
                      ...stream,
                      links: stream.links.map((link) =>
                        link.id === linkId ? { ...link, ...changes } : link
                      ),
                    }
                  : stream
              ),
            }
          : folder
      )
      const currentlyStreaming = state.playingStreams[streamId]
        ? rebuildFromFolders(
            folders,
            state.playingStreams,
            state.currentlyStreaming
          )
        : state.currentlyStreaming
      return { folders, currentlyStreaming }
    }),

  deleteLink: (folderId, streamId, linkId) =>
    set((state) => {
      const folders = state.folders.map((folder) =>
        folder.id === folderId
          ? {
              ...folder,
              streams: folder.streams.map((stream) =>
                stream.id === streamId
                  ? {
                      ...stream,
                      links: stream.links.filter((l) => l.id !== linkId),
                    }
                  : stream
              ),
            }
          : folder
      )
      const currentlyStreaming = state.playingStreams[streamId]
        ? rebuildFromFolders(
            folders,
            state.playingStreams,
            state.currentlyStreaming
          )
        : state.currentlyStreaming
      return { folders, currentlyStreaming }
    }),

  toggleStream: (streamId) =>
    set((state) => {
      const playingStreams = { ...state.playingStreams }
      const stream = findStream(state.folders, streamId)
      if (!stream) return state

      const isOn = !!playingStreams[streamId]
      const isFadingOut = state.currentlyStreaming.some(
        (e) => e.id === streamId && e.fadingOut
      )

      if (isOn || isFadingOut) {
        const fadeOut = Math.max(0, Number(stream.fadeOut) || 0)
        if (fadeOut > 0 && isOn && !isFadingOut) {
          const currentlyStreaming = state.currentlyStreaming.map((e) =>
            e.id === streamId
              ? {
                  ...e,
                  fadingOut: true,
                  fadingIn: false,
                  fadeOut,
                }
              : e
          )
          return {
            currentlyStreaming,
            roomStreaming: toRoomStreaming(currentlyStreaming),
            isPaused: false,
            audioUnlocked: true,
          }
        }
        delete playingStreams[streamId]
        const currentlyStreaming = state.currentlyStreaming.filter(
          (e) => e.id !== streamId
        )
        return {
          playingStreams,
          isPaused: false,
          audioUnlocked: true,
          currentlyStreaming,
          roomStreaming: toRoomStreaming(currentlyStreaming),
        }
      }

      playingStreams[streamId] = true
      const prev = state.currentlyStreaming.find((e) => e.id === streamId)
      const entry = streamToPlaybackEntry(stream, null)
      if (prev && prev.fadingOut) {
        entry.startedAt = Date.now()
      }
      const without = state.currentlyStreaming.filter((e) => e.id !== streamId)
      const currentlyStreaming = [...without, entry]
      return {
        playingStreams,
        isPaused: false,
        audioUnlocked: true,
        currentlyStreaming,
        roomStreaming: toRoomStreaming(currentlyStreaming),
      }
    }),

  stopAll: () =>
    set((state) => {
      const currentlyStreaming = state.currentlyStreaming.map((e) => {
        const stream = findStream(state.folders, e.id)
        const fadeOut = Math.max(0, Number(stream?.fadeOut ?? e.fadeOut) || 0)
        if (fadeOut > 0 && !e.fadingOut) {
          return { ...e, fadingOut: true, fadingIn: false, fadeOut }
        }
        return e
      })
      const hard = currentlyStreaming.filter((e) => !e.fadingOut)
      if (hard.length === currentlyStreaming.length) {
        return {
          playingStreams: {},
          currentlyStreaming: [],
          roomStreaming: [],
          isPaused: false,
          audioUnlocked: true,
        }
      }
      const fading = currentlyStreaming.filter((e) => e.fadingOut)
      const playingStreams = {}
      fading.forEach((e) => {
        playingStreams[e.id] = true
      })
      return {
        playingStreams,
        currentlyStreaming: fading,
        roomStreaming: toRoomStreaming(fading),
        isPaused: false,
        audioUnlocked: true,
      }
    }),

  tickFades: (dtSec) =>
    set((state) => {
      if (!state.currentlyStreaming.length) return state
      let changed = false
      let structureChanged = false
      const playingStreams = { ...state.playingStreams }
      const next = []

      state.currentlyStreaming.forEach((entry) => {
        if (entry.fadingOut) {
          changed = true
          const dur = Math.max(0.05, Number(entry.fadeOut) || 0.05)
          const factor = Math.max(0, (entry.fadeFactor ?? 1) - dtSec / dur)
          if (factor <= 0.001) {
            delete playingStreams[entry.id]
            structureChanged = true
            return
          }
          next.push({ ...entry, fadeFactor: factor, fadingIn: false })
          return
        }
        if (entry.fadingIn) {
          changed = true
          const dur = Math.max(0.05, Number(entry.fadeIn) || 0.05)
          const factor = Math.min(1, (entry.fadeFactor ?? 0) + dtSec / dur)
          if (factor >= 0.999) {
            next.push({
              ...entry,
              fadeFactor: 1,
              fadingIn: false,
            })
          } else {
            next.push({ ...entry, fadeFactor: factor })
          }
          return
        }
        next.push(entry)
      })

      if (!changed) return state
      const patch = { currentlyStreaming: next, playingStreams }
      if (structureChanged) {
        patch.roomStreaming = toRoomStreaming(next)
      }
      return patch
    }),

  setPaused: (value) => set({ isPaused: !!value }),
  setLocalOnly: (value) => set({ isLocalOnly: !!value }),
  setGmMuted: (value) => set({ gmMuted: !!value }),
  setLocalMuted: (value) => set({ localMuted: !!value }),
  setGlobalVolume: (value) => set({ globalVolume: clamp01(value) }),

  setPlaybackError: (key, message) =>
    set((state) => {
      if (state.playbackErrors[key] === message) return state
      return { playbackErrors: { ...state.playbackErrors, [key]: message } }
    }),

  clearPlaybackError: (key) =>
    set((state) => {
      if (!state.playbackErrors[key]) return state
      const playbackErrors = { ...state.playbackErrors }
      delete playbackErrors[key]
      return { playbackErrors }
    }),

  clearAllPlaybackErrors: () => set({ playbackErrors: {} }),

  /**
   * Apply room metadata.
   * Players: playback + GM pause/mute + room master volume.
   * Never overwrites localMuted or the player's local globalVolume.
   * opts.hydrateMaster (GM F5): also restore GM mixer + roomStreaming snapshot.
   */
  applyRemoteState: (data, opts = {}) => {
    if (!data) return
    const remoteList = Array.isArray(data.currentlyStreaming)
      ? data.currentlyStreaming
      : Array.isArray(data.roomStreaming)
        ? data.roomStreaming
        : []
    const state = get()
    const { merged, playingStreams } = mergeRemotePlayback(
      remoteList,
      state.currentlyStreaming
    )

    const patch = {
      currentlyStreaming: merged,
      playingStreams,
      isPaused: !!data.isPaused,
      gmMuted: !!data.gmMuted,
    }

    if (opts.hydrateMaster) {
      if (typeof data.globalVolume === 'number') {
        patch.globalVolume = clamp01(data.globalVolume)
      }
      patch.roomGlobalVolume = 1
      patch.roomStreaming = toRoomStreaming(merged)
    } else if (typeof data.globalVolume === 'number') {
      patch.roomGlobalVolume = clamp01(data.globalVolume)
    }

    set(patch)
  },

  exportData: () => {
    const state = get()
    return {
      version: 1,
      app: 'warpsong',
      folders: state.folders,
    }
  },

  importData: (data) => {
    if (!data || !data.folders) {
      return { ok: false, error: 'Invalid file: missing folders' }
    }
    const folders = sanitizeFolders(data.folders)
    if (!folders) {
      return { ok: false, error: 'Invalid file: bad folders format' }
    }
    set({
      folders,
      playingStreams: {},
      currentlyStreaming: [],
      roomStreaming: [],
      isPaused: false,
      gmMuted: false,
      isLocalOnly: false,
      playbackErrors: {},
    })
    return { ok: true }
  },
}))

export default useStore
