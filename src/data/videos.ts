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
  poster?: string;
  thumbnail?: string;
  previewTime?: number;
};

const videoAssetPath = (id: string, filename: string) => `/videos/${id}/${filename}`;
const videoThumbPath = (id: string) => videoAssetPath(id, 'thumb.png');
const videoPosterPath = (id: string) => videoAssetPath(id, 'poster.png');

function videoSource(id: string, filename: string, type: VideoSource['type'], quality?: string): VideoSource {
  return {
    src: videoAssetPath(id, filename),
    type,
    quality,
  };
}

export const videos: VideoItem[] = [
{
    id: 'crimson-butterfly-remake-canyang',
    title: '残阳',
    description: '零：红蝶 重制版本地视频。',
    genre: 'Fatal Frame, Local Video',
    duration: '00:00',
    src: videoAssetPath('crimson-butterfly-remake-canyang', 'original.mp4'),
    poster: videoThumbPath('crimson-butterfly-remake-canyang'),
    thumbnail: videoThumbPath('crimson-butterfly-remake-canyang'),
    previewTime: 6,
  },
  {
    id: 'crimson-butterfly-remake-yueding',
    title: '约定',
    description: '零：红蝶 重制版本地视频。',
    genre: 'Fatal Frame, Local Video',
    duration: '00:00',
    src: videoAssetPath('crimson-butterfly-remake-yueding', 'original.mp4'),
    poster: videoThumbPath('crimson-butterfly-remake-yueding'),
    thumbnail: videoThumbPath('crimson-butterfly-remake-yueding'),
    previewTime: 6,
  },
  {
    id: 'crimson-butterfly-remake-mijia',
    title: '迷家',
    description: '零：红蝶 重制版本地视频。',
    genre: 'Fatal Frame, Local Video',
    duration: '00:00',
    src: videoAssetPath('crimson-butterfly-remake-mijia', 'original.mp4'),
    poster: videoThumbPath('crimson-butterfly-remake-mijia'),
    thumbnail: videoThumbPath('crimson-butterfly-remake-mijia'),
    previewTime: 6,
  },
  {
    id: 'deep-crimson-butterfly-dongdie',
    title: '冻蝶',
    description: '零：真红之蝶本地视频。',
    genre: 'Fatal Frame, Local Video',
    duration: '00:00',
    src: videoAssetPath('deep-crimson-butterfly-dongdie', 'original.mp4'),
    poster: videoThumbPath('deep-crimson-butterfly-dongdie'),
    thumbnail: videoThumbPath('deep-crimson-butterfly-dongdie'),
    previewTime: 6,
  },
  {
    id: 'deep-crimson-butterfly-yinji',
    title: '阴祭',
    description: '零：真红之蝶本地视频。',
    genre: 'Fatal Frame, Local Video',
    duration: '00:00',
    src: videoAssetPath('deep-crimson-butterfly-yinji', 'original.mp4'),
    poster: videoThumbPath('deep-crimson-butterfly-yinji'),
    thumbnail: videoThumbPath('deep-crimson-butterfly-yinji'),
    previewTime: 6,
  },
  {
    id: 'deep-crimson-butterfly-hongdie',
    title: '红蝶',
    description: '零：真红之蝶本地视频。',
    genre: 'Fatal Frame, Local Video',
    duration: '00:00',
    src: videoAssetPath('deep-crimson-butterfly-hongdie', 'original.mp4'),
    poster: videoThumbPath('deep-crimson-butterfly-hongdie'),
    thumbnail: videoThumbPath('deep-crimson-butterfly-hongdie'),
    previewTime: 6,
  },
  {
    id: 'deep-crimson-butterfly-escape-alone',
    title: '独自逃跑',
    description: '零：真红之蝶本地视频。',
    genre: 'Fatal Frame, Local Video',
    duration: '00:00',
    src: videoAssetPath('deep-crimson-butterfly-escape-alone', 'original.mp4'),
    poster: videoThumbPath('deep-crimson-butterfly-escape-alone'),
    thumbnail: videoThumbPath('deep-crimson-butterfly-escape-alone'),
    previewTime: 6,
  },
  {
    id: 'maiden-black-water-famous-scene',
    title: '零 ～濡鸦之巫女～名场面',
    description: '零 ～濡鸦之巫女～本地视频。',
    genre: 'Fatal Frame, Local Video',
    duration: '00:00',
    src: videoAssetPath('maiden-black-water-famous-scene', 'original.mp4'),
    poster: videoThumbPath('maiden-black-water-famous-scene'),
    thumbnail: videoThumbPath('maiden-black-water-famous-scene'),
    previewTime: 6,
  },
  {
    id: 'tattooed-voice-koe-mv',
    title: '声 MV',
    description: '零：刺青之声主题歌本地视频。',
    genre: 'Fatal Frame, Local Video',
    duration: '00:00',
    src: videoAssetPath('tattooed-voice-koe-mv', 'original.mp4'),
    poster: videoThumbPath('tattooed-voice-koe-mv'),
    thumbnail: videoThumbPath('tattooed-voice-koe-mv'),
    previewTime: 6,
  },
  {
    id: 'maiden-black-water-yuri-bride',
    title: '不来方夕莉-夜泉的新娘',
    description: '零 ～濡鸦之巫女～本地视频。',
    genre: 'Fatal Frame, Local Video',
    duration: '00:00',
    src: videoAssetPath('maiden-black-water-yuri-bride', 'original.mp4'),
    poster: videoThumbPath('maiden-black-water-yuri-bride'),
    thumbnail: videoThumbPath('maiden-black-water-yuri-bride'),
    previewTime: 6,
  },
  {
    id: 'fatal-frame-tattooed-voice',
    title: '零：刺青之声',
    description: '零：刺青之声本地视频。',
    genre: 'Fatal Frame, Local Video',
    duration: '00:00',
    src: videoAssetPath('fatal-frame-tattooed-voice', 'original.mp4'),
    poster: videoThumbPath('fatal-frame-tattooed-voice'),
    thumbnail: videoThumbPath('fatal-frame-tattooed-voice'),
    previewTime: 6,
  },
  {
    id: 'maiden-black-water-torikago-mv',
    title: '鳥籠 -in this cage-',
    description: '零 ～濡鸦之巫女～主题曲本地视频。',
    genre: 'Fatal Frame, Local Video',
    duration: '00:00',
    src: videoAssetPath('maiden-black-water-torikago-mv', 'original.mp4'),
    poster: videoThumbPath('maiden-black-water-torikago-mv'),
    thumbnail: videoThumbPath('maiden-black-water-torikago-mv'),
    previewTime: 6,
  },
  {
    id: 'maiden-black-water-higanbana-mv',
    title: 'HIGANBANA MV',
    description: '零：濡鸦之巫女主题歌本地视频。',
    genre: 'Fatal Frame, Local Video',
    duration: '00:00',
    src: videoAssetPath('maiden-black-water-higanbana-mv', 'original.mp4'),
    poster: videoThumbPath('maiden-black-water-higanbana-mv'),
    thumbnail: videoThumbPath('maiden-black-water-higanbana-mv'),
    previewTime: 6,
  },
  {
    id: 'crimson-butterfly-remake-uka',
    title: '羽化',
    description: '零：红蝶 重制版本地视频。',
    genre: 'Fatal Frame, Local Video',
    duration: '00:00',
    src: videoAssetPath('crimson-butterfly-remake-uka', 'original.mp4'),
    poster: videoThumbPath('crimson-butterfly-remake-uka'),
    thumbnail: videoThumbPath('crimson-butterfly-remake-uka'),
    previewTime: 6,
  },
  {
    id: "红蝶-df3a947a",
    title: "红蝶",
    description: "零红蝶重制版",
    genre: "Fatal Frame",
    duration: "7:52",
    src: videoAssetPath("红蝶-df3a947a", "original.mp4"),
    poster: videoThumbPath("红蝶-df3a947a"),
    thumbnail: videoThumbPath("红蝶-df3a947a"),
  },
];
