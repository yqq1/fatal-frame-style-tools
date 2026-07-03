export type MuseumProgressStatus = 'none' | 'wishlist' | 'playing' | 'completed';

export type MuseumWork = {
  id: string;
  title: string;
  aliases: string[];
  latestVersion: string;
  year: number;
  summary: string;
  spoilerSummary: string;
  tags: string[];
  cover: string;
  videoIds: string[];
  musicIds: string[];
  documents: MuseumDocument[];
};

export type MuseumDocument = {
  id: string;
  title: string;
  file: string;
  pageStart: number;
  pageEnd: number;
  description: string;
};

export type MuseumProgress = {
  status: MuseumProgressStatus;
  favorite: boolean;
  note: string;
};

export type MuseumData = {
  works: MuseumWork[];
  progress: Record<string, MuseumProgress>;
  updatedAt?: string;
};

export const museumProgressLabels: Record<MuseumProgressStatus, string> = {
  none: '未标记',
  wishlist: '想玩',
  playing: '在玩',
  completed: '已通',
};

export const emptyMuseumProgress: MuseumProgress = {
  status: 'none',
  favorite: false,
  note: '',
};

const cultureGuidePdf = {
  id: 'zero-guide-culture-95-199',
  title: '零宝典 攻略文典藏化专辑（文化篇）',
  description: '收录系列设定、民俗与作品资料的典藏 PDF。',
};

export const fatalFrameMuseumSeed: MuseumData = {
  works: [
    {
      id: 'fatal-frame',
      title: '零 zero',
      aliases: ['FATAL FRAME', 'PROJECT ZERO'],
      latestVersion: '原版资料条目',
      year: 2001,
      summary: '系列开端，围绕冰室邸、射影机和被封存的仪式展开。',
      spoilerSummary: '关键真相、结局与仪式细节默认收起，后续可在编辑器中补充。',
      tags: ['冰室邸', '射影机', '仪式'],
      cover: '/images/museum/fatal-frame/pdf-cover.png',
      videoIds: [],
      musicIds: [],
      documents: [{ ...cultureGuidePdf, file: '/documents/museum/fatal-frame-culture.pdf', pageStart: 1, pageEnd: 22 }],
    },
    {
      id: 'crimson-butterfly-remake',
      title: '零：红蝶',
      aliases: ['FATAL FRAME II', 'PROJECT ZERO II', '真红之蝶', 'Crimson Butterfly'],
      latestVersion: 'Crimson Butterfly Remake',
      year: 2026,
      summary: '以双子、皆神村和红蝶传承为核心的系列代表作资料条目。',
      spoilerSummary: '双子仪式、不同结局和重制版差异可在这里继续整理。',
      tags: ['皆神村', '双子', '红蝶'],
      cover: '/images/museum/crimson-butterfly-remake/pdf-cover.png',
      videoIds: [
        'crimson-butterfly-remake-canyang',
        'crimson-butterfly-remake-yueding',
        'crimson-butterfly-remake-mijia',
        'crimson-butterfly-remake-uka',
      ],
      musicIds: ['chou-amano-tsukiko'],
      documents: [{ ...cultureGuidePdf, file: '/documents/museum/crimson-butterfly-culture.pdf', pageStart: 1, pageEnd: 24 }],
    },
    {
      id: 'tattooed-voice',
      title: '零：刺青之声',
      aliases: ['FATAL FRAME III', 'PROJECT ZERO 3'],
      latestVersion: '原版资料条目',
      year: 2005,
      summary: '以梦境、刺青诅咒和现实侵蚀为核心的资料条目。',
      spoilerSummary: '眠之家、刺青仪式和角色结局可在这里继续补充。',
      tags: ['眠之家', '刺青', '梦境'],
      cover: '/images/museum/tattooed-voice/pdf-cover.png',
      videoIds: ['tattooed-voice-koe-mv', 'fatal-frame-tattooed-voice'],
      musicIds: ['koe-amano-tsukiko'],
      documents: [{ ...cultureGuidePdf, file: '/documents/museum/tattooed-voice-culture.pdf', pageStart: 1, pageEnd: 27 }],
    },
    {
      id: 'mask-of-lunar-eclipse',
      title: '零：月蚀的假面',
      aliases: ['Mask of the Lunar Eclipse', 'PROJECT ZERO 4'],
      latestVersion: 'Remaster',
      year: 2023,
      summary: '围绕胧月岛、月幽病和面具仪式展开的资料条目。',
      spoilerSummary: '胧月神乐、角色记忆和结局信息可在这里继续整理。',
      tags: ['胧月岛', '月幽病', '面具'],
      cover: '/images/museum/mask-of-lunar-eclipse/pdf-cover.png',
      videoIds: [],
      musicIds: ['Yueshou-song-Minazuki Ruka'],
      documents: [{ ...cultureGuidePdf, file: '/documents/museum/mask-of-lunar-eclipse-culture.pdf', pageStart: 1, pageEnd: 10 }],
    },
    {
      id: 'maiden-of-black-water',
      title: '零：濡鸦之巫女',
      aliases: ['Maiden of Black Water', 'PROJECT ZERO 5'],
      latestVersion: 'Remaster',
      year: 2021,
      summary: '以日上山、看取和水的诅咒为核心的资料条目。',
      spoilerSummary: '夜泉、巫女传承、多结局和角色关系可在这里继续补充。',
      tags: ['日上山', '夜泉', '看取'],
      cover: '/images/museum/maiden-of-black-water/pdf-cover.png',
      videoIds: ['maiden-black-water-famous-scene', 'maiden-black-water-yuri-bride', 'maiden-black-water-torikago-mv', 'maiden-black-water-higanbana-mv'],
      musicIds: ['torikago-in-this-cage-amano-tsuki', 'anju-higanbana'],
      documents: [{ ...cultureGuidePdf, file: '/documents/museum/maiden-of-black-water-culture.pdf', pageStart: 1, pageEnd: 18 }],
    },
  ],
  progress: {},
};
