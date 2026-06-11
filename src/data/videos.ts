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
  {
    id: 'crimson-butterfly-remake-canyang',
    title: '残阳',
    description: '零：红蝶 重制版本地视频。',
    genre: 'Fatal Frame, Local Video',
    duration: '00:00',
    src: '/videos/【零：红蝶 重制版】 残阳.mp4',
    poster: '/videos/crimson-butterfly-remake-canyang-thumb.png',
    thumbnail: '/videos/crimson-butterfly-remake-canyang-thumb.png',
    previewTime: 6,
  },
  {
    id: 'crimson-butterfly-remake-yueding',
    title: '约定',
    description: '零：红蝶 重制版本地视频。',
    genre: 'Fatal Frame, Local Video',
    duration: '00:00',
    src: '/videos/【零：红蝶 重制版】 约定.mp4',
    poster: '/videos/crimson-butterfly-remake-yueding-thumb.png',
    thumbnail: '/videos/crimson-butterfly-remake-yueding-thumb.png',
    previewTime: 6,
  },
  {
    id: 'crimson-butterfly-remake-mijia',
    title: '迷家',
    description: '零：红蝶 重制版本地视频。',
    genre: 'Fatal Frame, Local Video',
    duration: '00:00',
    src: '/videos/【零：红蝶 重制版】迷家.mp4',
    poster: '/videos/crimson-butterfly-remake-mijia-thumb.png',
    thumbnail: '/videos/crimson-butterfly-remake-mijia-thumb.png',
    previewTime: 6,
  },
  {
    id: 'deep-crimson-butterfly-dongdie',
    title: '冻蝶',
    description: '零：真红之蝶本地视频。',
    genre: 'Fatal Frame, Local Video',
    duration: '00:00',
    src: '/videos/【零：真红之蝶】冻蝶.mp4',
    poster: '/videos/deep-crimson-butterfly-dongdie-thumb.png',
    thumbnail: '/videos/deep-crimson-butterfly-dongdie-thumb.png',
    previewTime: 6,
  },
  {
    id: 'deep-crimson-butterfly-yinji',
    title: '阴祭',
    description: '零：真红之蝶本地视频。',
    genre: 'Fatal Frame, Local Video',
    duration: '00:00',
    src: '/videos/【零：真红之蝶】阴祭.mp4',
    poster: '/videos/deep-crimson-butterfly-yinji-thumb.png',
    thumbnail: '/videos/deep-crimson-butterfly-yinji-thumb.png',
    previewTime: 6,
  },
  {
    id: 'deep-crimson-butterfly-hongdie',
    title: '红蝶',
    description: '零：真红之蝶本地视频。',
    genre: 'Fatal Frame, Local Video',
    duration: '00:00',
    src: '/videos/【零：真红之蝶】红蝶.mp4',
    poster: '/videos/deep-crimson-butterfly-hongdie-thumb.png',
    thumbnail: '/videos/deep-crimson-butterfly-hongdie-thumb.png',
    previewTime: 6,
  },
  {
    id: 'deep-crimson-butterfly-escape-alone',
    title: '独自逃跑',
    description: '零：真红之蝶本地视频。',
    genre: 'Fatal Frame, Local Video',
    duration: '00:00',
    src: '/videos/【零：真红之蝶】独自逃跑.mp4',
    poster: '/videos/deep-crimson-butterfly-escape-alone-thumb.png',
    thumbnail: '/videos/deep-crimson-butterfly-escape-alone-thumb.png',
    previewTime: 6,
  },
  {
    id: 'maiden-black-water-famous-scene',
    title: '零 ～濡鸦之巫女～名场面',
    description: '零 ～濡鸦之巫女～本地视频。',
    genre: 'Fatal Frame, Local Video',
    duration: '00:00',
    src: '/videos/零 ～濡鸦之巫女～名场面.mp4',
    poster: '/videos/maiden-black-water-famous-scene-thumb.png',
    thumbnail: '/videos/maiden-black-water-famous-scene-thumb.png',
    previewTime: 6,
  },
];
