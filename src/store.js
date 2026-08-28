import { create } from 'zustand'

const useStore = create((set, get) => ({
  folders: [
    {
      id: 'folder-1',
      name: 'Ambience',
      color: '#4CAF50',
      collapsed: false,
      streams: [
        {
          id: 'stream-1',
          name: 'Forest',
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
  ],

  playingStreams: {},
  isPaused: false,
  isLocalOnly: false,
  globalVolume: 0.8,
  isMuted: false,

  // ---------- FOLDERS ----------
  addFolder: () =>
    set((state) => ({
      folders: [
        ...state.folders,
{
  id: `folder-${Date.now()}`,
  name: 'New Folder',
  color: '#4CAF50',
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
      return {
        folders: state.folders.filter((folder) => folder.id !== folderId),
        playingStreams,
      }
    }),

  toggleFolder: (folderId) =>
    set((state) => ({
      folders: state.folders.map((folder) =>
        folder.id === folderId
          ? { ...folder, collapsed: !folder.collapsed }
          : folder
      ),
    })),

  // ---------- STREAMS ----------
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
    set((state) => ({
      folders: state.folders.map((folder) =>
        folder.id === folderId
          ? {
              ...folder,
              streams: folder.streams.map((stream) =>
                stream.id === streamId ? { ...stream, ...changes } : stream
              ),
            }
          : folder
      ),
    })),

  deleteStream: (folderId, streamId) =>
    set((state) => {
      const playingStreams = { ...state.playingStreams }
      delete playingStreams[streamId]
      return {
        folders: state.folders.map((folder) =>
          folder.id === folderId
            ? {
                ...folder,
                streams: folder.streams.filter(
                  (stream) => stream.id !== streamId
                ),
              }
            : folder
        ),
        playingStreams,
      }
    }),

  // ---------- LINKS ----------
  addLink: (folderId, streamId) =>
    set((state) => ({
      folders: state.folders.map((folder) =>
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
      ),
    })),

  updateLink: (folderId, streamId, linkId, changes) =>
    set((state) => ({
      folders: state.folders.map((folder) =>
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
      ),
    })),

  deleteLink: (folderId, streamId, linkId) =>
    set((state) => ({
      folders: state.folders.map((folder) =>
        folder.id === folderId
          ? {
              ...folder,
              streams: folder.streams.map((stream) =>
                stream.id === streamId
                  ? {
                      ...stream,
                      links: stream.links.filter((link) => link.id !== linkId),
                    }
                  : stream
              ),
            }
          : folder
      ),
    })),

  // ---------- PLAYBACK STATE ----------
  toggleStream: (streamId) =>
    set((state) => ({
      playingStreams: {
        ...state.playingStreams,
        [streamId]: !state.playingStreams[streamId],
      },
      isPaused: false,
    })),

  stopAll: () =>
    set({
      playingStreams: {},
      isPaused: false,
    }),

  setPaused: (value) => set({ isPaused: value }),
  setLocalOnly: (value) => set({ isLocalOnly: value }),
  setGlobalVolume: (value) => set({ globalVolume: value }),
  setMuted: (value) => set({ isMuted: value }),

  // ---------- SYNC FROM METADATA ----------
  applyRemoteState: (data) => {
    if (!data) return
    set({
      playingStreams: data.playingStreams || {},
      isPaused: !!data.isPaused,
      isLocalOnly: !!data.isLocalOnly,
      // folders поки не синхронізуємо (занадто великий об'єм)
    })
  },
  // ---------- SAVE / LOAD ----------
  exportData: () => {
    const state = get()
    return {
      version: 1,
      folders: state.folders,
    }
  },

  importData: (data) => {
    if (!data || !data.folders) return
    set({
      folders: data.folders,
      playingStreams: {},
      isPaused: false,
    })
  },
}))

export default useStore