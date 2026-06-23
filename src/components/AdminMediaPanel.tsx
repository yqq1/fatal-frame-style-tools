import { Eye, EyeOff, LogOut, Save, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { RuntimeAudioTrack, RuntimeVideoItem } from '../hooks/useRuntimeMediaLibrary';

type MediaKind = 'audio' | 'video';

type AdminMediaPanelProps = {
  runtimeAudioTracks: RuntimeAudioTrack[];
  runtimeVideos: RuntimeVideoItem[];
  onLibraryChange: () => Promise<void> | void;
};

const adminTokenStorageKey = 'fatal-frame.admin-token';
const acceptByKind: Record<MediaKind, string> = {
  audio: '.mp3,.m4a,.wav,.ogg,.flac',
  video: '.mp4,.webm',
};

function getAuthHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function fileTitle(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').trim() || fileName;
}

function formatBytes(value?: number) {
  if (!Number.isFinite(value) || !value) {
    return '';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function AdminMediaPanel({ runtimeAudioTracks, runtimeVideos, onLibraryChange }: AdminMediaPanelProps) {
  const [token, setToken] = useState(() => window.localStorage.getItem(adminTokenStorageKey) || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [kind, setKind] = useState<MediaKind>('audio');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [duration, setDuration] = useState('');
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const selectedMediaCount = kind === 'audio' ? runtimeAudioTracks.length : runtimeVideos.length;
  const selectedMediaLabel = kind === 'audio' ? '音频配置' : '视频配置';

  useEffect(() => {
    if (!token) {
      setIsAuthenticated(false);
      return;
    }

    let cancelled = false;

    async function checkSession() {
      try {
        const response = await fetch('/api/media/admin/session', {
          headers: getAuthHeaders(token),
        });

        if (!response.ok) {
          throw new Error('session expired');
        }

        if (!cancelled) {
          setIsAuthenticated(true);
        }
      } catch {
        window.localStorage.removeItem(adminTokenStorageKey);
        if (!cancelled) {
          setToken('');
          setIsAuthenticated(false);
        }
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function login() {
    setIsBusy(true);
    setMessage('');

    try {
      const response = await fetch('/api/media/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();

      if (!response.ok || typeof data.token !== 'string') {
        throw new Error(data.message || '管理员口令错误。');
      }

      window.localStorage.setItem(adminTokenStorageKey, data.token);
      setToken(data.token);
      setIsAuthenticated(true);
      setPassword('');
      setMessage('管理员已解锁。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '管理员登录失败。');
    } finally {
      setIsBusy(false);
    }
  }

  function logout() {
    window.localStorage.removeItem(adminTokenStorageKey);
    setToken('');
    setIsAuthenticated(false);
    setMessage('管理员已退出。');
  }

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    if (nextFile && !title.trim()) {
      setTitle(fileTitle(nextFile.name));
    }
  }

  async function uploadMedia() {
    if (!file) {
      setMessage('请选择要上传的文件。');
      return;
    }

    setIsBusy(true);
    setMessage('');

    try {
      const params = new URLSearchParams({
        kind,
        filename: file.name,
        type: file.type,
        title: title.trim() || fileTitle(file.name),
        duration: duration.trim(),
      });

      if (kind === 'audio') {
        params.set('artist', artist.trim());
      } else {
        params.set('description', description.trim());
        params.set('genre', genre.trim());
      }

      const response = await fetch(`/api/media/admin/upload?${params.toString()}`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(token),
          'content-type': file.type || 'application/octet-stream',
        },
        body: file,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '上传失败。');
      }

      setFile(null);
      setTitle('');
      setArtist('');
      setDescription('');
      setGenre('');
      setDuration('');
      setMessage('上传完成，已写入源码配置。');
      await onLibraryChange();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '上传失败。');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="admin-media-panel" aria-label="管理员媒体配置">
      <div className="admin-media-head">
        <span className="admin-media-icon">
          <ShieldCheck size={22} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">administrator</p>
          <h3>管理员媒体配置</h3>
        </div>
        {isAuthenticated ? (
          <button className="admin-media-ghost" type="button" onClick={logout}>
            <LogOut size={16} aria-hidden="true" />
            退出
          </button>
        ) : null}
      </div>

      {!isAuthenticated ? (
        <div className="admin-media-login">
          <div className="admin-password-field">
            <input
              aria-label="管理员口令"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void login();
                }
              }}
              placeholder="管理员口令"
              type={showPassword ? 'text' : 'password'}
            />
            <button
              className="admin-password-toggle"
              type="button"
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            </button>
          </div>
          <button type="button" onClick={() => void login()} disabled={isBusy || !password}>
            <ShieldCheck size={16} aria-hidden="true" />
            解锁
          </button>
        </div>
      ) : (
        <>
          <div className="admin-media-upload">
            <div className="admin-media-kind" aria-label="媒体类型">
              <button className={kind === 'audio' ? 'active' : ''} type="button" onClick={() => setKind('audio')}>
                音频
              </button>
              <button className={kind === 'video' ? 'active' : ''} type="button" onClick={() => setKind('video')}>
                视频
              </button>
            </div>

            <label className="admin-media-file">
              <Upload size={18} aria-hidden="true" />
              <span>{file ? file.name : '选择文件'}</span>
              <input accept={acceptByKind[kind]} type="file" onChange={(event) => handleFileChange(event.currentTarget.files?.[0] ?? null)} />
            </label>

            <div className="admin-media-fields">
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="标题" />
              <input value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="时长 00:00" />
              {kind === 'audio' ? (
                <input value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="作者 / 艺术家" />
              ) : (
                <>
                  <input value={genre} onChange={(event) => setGenre(event.target.value)} placeholder="分类" />
                  <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="描述" />
                </>
              )}
            </div>

            <button className="admin-media-primary" type="button" onClick={() => void uploadMedia()} disabled={isBusy || !file}>
              <Upload size={16} aria-hidden="true" />
              {isBusy ? '处理中' : '上传'}
            </button>
          </div>

          <div className="admin-media-list" aria-label="媒体配置">
            <div className="admin-media-list-head">
              <strong>{selectedMediaLabel}</strong>
              <span>{selectedMediaCount} 项</span>
            </div>
            {selectedMediaCount === 0 ? <p className="admin-media-empty">暂无{kind === 'audio' ? '音频' : '视频'}配置。</p> : null}
            {kind === 'audio'
              ? runtimeAudioTracks.map((item) => (
                  <AdminMediaEditor key={item.id} kind="audio" item={item} token={token} onLibraryChange={onLibraryChange} />
                ))
              : runtimeVideos.map((item) => (
                  <AdminMediaEditor key={item.id} kind="video" item={item} token={token} onLibraryChange={onLibraryChange} />
                ))}
          </div>
        </>
      )}

      {message ? <p className="admin-media-message">{message}</p> : null}
    </section>
  );
}

function AdminMediaEditor({
  item,
  kind,
  onLibraryChange,
  token,
}: {
  item: RuntimeAudioTrack | RuntimeVideoItem;
  kind: MediaKind;
  onLibraryChange: () => Promise<void> | void;
  token: string;
}) {
  const audioItem = kind === 'audio' ? (item as RuntimeAudioTrack) : null;
  const videoItem = kind === 'video' ? (item as RuntimeVideoItem) : null;
  const [title, setTitle] = useState(item.title);
  const [duration, setDuration] = useState(item.duration);
  const [artist, setArtist] = useState(audioItem?.artist ?? '');
  const [description, setDescription] = useState(videoItem?.description ?? '');
  const [genre, setGenre] = useState(videoItem?.genre ?? '');
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    setTitle(item.title);
    setDuration(item.duration);
    setArtist(audioItem?.artist ?? '');
    setDescription(videoItem?.description ?? '');
    setGenre(videoItem?.genre ?? '');
  }, [audioItem?.artist, item.duration, item.title, videoItem?.description, videoItem?.genre]);

  async function saveItem() {
    setIsBusy(true);
    setMessage('');

    try {
      const body =
        kind === 'audio'
          ? { title, duration, artist }
          : { title, duration, description, genre };
      const response = await fetch(`/api/media/admin/${kind}/${encodeURIComponent(item.id)}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(token),
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '保存失败。');
      }

      setMessage('已保存。');
      await onLibraryChange();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败。');
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteItem() {
    if (!window.confirm(`删除“${item.title}”？`)) {
      return;
    }

    setIsBusy(true);
    setMessage('');

    try {
      const response = await fetch(`/api/media/admin/${kind}/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '删除失败。');
      }

      await onLibraryChange();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除失败。');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="admin-media-item">
      <div className="admin-media-item-meta">
        <strong>{kind === 'audio' ? '音频' : '视频'}</strong>
        <span>{[item.fileName, formatBytes(item.size)].filter(Boolean).join(' · ')}</span>
      </div>
      <div className="admin-media-fields">
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="标题" />
        <input value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="时长 00:00" />
        {kind === 'audio' ? (
          <input value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="作者 / 艺术家" />
        ) : (
          <>
            <input value={genre} onChange={(event) => setGenre(event.target.value)} placeholder="分类" />
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="描述" />
          </>
        )}
      </div>
      <div className="admin-media-item-actions">
        <button type="button" onClick={() => void saveItem()} disabled={isBusy}>
          <Save size={15} aria-hidden="true" />
          保存
        </button>
        <button className="danger" type="button" onClick={() => void deleteItem()} disabled={isBusy}>
          <Trash2 size={15} aria-hidden="true" />
          删除
        </button>
      </div>
      {message ? <span className="admin-media-inline-message">{message}</span> : null}
    </div>
  );
}

export default AdminMediaPanel;
