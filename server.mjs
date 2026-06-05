import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 3001);
const notesDir = resolve(process.env.NOTES_DIR || join(appRoot, 'data', 'notes'));
const seedNotesDir = resolve(process.env.SEED_NOTES_DIR || join(appRoot, 'seed-notes'));
const distDir = resolve(process.env.DIST_DIR || join(appRoot, 'dist'));
const whisperOutputRoot = resolve(process.env.WHISPER_OUTPUT_DIR || join(appRoot, 'data', 'whisper-outputs'));
const whisperUploadDir = resolve(process.env.WHISPER_UPLOAD_DIR || join(appRoot, 'data', 'whisper-uploads'));
const defaultWhisperExecutable =
  process.env.WHISPER_EXECUTABLE || 'C:\\Users\\ADMIN\\AppData\\Local\\Programs\\Python\\Python312\\Scripts\\whisper.exe';
const defaultWhisperModelDir = resolve(process.env.WHISPER_MODEL_DIR || 'D:\\ce_study\\WhisperModels');
const demucsOutputRoot = resolve(process.env.DEMUCS_OUTPUT_DIR || join(appRoot, 'data', 'demucs-outputs'));
const demucsUploadDir = resolve(process.env.DEMUCS_UPLOAD_DIR || join(appRoot, 'data', 'demucs-uploads'));
const defaultDemucsExecutable = process.env.DEMUCS_EXECUTABLE || 'C:\\Users\\ADMIN\\AppData\\Local\\Programs\\Python\\Python312\\Scripts\\demucs.exe';
const generatedLyricsPath = resolve(appRoot, 'src', 'data', 'generatedMusicLyrics.ts');
const musicDataPath = resolve(appRoot, 'src', 'data', 'music.ts');
const whisperJobs = new Map();
const demucsJobs = new Map();
const cleanupTtlMs = 48 * 60 * 60 * 1000;
const cleanupMaxBytes = 3 * 1024 * 1024 * 1024;
let cleanupPromise = null;

const managedCleanupDirs = [
  { key: 'whisper-uploads', label: 'Whisper 上传缓存', path: whisperUploadDir },
  { key: 'whisper-outputs', label: 'Whisper 输出产物', path: whisperOutputRoot },
  { key: 'demucs-uploads', label: 'Demucs 上传缓存', path: demucsUploadDir },
  { key: 'demucs-outputs', label: 'Demucs 输出产物', path: demucsOutputRoot },
];

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.srt': 'application/x-subrip; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
};

function sendJson(response, status, data) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

function sendText(response, status, message) {
  response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  response.end(message);
}

function stripMarkdown(value) {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[>#*_~|[\]-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSlug(value) {
  return value.replace(/-/g, ' ').trim();
}

function slugify(value) {
  const slug = value
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);

  return slug || 'note';
}

