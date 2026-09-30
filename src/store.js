import { create } from 'zustand'

const defaultFolders = () => [
  {
    id: 'folder-1',
    name: 'Ambience',
    color: '#7B5CFF',
    emoji: '🌲',
    collapsed: false,
    streams: [
      {
        id: 'stream-1',
        name: 'Forest',
        emoji: '🌲',
        color: '#5C7CFF',
        volume: 0.7,
        fadeOut: 3,
        fadeIn: 0,
        links: [
          {
            id: 'link-1',
            url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            volume: 1,
            loop: true,
            delay: 0,
          },
        ],
      },
    ],
  },
]

function clamp01(n) {
  const x = Number(n)
  if (Number.isNaN(x)) return 0
  return Math.max(0, Math.min(1, x))
}

function sanitizeFolders(folders) {
  if (!Array.isArray(folders)) return null
  return folders.map((folder, fi) => ({
    id: folder.id || `folder-\( {fi}- \){Date.now()}`,
    name: String(folder.name ?? 'Folder'),
    color: folder.color || '#7B5CFF',
    emoji: folder.emoji || '📁',
    collapsed: !!folder.collapsed,
    streams: Array.isArray(folder.streams)
      ? folder.streams.map((stream, si) => ({
          id: stream.id || `stream-\( {si}- \){Date.now()}`,
          name: String(stream.name ?? 'Stream'),
          emoji: stream.emoji || '🎵',
          color: stream.color || '#5C7CFF',
          volume: clamp01(stream.volume ?? 0.7),
          fadeIn: Math.max(0, Number(stream.fadeIn) || 0),
          fadeOut: Math.max(0, Number(stream.fadeOut) || 0),
          links: Array.isArray(stream.links)
            ? stream.links.map((link, li) => ({
                id: link.id || `link-\( {li}- \){Date.now()}`,
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

function streamToPlaybackEntry(stream) {
  return {
    id: stream.id,
    name: stream.name,
    emoji: stream.emoji || '🎵',
    volume: stream.volume ?? 0.7,
    links: (stream.links || [])
      .filter((l) => l.url)
      .map((l) => ({
        id: l.id,
        url: l.url,
        volume: l.volume ?? 1,
        loop: l.loop !== false,
      })),
  }
}

function findStream(folders, streamId) {
  for (const folder of folders) {
    const stream = folder.streams.find((s) => s.id === streamId)
    if (stream) return stream
  }
  return null
}

function rebuildCurrentlyStreaming(folders, playingStreams) {
  const list = []
  folders.forEach((folder) => {
    folder.streams.forEach((stream) => {
      if (playingStreams[stream.id]) {
        list.push(streamToPlaybackEntry(stream))
      }
    })
  })
  return list
}

const useStore = create((set, get) => ({
  folders: defaultFolders(),
  currentlyStreaming: [],
  playingStreams: {},
  isPaused: false,
  isLocalOnly: false,
  gmMuted: false,
  localMuted: false,
  globalVolume: 0.8,
  playbackErrors: {},

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
      return {
        folders,
        playingStreams,
        currentlyStreaming: rebuildCurrentlyStreaming(folders, playingStreams),
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
                  links: [],
                },
              ],
            }
          : folder
      ),
    })),

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
      const currentlyStreaming = state.playingStreams[streamId]
        ? rebuildCurrentlyStreaming(folders, state.playingStreams)
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
      return {
        folders,
        playingStreams,
        currentlyStreaming: rebuildCurrentlyStreaming(folders, playingStreams),
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
        ? rebuildCurrentlyStreaming(folders, state.playingStreams)
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
        ? rebuildCurrentlyStreaming(folders, state.playingStreams)
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
        ? rebuildCurrentlyStreaming(folders, state.playingStreams)
        : state.currentlyStreaming
      return { folders, currentlyStreaming }
    }),

  toggleStream: (streamId) =>
    set((state) => {
      const playingStreams = { ...state.playingStreams }
      if (playingStreams[streamId]) {
        delete playingStreams[streamId]
      } else {
        const stream = findStream(state.folders, streamId)
        if (!stream) return state
        playingStreams[streamId] = true
      }
      return {
        playingStreams,
        isPaused: false,
        currentlyStreaming: rebuildCurrentlyStreaming(
          state.folders,
          playingStreams
        ),
      }
    }),

  stopAll: () =>
    set({
      playingStreams: {},
      currentlyStreaming: [],
      isPaused: false,
    }),

  setPaused: (value) => set({ isPaused: !!value }),
  setLocalOnly: (value) => set({ isLocalOnly: !!value }),
  setGmMuted: (value) => set({ gmMuted: !!value }),
  setLocalMuted: (value) => set({ localMuted: !!value }),
  setGlobalVolume: (value) => set({ globalVolume: clamp01(value) }),

  setPlaybackError: (key, message) =>
    set((state) => ({
      playbackErrors: { ...state.playbackErrors, [key]: message },
    })),

  clearPlaybackError: (key) =>
    set((state) => {
      if (!state.playbackErrors[key]) return state
      const playbackErrors = { ...state.playbackErrors }
      delete playbackErrors[key]
      return { playbackErrors }
    }),

  clearAllPlaybackErrors: () => set({ playbackErrors: {} }),

  applyRemoteState: (data) => {
    if (!data) return
    const list = Array.isArray(data.currentlyStreaming)
      ? data.currentlyStreaming
      : []
    const playingStreams = {}
    list.forEach((s) => {
      if (s && s.id) playingStreams[s.id] = true
    })
    set({
      currentlyStreaming: list,
      playingStreams,
      isPaused: !!data.isPaused,
      gmMuted: !!data.gmMuted,
    })
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
      isPaused: false,
      gmMuted: false,
      playbackErrors: {},
    })
    return { ok: true }
  },
}))

export default useStore
