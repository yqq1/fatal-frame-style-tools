import { BookOpenText, ChevronRight, Edit3, FileText, Film, Music as MusicIcon, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { fatalFrameMuseumSeed, museumProgressLabels } from '../data/fatalFrameMuseum';
import type { MuseumData, MuseumDocument, MuseumProgress, MuseumProgressStatus, MuseumWork } from '../data/fatalFrameMuseum';
import {
  getMuseumPdfProgressKey,
  museumPdfProgressEventName,
  museumPdfProgressStorageKey,
  readMuseumPdfProgressState,
} from '../lib/museumPdfProgress';
import { musicTracks } from '../data/music';
import { videos } from '../data/videos';
import MuseumEditor from './MuseumEditor';

type MuseumViewProps = {
  selectedWorkId?: string;
  variant?: 'desktop' | 'mobile';
  onOpenMusic?: () => void;
  onOpenVideo?: () => void;
  onOpenDocument?: (work: MuseumWork, document: MuseumDocument) => void;
  onSelectWork?: (workId: string) => void;
};

const progressOptions: Array<{ key: MuseumProgressStatus; label: string }> = [
  { key: 'none', label: '未标记' },
  { key: 'wishlist', label: '想玩' },
  { key: 'playing', label: '在玩' },
  { key: 'completed', label: '已通' },
];

const emptyProgress: MuseumProgress = {
  status: 'none',
  favorite: false,
  note: '',
};

function getProgress(data: MuseumData, workId: string) {
  return data.progress[workId] ?? emptyProgress;
}

function getClampedDocumentProgressPage(page: number, document: MuseumDocument) {
  return Math.min(Math.max(page, document.pageStart), document.pageEnd);
}

function MuseumCover({ work }: { work: MuseumWork }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [work.cover]);

  if (!work.cover || failed) {
    return (
      <div className="museum-cover-fallback" aria-hidden="true">
        <BookOpenText size={34} />
      </div>
    );
  }

  return <img src={work.cover} alt="" onError={() => setFailed(true)} />;
}

