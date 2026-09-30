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
        muted: false,
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
          muted: !!stream.muted,
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

function rebuildFromFolders(folders, playingStreams, prevList = []) {
  const prevById = {}
  prevList.forEach((e) => {
    prevById[e.id] = e
  })
  const list = []
  folders.forEach((folder) => {
    folder.streams.forEach((stream) => {
      if (!playingStreams[stream.id]) return
      const prev = prevById[stream.id]
      // keep fade state if still playing / fading
      if (prev && (prev.fadingOut || prev.fadingIn)) {
        list.push({
          ...prev,
          name: stream.name,
          emoji: stream.emoji || prev.emoji,
          volume: stream.volume ?? prev.volume,
          muted: !!stream.muted,
          fadeIn: Math.max(0, Number(stream.fadeIn) || 0),
          fadeOut: Math.max(0, Number(stream.fadeOut) || 0),
          links: (stream.links || [])
            .filter((l) => l.url)
            .map((l) => ({
              id: l.id,
              url: l.url,
              volume: l.volume ?? 1,
              loop: l.loop !== false,
            })),
        })
      } else {
        const entry = streamToPlaybackEntry(stream)
        // if already was playing without fade, keep full volume
        if (prev && !prev.fadingOut) {
          entry.fadeFactor = prev.fadeFactor ?? 1
          entry.fadingIn = false
        }
        list.push(entry)
      }
    })
  })
  // keep pure fade-outs even if removed from playingStreams flag
  prevList.forEach((e) => {
    if (e.fadingOut && !list.some((x) => x.id === e.id)) {
      list.push(e)
    }
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
  audioUnlocked: false,
  playbackErrors: {},

  unlockAudio: () => set({ audioUnlocked: true }),

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
        currentlyStreaming: rebuildFromFolders(
          folders,
          playingStreams,
          state.currentlyStreaming
        ).filter((e) => !folder?.streams.some((s) => s.id === e.id)),
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
          ? rebuildFromFolders(folders, state.playingStreams, state.currentlyStreaming)
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
        currentlyStreaming: state.currentlyStreaming.filter(
          (e) => e.id !== streamId
        ),
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
        ? rebuildFromFolders(folders, state.playingStreams, state.currentlyStreaming)
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
        ? rebuildFromFolders(folders, state.playingStreams, state.currentlyStreaming)
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
        ? rebuildFromFolders(folders, state.playingStreams, state.currentlyStreaming)
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

      // stop / interrupt fade-out → start again
      if (isOn || isFadingOut) {
        const fadeOut = Math.max(0, Number(stream.fadeOut) || 0)
        if (fadeOut > 0 && isOn && !isFadingOut) {
          // begin fade out, keep in list
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
          // still "playing" in UI until fade ends
          return { currentlyStreaming, isPaused: false }
        }
        // hard stop
        delete playingStreams[streamId]
        return {
          playingStreams,
          isPaused: false,
          currentlyStreaming: state.currentlyStreaming.filter(
            (e) => e.id !== streamId
          ),
        }
      }

      // start
      playingStreams[streamId] = true
      const entry = streamToPlaybackEntry(stream)
      const without = state.currentlyStreaming.filter((e) => e.id !== streamId)
      return {
        playingStreams,
        isPaused: false,
        currentlyStreaming: [...without, entry],
      }
    }),

  stopAll: () =>
    set((state) => {
      // fade out all that have fadeOut > 0
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
          isPaused: false,
        }
      }
      // remove hard-stop ones, keep fading
      const fading = currentlyStreaming.filter((e) => e.fadingOut)
      const playingStreams = {}
      fading.forEach((e) => {
        playingStreams[e.id] = true
      })
      return {
        playingStreams,
        currentlyStreaming: fading,
        isPaused: false,
      }
    }),

  /** Called every \~100ms by FadeEngine */
  tickFades: (dtSec) =>
    set((state) => {
      if (!state.currentlyStreaming.length) return state
      let changed = false
      const playingStreams = { ...state.playingStreams }
      const next = []

      state.currentlyStreaming.forEach((entry) => {
        if (entry.fadingOut) {
          changed = true
          const dur = Math.max(0.05, Number(entry.fadeOut) || 0.05)
          const factor = Math.max(0, (entry.fadeFactor ?? 1) - dtSec / dur)
          if (factor <= 0.001) {
            delete playingStreams[entry.id]
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
      return { currentlyStreaming: next, playingStreams }
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
