import ReactPlayer from 'react-player/youtube'
import { isYouTubeUrl } from './playback.js'

/** True when react-player can really load this link as a YouTube video */
export function canPlayUrl(url) {
  if (!isYouTubeUrl(url)) return false
  return typeof ReactPlayer.canPlay === 'function' ? ReactPlayer.canPlay(url) : true
}