function MuseumView({ selectedWorkId, variant = 'desktop', onOpenDocument, onOpenMusic, onOpenVideo, onSelectWork }: MuseumViewProps) {
  const { selectTrack } = useMusicPlayer();
  const [museum, setMuseum] = useState<MuseumData>(fatalFrameMuseumSeed);
  const [documentProgress, setDocumentProgress] = useState(() => readMuseumPdfProgressState());
  const [internalSelectedId, setInternalSelectedId] = useState(selectedWorkId ?? fatalFrameMuseumSeed.works[0]?.id ?? '');
  const selectedId = selectedWorkId ?? internalSelectedId;
  const [filter, setFilter] = useState<MuseumProgressStatus | 'all' | 'favorite'>('all');
  const [editingWorkId, setEditingWorkId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const selectedWork = useMemo(
    () => museum.works.find((work) => work.id === selectedId) ?? museum.works[0],
    [museum.works, selectedId],
  );

  const visibleWorks = useMemo(
    () =>
      museum.works.filter((work) => {
        const progress = getProgress(museum, work.id);

        if (filter === 'favorite') {
          return progress.favorite;
        }

        return filter === 'all' || progress.status === filter;
      }),
    [filter, museum],
  );

  const selectedProgress = selectedWork ? getProgress(museum, selectedWork.id) : emptyProgress;

  function selectMuseumWork(workId: string) {
    setInternalSelectedId(workId);
    onSelectWork?.(workId);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadMuseum() {
      setIsLoading(true);
      setMessage('');

      try {
        const response = await fetch('/api/museum');
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.message || '无法读取资料馆。');
        }

        if (!cancelled) {
          const nextMuseum = payload.museum as MuseumData;
          setMuseum(nextMuseum);
          if (nextMuseum.works.length > 0 && !nextMuseum.works.some((work) => work.id === selectedId)) {
            selectMuseumWork(nextMuseum.works[0].id);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setMuseum(fatalFrameMuseumSeed);
          setMessage(error instanceof Error ? `${error.message} 当前显示内置种子资料。` : '当前显示内置种子资料。');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadMuseum();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (museum.works.length > 0 && !museum.works.some((work) => work.id === selectedId)) {
      selectMuseumWork(museum.works[0].id);
    }
  }, [museum.works, selectedId]);

  useEffect(() => {
    function refreshDocumentProgress() {
      setDocumentProgress(readMuseumPdfProgressState());
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== museumPdfProgressStorageKey) {
        return;
      }

      refreshDocumentProgress();
    }

    window.addEventListener(museumPdfProgressEventName, refreshDocumentProgress);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(museumPdfProgressEventName, refreshDocumentProgress);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  async function persistMuseum(nextMuseum: MuseumData, successMessage: string) {
    const previousMuseum = museum;
    setMuseum(nextMuseum);
    setIsSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/museum', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(nextMuseum),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || '资料馆保存失败。');
      }

      setMuseum(payload.museum as MuseumData);
      setMessage(successMessage);
      return true;
    } catch (error) {
      setMuseum(previousMuseum);
      setMessage(error instanceof Error ? error.message : '资料馆保存失败。');
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  function startEditing(work: MuseumWork) {
    setEditingWorkId(work.id);
    setMessage('');
  }

  async function saveWork(nextWork: MuseumWork) {
    const nextMuseum: MuseumData = {
      ...museum,
      works: museum.works.map((work) => (work.id === nextWork.id ? nextWork : work)),
    };

    if (await persistMuseum(nextMuseum, '资料条目已保存。')) {
      setEditingWorkId('');
    }
  }

  function updateProgress(workId: string, patch: Partial<MuseumProgress>) {
    const nextProgress = {
      ...getProgress(museum, workId),
      ...patch,
    };
    const nextMuseum: MuseumData = {
      ...museum,
      progress: {
        ...museum.progress,
        [workId]: nextProgress,
      },
    };

    void persistMuseum(nextMuseum, '游玩记录已保存。');
  }

  function updateProgressLocal(workId: string, patch: Partial<MuseumProgress>) {
    setMuseum((currentMuseum) => ({
      ...currentMuseum,
      progress: {
        ...currentMuseum.progress,
        [workId]: {
          ...getProgress(currentMuseum, workId),
          ...patch,
        },
      },
    }));
  }

  if (!selectedWork) {
    return (
      <section className={`museum-view ${variant === 'mobile' ? 'mobile' : ''}`} aria-label="零系列资料馆">
        <div className="museum-empty">资料馆暂无条目。</div>
      </section>
    );
  }

  return (
    <section className={`museum-view ${variant === 'mobile' ? 'mobile' : ''}`} aria-label="零系列资料馆">
      <div className="museum-layout">
        <aside className="museum-timeline" aria-label="作品年表">
          <div className="section-heading">
            <div>
              <p className="eyebrow">fatal frame archive</p>
              <h2>作品年表</h2>
            </div>
            <span>{isLoading ? '读取中' : `${museum.works.length} 作`}</span>
          </div>

          <div className="museum-filter-row" aria-label="游玩状态筛选">
            <button className={filter === 'all' ? 'active' : ''} type="button" onClick={() => setFilter('all')}>
              全部
            </button>
            {progressOptions.slice(1).map((option) => (
              <button className={filter === option.key ? 'active' : ''} key={option.key} type="button" onClick={() => setFilter(option.key)}>
                {option.label}
              </button>
            ))}
            <button className={filter === 'favorite' ? 'active' : ''} type="button" onClick={() => setFilter('favorite')}>
              收藏
            </button>
          </div>

          <div className="museum-work-list">
            {(visibleWorks.length ? visibleWorks : museum.works).map((work) => {
              const progress = getProgress(museum, work.id);

              return (
                <button
                  className={`museum-work-item ${work.id === selectedWork.id ? 'active' : ''}`}
                  key={work.id}
                  type="button"
                  onClick={() => selectMuseumWork(work.id)}
                >
                  <span>{work.year}</span>
                  <strong>{work.title}</strong>
                  <em>{museumProgressLabels[progress.status]}</em>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </aside>

        <article className="museum-detail">
          <div className="museum-hero">
            <div className="museum-cover">
              <MuseumCover work={selectedWork} />
            </div>
            <div className="museum-title-block">
              <p className="eyebrow">{selectedWork.latestVersion}</p>
              <h2>{selectedWork.title}</h2>
              <div className="museum-aliases">
                {selectedWork.aliases.map((alias) => (
                  <span key={alias}>{alias}</span>
                ))}
              </div>
              <div className="museum-tags">
                {selectedWork.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </div>
            <button className="museum-edit-button" type="button" onClick={() => startEditing(selectedWork)}>
              <Edit3 size={16} aria-hidden="true" />
              编辑
            </button>
          </div>

          <div className="museum-copy">
            <p>{selectedWork.summary || '暂无简介。'}</p>
            <details>
              <summary>剧透资料</summary>
              <p>{selectedWork.spoilerSummary || '暂无剧透资料。'}</p>
            </details>
          </div>

          <div className="museum-progress-panel">
            <div>
              <p className="eyebrow">personal record</p>
              <h3>个人记录</h3>
            </div>
            <button
              className={`museum-favorite ${selectedProgress.favorite ? 'active' : ''}`}
              type="button"
              onClick={() => updateProgress(selectedWork.id, { favorite: !selectedProgress.favorite })}
            >
              <Star size={16} aria-hidden="true" />
              {selectedProgress.favorite ? '已收藏' : '收藏'}
            </button>
            <div className="museum-progress-options">
              {progressOptions.map((option) => (
                <button
                  className={selectedProgress.status === option.key ? 'active' : ''}
                  key={option.key}
                  type="button"
                  onClick={() => updateProgress(selectedWork.id, { status: option.key })}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <textarea
              aria-label="个人备注"
              placeholder="个人备注"
              value={selectedProgress.note}
              onBlur={(event) => updateProgress(selectedWork.id, { note: event.currentTarget.value })}
              onChange={(event) => updateProgressLocal(selectedWork.id, { note: event.target.value })}
            />
          </div>

          <div className="museum-media-grid">
            <section className="museum-media-card">
              <div>
                <Film size={18} aria-hidden="true" />
                <strong>本地视频</strong>
              </div>
              {selectedWork.videoIds.length ? (
                selectedWork.videoIds.map((videoId) => {
                  const video = videos.find((item) => item.id === videoId);

                  return (
                    <button key={videoId} type="button" disabled={!video} onClick={onOpenVideo}>
                      {video?.title ?? videoId}
                    </button>
                  );
                })
              ) : (
                <span>暂无关联视频</span>
              )}
            </section>

            <section className="museum-media-card">
              <div>
                <MusicIcon size={18} aria-hidden="true" />
                <strong>本地音乐</strong>
              </div>
              {selectedWork.musicIds.length ? (
                selectedWork.musicIds.map((trackId) => {
                  const track = musicTracks.find((item) => item.id === trackId);

                  return (
                    <button
                      key={trackId}
                      type="button"
                      disabled={!track}
                      onClick={() => {
                        if (track) {
                          selectTrack(track.id);
                          onOpenMusic?.();
                        }
                      }}
                    >
                      {track?.title ?? trackId}
                    </button>
                  );
                })
              ) : (
                <span>暂无关联音乐</span>
              )}
            </section>

            <section className="museum-media-card">
              <div>
                <FileText size={18} aria-hidden="true" />
                <strong>典藏文献</strong>
              </div>
              {selectedWork.documents.length ? (
                selectedWork.documents.map((doc) => (
                  <button
                    aria-label={`阅读 ${doc.title} ${doc.pageStart}-${doc.pageEnd} 页 PDF`}
                    className="museum-document-link"
                    key={doc.id}
                    type="button"
                    onClick={() => onOpenDocument?.(selectedWork, doc)}
                  >
                    <span className="museum-document-meta">PDF 典藏资料</span>
                    <strong>{doc.title}</strong>
                    <span className="museum-document-action">
                      <em>
                        {doc.pageStart}-{doc.pageEnd} 页
                      </em>
                      <small>
                        {documentProgress[getMuseumPdfProgressKey(selectedWork.id, doc.id)]
                          ? `上次读到 ${getClampedDocumentProgressPage(documentProgress[getMuseumPdfProgressKey(selectedWork.id, doc.id)].page, doc)} 页`
                          : '点击阅读 PDF'}
                      </small>
                    </span>
                  </button>
                ))
              ) : (
                <span>暂无关联文献</span>
              )}
            </section>
          </div>

          {message ? <p className="museum-message">{message}</p> : null}
          {isSaving ? <p className="museum-message">保存中...</p> : null}
        </article>

        {editingWorkId ? (
          <MuseumEditor
            isSaving={isSaving}
            work={museum.works.find((work) => work.id === editingWorkId) ?? selectedWork}
            onClose={() => setEditingWorkId('')}
            onSave={saveWork}
          />
        ) : null}
      </div>
    </section>
  );
}

export default MuseumView;
