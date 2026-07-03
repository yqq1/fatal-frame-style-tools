import type { MuseumDocument } from '../data/fatalFrameMuseum';

export type MuseumPdfProgressEntry = {
  page: number;
  updatedAt: string;
};

export type MuseumPdfProgressState = Record<string, MuseumPdfProgressEntry>;

export const museumPdfProgressStorageKey = 'museum:pdf-progress:v1';
export const museumPdfProgressEventName = 'museum-pdf-progress-change';

export function getMuseumPdfProgressKey(workId: string, documentId: string) {
  return `${workId}:${documentId}`;
}

function clampPage(page: number, minPage: number, maxPage: number) {
  return Math.min(Math.max(page, minPage), maxPage);
}

export function readMuseumPdfProgressState(): MuseumPdfProgressState {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(museumPdfProgressStorageKey);
    const parsed = raw ? JSON.parse(raw) : {};

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return false;
        }

        const entry = value as Partial<MuseumPdfProgressEntry>;
        return Number.isInteger(entry.page) && typeof entry.updatedAt === 'string';
      }),
    ) as MuseumPdfProgressState;
  } catch {
    return {};
  }
}

export function readMuseumPdfProgress(workId: string, documentId: string) {
  return readMuseumPdfProgressState()[getMuseumPdfProgressKey(workId, documentId)];
}

export function getInitialMuseumPdfPage(workId: string, document: MuseumDocument, totalPages?: number) {
  const progress = readMuseumPdfProgress(workId, document.id);
  const maxPage = totalPages ? Math.min(document.pageEnd, totalPages) : document.pageEnd;

  if (progress) {
    return clampPage(progress.page, document.pageStart, maxPage);
  }

  return clampPage(document.pageStart, 1, maxPage);
}

export function saveMuseumPdfProgress(workId: string, document: MuseumDocument, page: number, totalPages?: number) {
  if (typeof window === 'undefined') {
    return;
  }

  const maxPage = totalPages ? Math.min(document.pageEnd, totalPages) : document.pageEnd;
  const state = readMuseumPdfProgressState();
  const key = getMuseumPdfProgressKey(workId, document.id);

  state[key] = {
    page: clampPage(page, document.pageStart, maxPage),
    updatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(museumPdfProgressStorageKey, JSON.stringify(state));
  window.dispatchEvent(new Event(museumPdfProgressEventName));
}
