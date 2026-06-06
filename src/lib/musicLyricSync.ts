import type { MusicLyricLine } from '../data/music';

export function getActiveLyricIndex(lyrics: MusicLyricLine[], currentTime: number) {
  if (!lyrics.length) {
    return -1;
  }

  let activeIndex = -1;
  for (let index = 0; index < lyrics.length; index += 1) {
    if (currentTime >= lyrics[index].time) {
      activeIndex = index;
    } else {
      break;
    }
  }

  return activeIndex;
}

export function getActiveLyricLine(lyrics: MusicLyricLine[], currentTime: number) {
  const activeIndex = getActiveLyricIndex(lyrics, currentTime);
  return activeIndex >= 0 ? lyrics[activeIndex] : null;
}
