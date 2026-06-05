export type VideoSource = {
  src: string;
  type: 'video/mp4' | 'video/webm';
  quality?: string;
  label?: string;
};

export type VideoItem = {
  id: string;
  title: string;
  description: string;
  genre: string;
  duration: string;
  src?: string;
  sources?: VideoSource[];
  defaultQuality?: string;
  poster: string;
  thumbnail: string;
  previewTime?: number;
};

export const videos: VideoItem[] = [
  {
    id: 'promo-film',
    title: '宣传影片',
    description: '本地预置的宣传视频，播放器会直接从 public/videos/宣传影片.webm 读取并播放。',
    genre: 'Promo, Local Video',
    duration: '00:00',
    defaultQuality: '原始',
    sources: [
        { src: '/videos/宣传影片-480p.webm', type: 'video/webm', quality: '480p' },
        { src: '/videos/宣传影片-720p.webm', type: 'video/webm', quality: '720p' },
        { src: '/videos/宣传影片.webm', type: 'video/webm', quality: '原始' },
    ],
    poster: '/videos/demo-poster.png',
    thumbnail: '/videos/promo-film-thumb.png',
    previewTime: 8,
  },
  {
    id: 'promo-film2',
    title: '游戏宣传片',
    description: '本地预置的宣传视频，播放器会直接从 public/videos/宣传影片.webm 读取并播放。',
    genre: 'Promo, Local Video',
    duration: '00:00',
    defaultQuality: '原始',
    sources: [
        { src: '/videos/游戏介绍片-480p.webm', type: 'video/webm', quality: '480p' },
        { src: '/videos/游戏介绍片-720p.webm', type: 'video/webm', quality: '720p' },
        { src: '/videos/游戏介绍片.webm', type: 'video/webm', quality: '原始' },
    ],
    poster: '/videos/demo-poster.png',
    thumbnail: '/videos/promo-film2-thumb.png',
    previewTime: 6,
  },
];
