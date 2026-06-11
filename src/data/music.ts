import { chouLyrics } from './musicLyrics';
import { generatedMusicLyrics } from './generatedMusicLyrics';

export type MusicLyricLine = {
  time: number;
  ja: string;
  zh?: string;
};

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  duration: string;
  src: string;
  type: 'audio/mpeg' | 'audio/mp4' | 'audio/wav' | 'audio/ogg' | 'audio/flac' | 'video/mp4';
  cover?: string;
  lyrics?: MusicLyricLine[];
};

const baseMusicTracks: MusicTrack[] = [
  {
    id: 'senkou-zero-pachislo-p01',
    title: '闪光',
    artist: '零ZEROパチスロ主题曲',
    duration: '00:00',
    src: '/musics/01-[熟肉自制字幕]零ZEROパチスロ主题曲  闪光与残像  合集 p01 闪光.m4a',
    type: 'audio/mp4',
  },
  {
    id: 'zanzou-zero-pachislo-p03',
    title: '残像',
    artist: '零ZEROパチスロ主题曲',
    duration: '00:00',
    src: '/musics/03-[熟肉自制字幕]零ZEROパチスロ主题曲  闪光与残像  合集 p03 残像.m4a',
    type: 'audio/mp4',
  },
  {
    id: 'anju-higanbana',
    title: 'AnJu',
    artist: 'HIGANBANA',
    duration: '00:00',
    src: '/musics/AnJu - HIGANBANA.flac',
    type: 'audio/flac',
  },
  {
    id: 'noise-amano-tsuki',
    title: 'NOISE',
    artist: '天野月',
    duration: '00:00',
    src: '/musics/NOISE - 天野月.mp3',
    type: 'audio/mpeg',
  },
  {
    id: 'whataya-want-from-me-adam-lambert',
    title: 'Whataya Want from Me',
    artist: 'Adam Lambert',
    duration: '00:00',
    src: '/musics/Whataya Want from Me - Adam Lambert.mp3',
    type: 'audio/mpeg',
  },
  {
    id: 'kurenai-amano-tsuki',
    title: 'くれなゐ',
    artist: '天野月',
    duration: '00:00',
    src: '/musics/くれなゐ - 天野月.mp3',
    type: 'audio/mpeg',
  },
  {
    id: 'zero-no-shirabe-amano-tsuki',
    title: 'ゼロの調律',
    artist: '天野月',
    duration: '00:00',
    src: '/musics/ゼロの調律 - 天野月.mp3',
    type: 'audio/mpeg',
  },
  {
    id: 'utsushie-amano-tsuki',
    title: 'うつし絵',
    artist: '天野月',
    duration: '00:00',
    src: '/musics/天野月MV『うつし絵』 [tr3dFeKy_1c].mp3',
    type: 'audio/mpeg',
  },
  {
    id: 'koe-amano-tsukiko',
    title: '聲',
    artist: '天野月子',
    duration: '00:00',
    src: '/musics/聲 - 天野月子.mp3',
    type: 'audio/mpeg',
  },
  {
    id: 'chou-amano-tsukiko',
    title: '蝶',
    artist: '天野月子',
    duration: '00:00',
    src: '/musics/蝶-天野月子.mp3',
    type: 'audio/mpeg',
    lyrics: chouLyrics,
  },
  {
    id: 'torikago-in-this-cage-amano-tsuki',
    title: '鳥籠-in this cage-',
    artist: '天野月',
    duration: '00:00',
    src: '/musics/鳥籠-in this cage- - 天野月.mp3',
    type: 'audio/mpeg',
  },
  {
    id: 'Yueshou-song-Minazuki Ruka',
    title: '月守歌',
    artist: '水无月流歌',
    duration: '00:00',
    src: '/musics/Fatal Frame 4 soundtrack-The Tsukimori Song.m4a',
    type: 'audio/mp4',
  },
];

export const musicTracks: MusicTrack[] = baseMusicTracks.map((track) => ({
  ...track,
  lyrics: track.lyrics ?? generatedMusicLyrics[track.id],
}));
