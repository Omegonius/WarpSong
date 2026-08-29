import ReactPlayer from 'react-player/youtube'
import useStore from './store'

export default function Player() {
  const {
    folders,
    playingStreams,
    syncedActiveStreams,
    isPaused,
    globalVolume,
    isMuted,
  } = useStore()

  // Спочатку беремо те, що прислав GM (для гравців).
  // Якщо порожньо — будуємо з локальних folders (для GM).
  let activeStreams = syncedActiveStreams || []

  if (!activeStreams.length) {
    const local = []
    folders.forEach((folder) => {
      folder.streams.forEach((stream) => {
        if (playingStreams[stream.id]) {
          local.push(stream)
        }
      })
    })
    activeStreams = local
  }

  const effectiveVolume = isMuted || isPaused ? 0 : globalVolume

  return (
    <div style={{ display: 'none' }}>
      {activeStreams.map((stream) =>
        (stream.links || [])
          .filter((link) => link.url && /youtu/i.test(link.url))
          .map((link) => (
            <ReactPlayer
              key={`${stream.id}-${link.id}`}
              url={link.url}
              playing={!isPaused}
              volume={
                effectiveVolume * (stream.volume ?? 0.7) * (link.volume ?? 1)
              }
              loop={!!link.loop}
              muted={isMuted}
              width={0}
              height={0}
              config={{
                youtube: {
                  playerVars: {
                    autoplay: 1,
                    controls: 0,
                    disablekb: 1,
                    fs: 0,
                    modestbranding: 1,
                    rel: 0,
                  },
                },
              }}
            />
          ))
      )}
    </div>
  )
}
