import { create } from 'zustand'

const useStore = create((set, get) => ({
  // Папки
  folders: [
    {
      id: 'folder-1',
      name: 'Ambience',
      color: '#4CAF50',
      streams: [
        {
          id: 'stream-1',
          name: 'Forest',
          volume: 0.7,
          fadeOut: 3,
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

  // Що зараз грає
  playingStreams: {}, // { streamId: true/false }
  isPaused: false,
  isLocalOnly: false, // true = тільки собі, false = всім
  globalVolume: 0.8,
  isMuted: false,

  // Дії
  setFolders: (folders) => set({ folders }),
  
  toggleStream: (streamId) => {
    const { playingStreams } = get()
    const isPlaying = !!playingStreams[streamId]
    set({
      playingStreams: {
        ...playingStreams,
        [streamId]: !isPlaying,
      },
      isPaused: false,
    })
  },

  setPaused: (value) => set({ isPaused: value }),
  setLocalOnly: (value) => set({ isLocalOnly: value }),
  setGlobalVolume: (value) => set({ globalVolume: value }),
  setMuted: (value) => set({ isMuted: value }),
}))

export default useStore
