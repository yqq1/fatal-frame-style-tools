import { createContext, useContext, type ReactNode } from 'react';
import { useMusicPlayer } from './MusicPlayerContext';
import useLyricPictureInPicture from '../hooks/useLyricPictureInPicture';
import useRuntimeMusicLyrics from '../hooks/useRuntimeMusicLyrics';
import { getActiveLyricLine } from '../lib/musicLyricSync';

type LyricPictureInPictureContextValue = {
  isAvailable: boolean;
  isOpen: boolean;
  toggle: () => void;
  unavailableReason: string;
};

const LyricPictureInPictureContext = createContext<LyricPictureInPictureContextValue | null>(null);

export function LyricPictureInPictureProvider({ children }: { children: ReactNode }) {
  const runtimeLyrics = useRuntimeMusicLyrics();
  const { currentTime, selectedTrack } = useMusicPlayer();
  const lyrics = selectedTrack ? runtimeLyrics[selectedTrack.id] ?? selectedTrack.lyrics ?? [] : [];
  const activeLine = getActiveLyricLine(lyrics, currentTime);
  const controls = useLyricPictureInPicture(activeLine?.ja ?? '', activeLine?.zh ?? '');

  return <LyricPictureInPictureContext.Provider value={controls}>{children}</LyricPictureInPictureContext.Provider>;
}

export function useLyricPictureInPictureControls() {
  const context = useContext(LyricPictureInPictureContext);
  if (!context) {
    throw new Error('useLyricPictureInPictureControls must be used inside LyricPictureInPictureProvider');
  }

  return context;
}
