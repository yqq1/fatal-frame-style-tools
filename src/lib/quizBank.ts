export type QuizSet = {
  id: string;
  title: string;
  description: string;
  badge: string;
  file: string;
  questionCount: number;
};

export type QuizQuestionType = 'single' | 'multiple' | 'judge' | 'short';

export type QuizOption = {
  key: string;
  text: string;
};

export type QuizQuestion = {
  id: string;
  set: string;
  title: string;
  type: QuizQuestionType;
  options: QuizOption[];
  answer: string;
};

export type QuizSetsResponse = {
  rootPath: string;
  sets: QuizSet[];
};

export type QuizSetResponse = {
  set: QuizSet;
  questions: QuizQuestion[];
};

export const questionTypes: Array<{ value: QuizQuestionType; label: string }> = [
  { value: 'single', label: '单选' },
  { value: 'multiple', label: '多选' },
  { value: 'judge', label: '判断' },
  { value: 'short', label: '简答' },
];

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data && typeof data.message === 'string' ? data.message : '请求失败');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('题库 API 未返回 JSON，请重启当前项目服务。');
  }

  return data as T;
}

export function defaultOptions(): QuizOption[] {
  return [
    { key: 'A', text: '' },
    { key: 'B', text: '' },
    { key: 'C', text: '' },
    { key: 'D', text: '' },
  ];
}

export function nextOptionKey(options: QuizOption[]) {
  const used = new Set(options.map((option) => option.key));
  return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((key) => !used.has(key)) ?? String(options.length + 1);
}

export function sortAnswer(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .sort()
    .join(',');
}

export function fileNameFromSet(set: QuizSet | null) {
  return set?.file.replace(/^data\//, '') ?? '';
}