function parseNote(id, rawContent) {
  const match = id.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  const date = match?.[1] || '';
  const slug = match?.[2] || id;
  const title = rawContent.match(/^#\s+(.+)$/m)?.[1]?.trim() || cleanSlug(slug);
  const content = rawContent.replace(/^#\s+.+$/m, '').trim();
  const plainText = stripMarkdown(content);
  const excerpt = plainText.length > 110 ? `${plainText.slice(0, 110)}...` : plainText;
  const readingTime = `${Math.max(1, Math.ceil(plainText.length / 500))} 分钟`;

  return {
    id,
    title,
    date,
    slug,
    excerpt,
    readingTime,
    content,
  };
}

function sanitizeId(value) {
  const id = String(value || '').replace(/\.md$/i, '');
  if (!/^[\p{L}\p{N}._-]+$/u.test(id)) {
    return '';
  }

  return id;
}

function notePath(id) {
  const safeId = sanitizeId(id);
  if (!safeId) {
    return '';
  }

  const target = resolve(notesDir, `${safeId}.md`);
  return target.startsWith(notesDir) ? target : '';
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function composeMarkdown(title, content) {
  const safeTitle = String(title || '').trim() || '未命名笔记';
  const body = String(content || '').trim();
  return `# ${safeTitle}\n\n${body}\n`;
}

async function ensureSeedNotes() {
  await mkdir(notesDir, { recursive: true });

  const existing = await readdir(notesDir);
  if (existing.some((name) => name.endsWith('.md'))) {
    return;
  }

  try {
    const seedFiles = await readdir(seedNotesDir);
    await Promise.all(
      seedFiles
        .filter((name) => name.endsWith('.md'))
        .map((name) => copyFile(join(seedNotesDir, name), join(notesDir, name))),
    );
  } catch {
    return;
  }
}

async function readNotes() {
  await ensureSeedNotes();
  const files = await readdir(notesDir);
  const notes = await Promise.all(
    files
      .filter((name) => name.endsWith('.md'))
      .map(async (name) => {
        const rawContent = await readFile(join(notesDir, name), 'utf8');
        return parseNote(name.replace(/\.md$/, ''), rawContent);
      }),
  );

  return notes.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

async function readNote(id) {
  const target = notePath(id);
  if (!target) {
    return null;
  }

  try {
    const rawContent = await readFile(target, 'utf8');
    return parseNote(sanitizeId(id), rawContent);
  } catch {
    return null;
  }
}

async function getUniqueId(title) {
  const base = `${getToday()}-${slugify(title)}`;
  let id = base;
  let index = 2;

  while (notePath(id)) {
    try {
      await stat(notePath(id));
      id = `${base}-${index}`;
      index += 1;
    } catch {
      return id;
    }
  }

  return id;
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function isInsideDir(parent, target) {
  return target === parent || target.startsWith(`${parent}${sep}`);
}

function sanitizeFilename(value) {
  const name = basename(String(value || 'audio')).replace(/[^\p{L}\p{N}._ -]+/gu, '-').trim();
  return name || 'audio';
}

function sanitizeOutputPart(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part !== '.' && part !== '..')
    .map((part) => part.replace(/[^\p{L}\p{N}._ -]+/gu, '-'))
    .filter(Boolean)
    .join(sep);
}

function getProtectedCleanupPaths() {
  const paths = new Set();
  const addPath = (value) => {
    if (value) {
      paths.add(resolve(value));
    }
  };

  for (const job of whisperJobs.values()) {
    if (job.status === 'running' || job.child) {
      addPath(job.inputPath);
      addPath(job.outputDir);
    }
  }

  for (const job of demucsJobs.values()) {
    if (job.status === 'running' || job.child) {
      addPath(job.inputPath);
      addPath(job.outputDir);
      addPath(job.expectedOutputDir);
    }
  }

  return paths;
}

function isProtectedCleanupFile(file, protectedPaths) {
  for (const protectedPath of protectedPaths) {
    if (file.path === protectedPath || isInsideDir(protectedPath, file.path)) {
      return true;
    }
  }

  return false;
}

async function collectCleanupDirectory(definition, currentDir, files) {
  let entries = [];

  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const target = resolve(currentDir, entry.name);

    if (!isInsideDir(definition.path, target)) {
      continue;
    }

    if (entry.isDirectory()) {
      await collectCleanupDirectory(definition, target, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    try {
      const stats = await stat(target);
      files.push({
        key: definition.key,
        root: definition.path,
        path: target,
        size: stats.size,
        mtimeMs: stats.mtimeMs,
      });
    } catch {
      continue;
    }
  }
}

async function collectCleanupFiles() {
  const files = [];

  for (const definition of managedCleanupDirs) {
    await mkdir(definition.path, { recursive: true });
    await collectCleanupDirectory(definition, definition.path, files);
  }

  return files;
}

function buildCleanupSummary(files, protectedPaths = getProtectedCleanupPaths()) {
  const cutoff = Date.now() - cleanupTtlMs;
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const directories = managedCleanupDirs.map((definition) => {
    const dirFiles = files.filter((file) => file.key === definition.key);
    const cleanupCandidates = dirFiles.filter((file) => !isProtectedCleanupFile(file, protectedPaths));
    const expiredFiles = cleanupCandidates.filter((file) => file.mtimeMs <= cutoff);

    return {
      key: definition.key,
      label: definition.label,
      path: definition.path,
      fileCount: dirFiles.length,
      totalSize: dirFiles.reduce((sum, file) => sum + file.size, 0),
      expiredFileCount: expiredFiles.length,
      expiredSize: expiredFiles.reduce((sum, file) => sum + file.size, 0),
      protectedFileCount: dirFiles.length - cleanupCandidates.length,
    };
  });
  const expiredFileCount = directories.reduce((sum, directory) => sum + directory.expiredFileCount, 0);
  const expiredSize = directories.reduce((sum, directory) => sum + directory.expiredSize, 0);

  return {
    ttlHours: cleanupTtlMs / 60 / 60 / 1000,
    maxSize: cleanupMaxBytes,
    totalFileCount: files.length,
    totalSize,
    expiredFileCount,
    expiredSize,
    needsCleanup: expiredFileCount > 0 || totalSize > cleanupMaxBytes,
    directories,
  };
}

async function removeEmptyCleanupParents(startDir, root) {
  let current = resolve(startDir);

  while (current !== root && isInsideDir(root, current)) {
    try {
      await rmdir(current);
    } catch {
      return;
    }

    current = dirname(current);
  }
}

async function deleteCleanupFile(file) {
  await rm(file.path, { force: true });
  await removeEmptyCleanupParents(dirname(file.path), file.root);
}

async function getCleanupSummary() {
  const files = await collectCleanupFiles();
  return buildCleanupSummary(files);
}

async function runStorageCleanup(reason = 'manual', mode = 'policy') {
  const protectedPaths = getProtectedCleanupPaths();
  const files = await collectCleanupFiles();
  const cutoff = Date.now() - cleanupTtlMs;
  const deletedPaths = new Set();
  let deletedCount = 0;
  let freedSize = 0;

  const candidates = files.filter((file) => !isProtectedCleanupFile(file, protectedPaths));
  const deleteCandidate = async (file) => {
    if (deletedPaths.has(file.path)) {
      return;
    }

    try {
      await deleteCleanupFile(file);
      deletedPaths.add(file.path);
      deletedCount += 1;
      freedSize += file.size;
    } catch {
      return;
    }
  };

  const expiredCandidates =
    mode === 'all' ? candidates.sort((a, b) => a.mtimeMs - b.mtimeMs) : candidates.filter((file) => file.mtimeMs <= cutoff).sort((a, b) => a.mtimeMs - b.mtimeMs);
  for (const file of expiredCandidates) {
    await deleteCandidate(file);
  }

  let remainingSize = files.reduce((sum, file) => (deletedPaths.has(file.path) ? sum : sum + file.size), 0);
  if (mode === 'policy' && remainingSize > cleanupMaxBytes) {
    const oldestCandidates = candidates
      .filter((file) => !deletedPaths.has(file.path))
      .sort((a, b) => a.mtimeMs - b.mtimeMs);

    for (const file of oldestCandidates) {
      if (remainingSize <= cleanupMaxBytes) {
        break;
      }

      await deleteCandidate(file);
      remainingSize -= file.size;
    }
  }

  return {
    reason,
    mode,
    deletedCount,
    freedSize,
    finishedAt: new Date().toISOString(),
    summary: await getCleanupSummary(),
  };
}

function scheduleStorageCleanup(reason = 'auto') {
  if (cleanupPromise) {
    return cleanupPromise;
  }

  cleanupPromise = runStorageCleanup(reason)
    .catch((error) => {
      console.error('Storage cleanup failed:', error.message || error);
    })
    .finally(() => {
      cleanupPromise = null;
    });

  return cleanupPromise;
}

function resolveWhisperOutputDir(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === 'data/whisper-outputs' || raw === 'data\\whisper-outputs') {
    return whisperOutputRoot;
  }

  const normalizedRaw = raw.replace(/\\/g, '/');
  const relativeValue = normalizedRaw.replace(/^data\/whisper-outputs\/?/i, '');
  const target = resolve(whisperOutputRoot, sanitizeOutputPart(relativeValue));

  return isInsideDir(whisperOutputRoot, target) ? target : '';
}

function resolveDemucsOutputDir(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === 'data/demucs-outputs' || raw === 'data\\demucs-outputs') {
    return demucsOutputRoot;
  }

  const normalizedRaw = raw.replace(/\\/g, '/');
  const relativeValue = normalizedRaw.replace(/^data\/demucs-outputs\/?/i, '');
  const target = resolve(demucsOutputRoot, sanitizeOutputPart(relativeValue));

  return isInsideDir(demucsOutputRoot, target) ? target : '';
}

function normalizeWhisperConfig(input) {
  const sourceMode = input.sourceMode === 'upload' ? 'upload' : 'path';
  const language = ['auto', 'Japanese', 'Chinese', 'English'].includes(input.language) ? input.language : 'auto';
  const model = ['tiny', 'base', 'small', 'medium', 'large'].includes(input.model) ? input.model : 'small';
  const device = ['cuda', 'cpu'].includes(input.device) ? input.device : 'cuda';
  const outputFormat = ['srt', 'vtt', 'txt'].includes(input.outputFormat) ? input.outputFormat : 'srt';
  const executable = String(input.executable || defaultWhisperExecutable).trim() || defaultWhisperExecutable;
  const modelDir = resolve(String(input.modelDir || defaultWhisperModelDir).trim() || defaultWhisperModelDir);
  const outputDir = resolveWhisperOutputDir(input.outputDir);

  if (!outputDir) {
    throw new Error('Output directory must stay inside data/whisper-outputs');
  }

  if (/[\r\n\0]/.test(executable)) {
    throw new Error('Invalid Whisper executable');
  }

  return {
    sourceMode,
    language,
    model,
    device,
    modelDir,
    outputFormat,
    executable,
    outputDir,
  };
}

function normalizeDemucsConfig(input) {
  const sourceMode = input.sourceMode === 'upload' ? 'upload' : 'path';
  const device = ['cuda', 'cpu'].includes(input.device) ? input.device : 'cuda';
  const executable = String(input.executable || defaultDemucsExecutable).trim() || defaultDemucsExecutable;
  const outputDir = resolveDemucsOutputDir(input.outputDir);

  if (!outputDir) {
    throw new Error('Output directory must stay inside data/demucs-outputs');
  }

  if (/[\r\n\0]/.test(executable)) {
    throw new Error('Invalid Demucs executable');
  }

  return {
    sourceMode,
    device,
    executable,
    outputDir,
  };
}

function composeWhisperArgs(inputPath, config) {
  const args = [
    inputPath,
    '--model',
    config.model,
    '--model_dir',
    config.modelDir,
    '--device',
    config.device,
    '--output_format',
    config.outputFormat,
    '--output_dir',
    config.outputDir,
  ];

  if (config.language !== 'auto') {
    args.push('--language', config.language);
  }

  return args;
}

function composeDemucsArgs(inputPath, config) {
  return ['-d', config.device, '--two-stems', 'vocals', '-o', config.outputDir, inputPath];
}

function quoteCommandPart(value) {
  const text = String(value);
  if (!/[\s"'&|<>]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '\\"')}"`;
}

function composeCommandPreview(executable, args) {
  return [executable, ...args].map(quoteCommandPart).join(' ');
}

async function writeRequestBodyToFile(request, target) {
  await mkdir(resolve(target, '..'), { recursive: true });

  await new Promise((resolveWrite, rejectWrite) => {
    const stream = createWriteStream(target);
    request.on('error', rejectWrite);
    stream.on('error', rejectWrite);
    stream.on('finish', resolveWrite);
    request.pipe(stream);
  });
}

function trimLogs(logs) {
  return logs.join('').split(/\r?\n/).filter(Boolean).slice(-18);
}

async function listWhisperOutputs(job) {
  try {
    const names = await readdir(job.outputDir);
    const results = [];

    for (const name of names) {
      if (extname(name).toLocaleLowerCase() !== `.${job.outputFormat}`) {
        continue;
      }

      const file = resolve(job.outputDir, name);
      if (!isInsideDir(job.outputDir, file)) {
        continue;
      }

      const stats = await stat(file);
      if (stats.mtimeMs + 1000 < job.startedAt) {
        continue;
      }

      results.push({
        name,
        size: stats.size,
        downloadUrl: `/api/whisper/jobs/${job.id}/download/${encodeURIComponent(name)}`,
      });
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

async function serializeWhisperJob(job) {
  const outputs = await listWhisperOutputs(job);

  return {
    id: job.id,
    status: job.status,
    message: job.message,
    command: job.command,
    outputDir: job.outputDir,
    outputFormat: job.outputFormat,
    canImport: job.outputFormat === 'srt' || job.outputFormat === 'vtt',
    outputs,
    logs: trimLogs(job.logs),
  };
}

async function listDemucsOutputs(job) {
  try {
    const names = await readdir(job.expectedOutputDir);
    const results = [];

    for (const name of names) {
      const extension = extname(name).toLocaleLowerCase();
      if (!['.wav', '.mp3', '.flac', '.ogg'].includes(extension)) {
        continue;
      }

      const file = resolve(job.expectedOutputDir, name);
      if (!isInsideDir(job.expectedOutputDir, file)) {
        continue;
      }

      const stats = await stat(file);
      if (stats.mtimeMs + 1000 < job.startedAt) {
        continue;
      }

      results.push({
        name,
        kind: name.toLocaleLowerCase().includes('no_vocals') ? 'no_vocals' : 'vocals',
        size: stats.size,
        localPath: file,
        downloadUrl: `/api/demucs/jobs/${job.id}/download/${encodeURIComponent(name)}`,
      });
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

async function serializeDemucsJob(job) {
  const outputs = await listDemucsOutputs(job);
  const vocals = outputs.find((output) => output.kind === 'vocals' && output.name.toLocaleLowerCase().startsWith('vocals'));

  return {
    id: job.id,
    status: job.status,
    message: job.message,
    command: job.command,
    outputDir: job.outputDir,
    expectedOutputDir: job.expectedOutputDir,
    vocalsPath: vocals?.localPath || '',
    outputs,
    logs: trimLogs(job.logs),
  };
}

function parseTimestamp(value) {
  const match = String(value).trim().match(/(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{3})/);
  if (!match) {
    return 0;
  }

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const millis = Number(match[4] || 0);
  return Math.round((hours * 3600 + minutes * 60 + seconds + millis / 1000) * 1000) / 1000;
}

function parseSubtitleLyrics(rawContent) {
  return String(rawContent)
    .replace(/^\uFEFF?WEBVTT[^\n]*(?:\r?\n)+/i, '')
    .split(/\r?\n\r?\n+/)
    .map((block) => {
      const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const timeLineIndex = lines.findIndex((line) => line.includes('-->'));
      if (timeLineIndex === -1) {
        return null;
      }

      const timeMatch = lines[timeLineIndex].match(/([0-9:,.]+)\s*-->/);
      const text = lines
        .slice(timeLineIndex + 1)
        .filter((line) => !/^\d+$/.test(line))
        .join(' ')
        .replace(/<[^>]+>/g, '')
        .trim();

      if (!timeMatch || !text) {
        return null;
      }

      return { time: parseTimestamp(timeMatch[1]), ja: text };
    })
    .filter(Boolean);
}

async function readGeneratedLyricsMap() {
  try {
    const raw = await readFile(generatedLyricsPath, 'utf8');
    const match = raw.match(/generatedMusicLyrics:\s*Record<string,\s*MusicLyricLine\[]>\s*=\s*({[\s\S]*?});/);
    return match ? JSON.parse(match[1]) : {};
  } catch {
    return {};
  }
}

async function writeGeneratedLyricsMap(value) {
  await writeFile(
    generatedLyricsPath,
    `import type { MusicLyricLine } from './music';\n\nexport const generatedMusicLyrics: Record<string, MusicLyricLine[]> = ${JSON.stringify(value, null, 2)};\n`,
    'utf8',
  );
}

function normalizeGeneratedLyrics(input) {
  if (!Array.isArray(input)) {
    throw new Error('Lyrics must be an array');
  }

  return input
    .map((line, index) => {
      const time = Number(line?.time);
      const ja = String(line?.ja ?? '').trim();
      const zh = String(line?.zh ?? '').trim();

      if (!Number.isFinite(time) || time < 0) {
        throw new Error(`Invalid time at lyric line ${index + 1}`);
      }

      if (!ja && !zh) {
        throw new Error(`Lyric line ${index + 1} must include ja or zh text`);
      }

      const normalized = {
        time: Math.round(time * 1000) / 1000,
        ja: ja || zh,
      };

      if (zh) {
        normalized.zh = zh;
      }

      return normalized;
    })
    .sort((a, b) => a.time - b.time);
}

async function isKnownMusicTrack(trackId) {
  try {
    const raw = await readFile(musicDataPath, 'utf8');
    return raw.includes(`id: '${trackId}'`) || raw.includes(`id: "${trackId}"`);
  } catch {
    return false;
  }
}

async function runWhisperJob(job) {
  await mkdir(job.outputDir, { recursive: true });

  const child = spawn(job.executable, job.args, {
    windowsHide: true,
  });
  job.child = child;

  child.stdout.on('data', (chunk) => {
    job.logs.push(chunk.toString('utf8'));
  });

  child.stderr.on('data', (chunk) => {
    job.logs.push(chunk.toString('utf8'));
  });

  child.on('error', (error) => {
    if (job.status === 'stopped') {
      return;
    }

    job.status = 'failed';
    job.message = error.code === 'ENOENT' ? 'Whisper executable not found. Please install Whisper or set the executable path.' : error.message;
  });

  child.on('close', (code) => {
    job.child = null;

    if (job.status === 'stopped') {
      scheduleStorageCleanup('whisper-finished');
      return;
    }

    if (job.status === 'failed') {
      scheduleStorageCleanup('whisper-finished');
      return;
    }

    if (code === 0) {
      job.status = 'completed';
      job.message = 'Whisper finished.';
      scheduleStorageCleanup('whisper-finished');
      return;
    }

    job.status = 'failed';
    job.message = `Whisper exited with code ${code}.`;
    scheduleStorageCleanup('whisper-finished');
  });
}

function stopWhisperJob(job) {
  if (job.status !== 'running') {
    return false;
  }

  job.status = 'stopped';
  job.message = 'Whisper stopped by user.';
  job.logs.push('Whisper stopped by user.');
  scheduleStorageCleanup('whisper-stopped');

  if (!job.child || job.child.killed) {
    return true;
  }

  if (process.platform === 'win32' && job.child.pid) {
    const killer = spawn('taskkill', ['/pid', String(job.child.pid), '/t', '/f'], {
      windowsHide: true,
    });
    killer.on('error', () => {
      job.child?.kill();
    });
    return true;
  }

  job.child.kill('SIGTERM');
  return true;
}

async function createWhisperPathJob(body) {
  const config = normalizeWhisperConfig(body);
  const inputPath = String(body.inputPath || '').trim();

  if (!inputPath) {
    throw new Error('Audio path is required');
  }

  return createWhisperJob(inputPath, config);
}

async function createWhisperUploadJob(request, url) {
  const query = Object.fromEntries(url.searchParams.entries());
  const config = normalizeWhisperConfig({ ...query, sourceMode: 'upload' });
  const id = randomUUID();
  const uploadName = `${id}-${sanitizeFilename(query.filename)}`;
  const inputPath = resolve(whisperUploadDir, uploadName);

  if (!isInsideDir(whisperUploadDir, inputPath)) {
    throw new Error('Invalid upload filename');
  }

  await writeRequestBodyToFile(request, inputPath);
  return createWhisperJob(inputPath, config, id);
}

function createWhisperJob(inputPath, config, forcedId) {
  const id = forcedId || randomUUID();
  const args = composeWhisperArgs(inputPath, config);
  const job = {
    id,
    args,
    command: composeCommandPreview(config.executable, args),
    executable: config.executable,
    inputPath,
    logs: [],
    message: 'Whisper is running.',
    outputDir: config.outputDir,
    outputFormat: config.outputFormat,
    startedAt: Date.now(),
    status: 'running',
    child: null,
  };

  whisperJobs.set(id, job);
  runWhisperJob(job);
  return job;
}

async function runDemucsJob(job) {
  await mkdir(job.outputDir, { recursive: true });

  const child = spawn(job.executable, job.args, {
    windowsHide: true,
  });
  job.child = child;

  child.stdout.on('data', (chunk) => {
    job.logs.push(chunk.toString('utf8'));
  });

  child.stderr.on('data', (chunk) => {
    job.logs.push(chunk.toString('utf8'));
  });

  child.on('error', (error) => {
    if (job.status === 'stopped') {
      return;
    }

    job.status = 'failed';
    job.message = error.code === 'ENOENT' ? 'Demucs executable not found. Please install Demucs or set the executable path.' : error.message;
  });

  child.on('close', (code) => {
    job.child = null;

    if (job.status === 'stopped' || job.status === 'failed') {
      scheduleStorageCleanup('demucs-finished');
      return;
    }

    if (code === 0) {
      job.status = 'completed';
      job.message = 'Demucs finished.';
      scheduleStorageCleanup('demucs-finished');
      return;
    }

    job.status = 'failed';
    job.message = `Demucs exited with code ${code}.`;
    scheduleStorageCleanup('demucs-finished');
  });
}

function stopDemucsJob(job) {
  if (job.status !== 'running') {
    return false;
  }

  job.status = 'stopped';
  job.message = 'Demucs stopped by user.';
  job.logs.push('Demucs stopped by user.');
  scheduleStorageCleanup('demucs-stopped');

  if (!job.child || job.child.killed) {
    return true;
  }

  if (process.platform === 'win32' && job.child.pid) {
    const killer = spawn('taskkill', ['/pid', String(job.child.pid), '/t', '/f'], {
      windowsHide: true,
    });
    killer.on('error', () => {
      job.child?.kill();
    });
    return true;
  }

  job.child.kill('SIGTERM');
  return true;
}

async function createDemucsPathJob(body) {
  const config = normalizeDemucsConfig(body);
  const inputPath = String(body.inputPath || '').trim();

  if (!inputPath) {
    throw new Error('Audio path is required');
  }

  return createDemucsJob(inputPath, config);
}

async function createDemucsUploadJob(request, url) {
  const query = Object.fromEntries(url.searchParams.entries());
  const config = normalizeDemucsConfig({ ...query, sourceMode: 'upload' });
  const id = randomUUID();
  const uploadName = `${id}-${sanitizeFilename(query.filename)}`;
  const inputPath = resolve(demucsUploadDir, uploadName);

  if (!isInsideDir(demucsUploadDir, inputPath)) {
    throw new Error('Invalid upload filename');
  }

  await writeRequestBodyToFile(request, inputPath);
  return createDemucsJob(inputPath, config, id);
}

function createDemucsJob(inputPath, config, forcedId) {
  const id = forcedId || randomUUID();
  const args = composeDemucsArgs(inputPath, config);
  const inputStem = basename(inputPath, extname(inputPath));
  const expectedOutputDir = resolve(config.outputDir, 'htdemucs', inputStem);
  const job = {
    id,
    args,
    command: composeCommandPreview(config.executable, args),
    executable: config.executable,
    inputPath,
    logs: [],
    message: 'Demucs is running.',
    outputDir: config.outputDir,
    expectedOutputDir,
    startedAt: Date.now(),
    status: 'running',
    child: null,
  };

  demucsJobs.set(id, job);
  runDemucsJob(job);
  return job;
}

async function handleDemucsApi(request, response, url) {
  const parts = url.pathname.split('/').filter(Boolean);
  const jobId = parts[3] || '';
  const action = parts[4] || '';

  if (url.pathname === '/api/demucs/jobs' && request.method === 'POST') {
    try {
      const contentType = String(request.headers['content-type'] || '');
      const job = contentType.includes('application/json')
        ? await createDemucsPathJob(await readJsonBody(request))
        : await createDemucsUploadJob(request, url);
      sendJson(response, 201, { job: await serializeDemucsJob(job) });
    } catch (error) {
      sendJson(response, 400, { message: error.message || 'Unable to create Demucs job' });
    }
    return;
  }

  const job = demucsJobs.get(jobId);
  if (!job) {
    sendJson(response, 404, { message: 'Demucs job not found' });
    return;
  }

  if (parts.length === 4 && request.method === 'GET') {
    sendJson(response, 200, { job: await serializeDemucsJob(job) });
    return;
  }

  if (action === 'stop' && request.method === 'POST') {
    stopDemucsJob(job);
    sendJson(response, 200, { job: await serializeDemucsJob(job) });
    return;
  }

  if (action === 'download' && request.method === 'GET') {
    const fileName = sanitizeFilename(decodeURIComponent(parts.slice(5).join('/')));
    const target = resolve(job.expectedOutputDir, fileName);

    if (!isInsideDir(job.expectedOutputDir, target)) {
      sendJson(response, 404, { message: 'Output file not found' });
      return;
    }

    try {
      response.setHeader('content-disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      sendFile(request, response, target, await stat(target));
    } catch {
      sendJson(response, 404, { message: 'Output file not found' });
    }
    return;
  }

  sendJson(response, 405, { message: 'Method not allowed' });
}

async function handleWhisperApi(request, response, url) {
  const parts = url.pathname.split('/').filter(Boolean);
  const jobId = parts[3] || '';
  const action = parts[4] || '';

  if (url.pathname === '/api/whisper/jobs' && request.method === 'POST') {
    try {
      const contentType = String(request.headers['content-type'] || '');
      const job = contentType.includes('application/json')
        ? await createWhisperPathJob(await readJsonBody(request))
        : await createWhisperUploadJob(request, url);
      sendJson(response, 201, { job: await serializeWhisperJob(job) });
    } catch (error) {
      sendJson(response, 400, { message: error.message || 'Unable to create Whisper job' });
    }
    return;
  }

  const job = whisperJobs.get(jobId);
  if (!job) {
    sendJson(response, 404, { message: 'Whisper job not found' });
    return;
  }

  if (parts.length === 4 && request.method === 'GET') {
    sendJson(response, 200, { job: await serializeWhisperJob(job) });
    return;
  }

  if (action === 'stop' && request.method === 'POST') {
    stopWhisperJob(job);
    sendJson(response, 200, { job: await serializeWhisperJob(job) });
    return;
  }

  if (action === 'download' && request.method === 'GET') {
    const fileName = sanitizeFilename(decodeURIComponent(parts.slice(5).join('/')));
    const target = resolve(job.outputDir, fileName);

    if (!isInsideDir(job.outputDir, target) || extname(target).toLocaleLowerCase() !== `.${job.outputFormat}`) {
      sendJson(response, 404, { message: 'Output file not found' });
      return;
    }

    try {
      response.setHeader('content-disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      sendFile(request, response, target, await stat(target));
    } catch {
      sendJson(response, 404, { message: 'Output file not found' });
    }
    return;
  }

  if (action === 'import-lyrics' && request.method === 'POST') {
    try {
      const body = await readJsonBody(request);
      const trackId = sanitizeId(body.trackId);
      const fileName = sanitizeFilename(body.fileName);
      const target = resolve(job.outputDir, fileName);

      if (!trackId || !(await isKnownMusicTrack(trackId))) {
        sendJson(response, 400, { message: 'Unknown music track' });
        return;
      }

      if (!isInsideDir(job.outputDir, target) || !['.srt', '.vtt'].includes(extname(target).toLocaleLowerCase())) {
        sendJson(response, 400, { message: 'Only srt and vtt outputs can be imported as lyrics' });
        return;
      }

      const lyrics = parseSubtitleLyrics(await readFile(target, 'utf8'));
      if (!lyrics.length) {
        sendJson(response, 400, { message: 'No timed lyrics were found in the selected file' });
        return;
      }

      const generated = await readGeneratedLyricsMap();
      generated[trackId] = lyrics;
      await writeGeneratedLyricsMap(generated);
      sendJson(response, 200, { ok: true, count: lyrics.length });
    } catch (error) {
      sendJson(response, 500, { message: error.message || 'Unable to import lyrics' });
    }
    return;
  }

  sendJson(response, 405, { message: 'Method not allowed' });
}

async function handleMusicApi(request, response, url) {
  if (url.pathname === '/api/music/generated-lyrics' && request.method === 'GET') {
    sendJson(response, 200, { lyrics: await readGeneratedLyricsMap() });
    return;
  }

  if (url.pathname.startsWith('/api/music/generated-lyrics/') && request.method === 'PUT') {
    try {
      const rawTrackId = decodeURIComponent(url.pathname.replace(/^\/api\/music\/generated-lyrics\/?/, '').replace(/\/$/, ''));
      const trackId = sanitizeId(rawTrackId);

      if (!trackId || !(await isKnownMusicTrack(trackId))) {
        sendJson(response, 400, { message: 'Unknown music track' });
        return;
      }

      const body = await readJsonBody(request);
      const lyrics = normalizeGeneratedLyrics(body.lyrics);
      const generated = await readGeneratedLyricsMap();
      generated[trackId] = lyrics;
      await writeGeneratedLyricsMap(generated);
      sendJson(response, 200, { ok: true, count: lyrics.length, lyrics });
    } catch (error) {
      sendJson(response, 400, { message: error.message || 'Unable to save generated lyrics' });
    }
    return;
  }

  sendJson(response, 404, { message: 'Music API not found' });
}

async function handleStorageApi(request, response, url) {
  if (url.pathname === '/api/storage/cleanup' && request.method === 'GET') {
    sendJson(response, 200, { summary: await getCleanupSummary() });
    return;
  }

  if (url.pathname === '/api/storage/cleanup' && request.method === 'POST') {
    sendJson(response, 200, { cleanup: await runStorageCleanup('manual', 'all') });
    return;
  }

  sendJson(response, 404, { message: 'Storage API not found' });
}

async function handleNotesApi(request, response, url) {
  const id = decodeURIComponent(url.pathname.replace(/^\/api\/notes\/?/, '').replace(/\/$/, ''));

  if (url.pathname === '/api/notes' && request.method === 'GET') {
    sendJson(response, 200, { notes: await readNotes() });
    return;
  }

  if (url.pathname === '/api/notes' && request.method === 'POST') {
    const body = await readJsonBody(request);
    const title = String(body.title || '').trim() || '未命名笔记';
    const content = String(body.content || '').trim();
    const noteId = await getUniqueId(title);
    await writeFile(notePath(noteId), composeMarkdown(title, content), 'utf8');
    sendJson(response, 201, { note: await readNote(noteId) });
    return;
  }

  if (!id) {
    sendJson(response, 404, { message: 'Note not found' });
    return;
  }

  if (request.method === 'GET') {
    const note = await readNote(id);
    if (!note) {
      sendJson(response, 404, { message: 'Note not found' });
      return;
    }

    sendJson(response, 200, { note });
    return;
  }

  if (request.method === 'PUT') {
    const target = notePath(id);
    const note = await readNote(id);
    if (!target || !note) {
      sendJson(response, 404, { message: 'Note not found' });
      return;
    }

    const body = await readJsonBody(request);
    await writeFile(target, composeMarkdown(body.title, body.content), 'utf8');
    sendJson(response, 200, { note: await readNote(id) });
    return;
  }

  if (request.method === 'DELETE') {
    const target = notePath(id);
    if (!target) {
      sendJson(response, 404, { message: 'Note not found' });
      return;
    }

    await rm(target, { force: true });
    sendJson(response, 200, { ok: true });
    return;
  }

  sendJson(response, 405, { message: 'Method not allowed' });
}

function sendFile(request, response, file, stats) {
  const contentType = mimeTypes[extname(file)] || 'application/octet-stream';
  const range = request.headers.range;

  if (range && stats.size > 0) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);

    if (match) {
      const suffixLength = match[1] === '' ? Number(match[2]) : 0;
      const start = match[1] === '' ? Math.max(stats.size - suffixLength, 0) : Number(match[1]);
      const end = match[2] === '' || match[1] === '' ? stats.size - 1 : Math.min(Number(match[2]), stats.size - 1);

      if (Number.isFinite(start) && Number.isFinite(end) && start <= end && start < stats.size) {
        response.writeHead(206, {
          'accept-ranges': 'bytes',
          'content-length': end - start + 1,
          'content-range': `bytes ${start}-${end}/${stats.size}`,
          'content-type': contentType,
        });

        if (request.method === 'HEAD') {
          response.end();
          return;
        }

        createReadStream(file, { start, end }).pipe(response);
        return;
      }
    }

    response.writeHead(416, {
      'accept-ranges': 'bytes',
      'content-range': `bytes */${stats.size}`,
    });
    response.end();
    return;
  }

  response.writeHead(200, {
    'accept-ranges': 'bytes',
    'content-length': stats.size,
    'content-type': contentType,
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  createReadStream(file).pipe(response);
}

async function serveStatic(request, response, pathname) {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const target = resolve(distDir, `.${decodeURIComponent(requestedPath)}`);
  const safeTarget = target.startsWith(distDir) ? target : join(distDir, 'index.html');

  try {
    const stats = await stat(safeTarget);
    const file = stats.isFile() ? safeTarget : join(distDir, 'index.html');
    const fileStats = stats.isFile() ? stats : await stat(file);
    sendFile(request, response, file, fileStats);
  } catch {
    const file = join(distDir, 'index.html');
    sendFile(request, response, file, await stat(file));
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (url.pathname.startsWith('/api/notes')) {
      await handleNotesApi(request, response, url);
      return;
    }

    if (url.pathname.startsWith('/api/whisper')) {
      await handleWhisperApi(request, response, url);
      return;
    }

    if (url.pathname.startsWith('/api/demucs')) {
      await handleDemucsApi(request, response, url);
      return;
    }

    if (url.pathname.startsWith('/api/music')) {
      await handleMusicApi(request, response, url);
      return;
    }

    if (url.pathname.startsWith('/api/storage')) {
      await handleStorageApi(request, response, url);
      return;
    }

    await serveStatic(request, response, url.pathname);
  } catch (error) {
    const message = error instanceof SyntaxError ? 'Invalid JSON body' : 'Server error';
    sendJson(response, error instanceof SyntaxError ? 400 : 500, { message });
  }
});

server.listen(port, () => {
  console.log(`Fatal Frame toolbox listening on http://127.0.0.1:${port}`);
  scheduleStorageCleanup('startup');
});
