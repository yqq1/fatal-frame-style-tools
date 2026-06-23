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
const publicDir = resolve(process.env.PUBLIC_DIR || join(appRoot, 'public'));
const publicMusicsDir = resolve(process.env.PUBLIC_MUSICS_DIR || join(publicDir, 'musics'));
const publicVideosDir = resolve(process.env.PUBLIC_VIDEOS_DIR || join(publicDir, 'videos'));
const adminPassword = process.env.ADMIN_PASSWORD || 'fatal-frame-admin';
const adminSessionTtlMs = 12 * 60 * 60 * 1000;
const generatedLyricsPath = resolve(appRoot, 'src', 'data', 'generatedMusicLyrics.ts');
const musicDataPath = resolve(appRoot, 'src', 'data', 'music.ts');
const videoDataPath = resolve(appRoot, 'src', 'data', 'videos.ts');
const museumDataPath = resolve(process.env.MUSEUM_DATA_PATH || join(appRoot, 'data', 'fatal-frame-museum.json'));
const quizBankSettingsPath = resolve(appRoot, 'data', 'quiz-bank-settings.json');
const defaultQuizBankRoot = resolve((await readQuizBankRootSetting()) || process.env.QUIZ_BANK_ROOT || 'C:\\Users\\ADMIN\\Desktop\\code\\myhome-page');
let quizBankRoot = defaultQuizBankRoot;
let quizDataDir = resolve(quizBankRoot, 'data');
let quizManifestPath = resolve(quizDataDir, 'quiz-manifest.json');
const whisperJobs = new Map();
const demucsJobs = new Map();
const adminSessions = new Map();
const cleanupTtlMs = 48 * 60 * 60 * 1000;
const cleanupMaxBytes = 3 * 1024 * 1024 * 1024;
let cleanupPromise = null;

const managedCleanupDirs = [
  { key: 'whisper-uploads', label: 'Whisper 上传缓存', path: whisperUploadDir },
  { key: 'whisper-outputs', label: 'Whisper 输出产物', path: whisperOutputRoot },
  { key: 'demucs-uploads', label: 'Demucs 上传缓存', path: demucsUploadDir },
  { key: 'demucs-outputs', label: 'Demucs 输出产物', path: demucsOutputRoot },
];

function setQuizBankRoot(rootPath) {
  const nextRoot = resolve(String(rootPath || '').trim());
  quizBankRoot = nextRoot;
  quizDataDir = resolve(quizBankRoot, 'data');
  quizManifestPath = resolve(quizDataDir, 'quiz-manifest.json');
}

async function readQuizBankRootSetting() {
  try {
    const value = JSON.parse(await readFile(quizBankSettingsPath, 'utf8'));
    return typeof value?.rootPath === 'string' ? value.rootPath.trim() : '';
  } catch {
    return '';
  }
}

async function writeQuizBankRootSetting(rootPath) {
  await mkdir(dirname(quizBankSettingsPath), { recursive: true });
  await writeFile(quizBankSettingsPath, `${JSON.stringify({ rootPath }, null, 2)}\n`, 'utf8');
}

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.m4a': 'audio/mp4',
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

const mediaUploadTypes = {
  audio: {
    extensions: new Map([
      ['.flac', 'audio/flac'],
      ['.m4a', 'audio/mp4'],
      ['.mp3', 'audio/mpeg'],
      ['.ogg', 'audio/ogg'],
      ['.wav', 'audio/wav'],
    ]),
    mimeTypes: new Set(['audio/flac', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-flac', 'audio/x-m4a', 'audio/x-wav']),
  },
  video: {
    extensions: new Map([
      ['.mp4', 'video/mp4'],
      ['.webm', 'video/webm'],
    ]),
    mimeTypes: new Set(['video/mp4', 'video/webm']),
  },
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

function sanitizeQuizId(value) {
  const id = String(value || '').trim();
  if (!/^[\p{L}\p{N}._-]+$/u.test(id)) {
    return '';
  }

  return id;
}

function quizManifestFilePath(file) {
  const normalizedFile = String(file || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalizedFile.startsWith('data/') || extname(normalizedFile).toLocaleLowerCase() !== '.csv') {
    return '';
  }

  const target = resolve(quizBankRoot, normalizedFile);
  return isInsideDir(quizDataDir, target) ? target : '';
}

function quizFileFromName(fileName) {
  const name = basename(String(fileName || '').trim());
  if (!name || name !== String(fileName || '').trim() || extname(name).toLocaleLowerCase() !== '.csv') {
    return '';
  }

  const target = resolve(quizDataDir, name);
  if (!isInsideDir(quizDataDir, target)) {
    return '';
  }

  return `data/${name}`;
}

function parseQuizCsv(text) {
  const rows = [];
  let current = '';
  let row = [];
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === ',' && !insideQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      row.push(current);
      current = '';
      if (row.some((cell) => cell.trim())) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  if (current || row.length) {
    row.push(current);
    if (row.some((cell) => cell.trim())) {
      rows.push(row);
    }
  }

  const [headerRow, ...bodyRows] = rows;
  const header = ['id', 'set', 'title', 'type', 'options', 'answer'];
  if (!headerRow || headerRow.map((item) => item.trim()).join(',') !== header.join(',')) {
    throw new Error('CSV header must be id,set,title,type,options,answer');
  }

  return bodyRows.map((cells, rowIndex) => {
    if (cells.length !== header.length) {
      throw new Error(`CSV row ${rowIndex + 2} must have 6 fields`);
    }

    return Object.fromEntries(header.map((key, index) => [key, cells[index]?.trim() ?? '']));
  });
}

function serializeQuizCsv(questions) {
  const header = ['id', 'set', 'title', 'type', 'options', 'answer'];
  const escapeCell = (value) => {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };

  return [
    header.join(','),
    ...questions.map((question) =>
      header
        .map((key) =>
          escapeCell(
            key === 'options'
              ? question.type === 'judge'
                ? '对|错'
                : question.options.map((option) => `${option.key}.${option.text}`).join('|')
              : question[key],
          ),
        )
        .join(','),
    ),
  ].join('\n');
}

function parseQuizOptions(value) {
  return String(value || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const dotIndex = item.indexOf('.');
      if (dotIndex === -1) {
        return { key: item, text: item };
      }

      return {
        key: item.slice(0, dotIndex).trim(),
        text: item.slice(dotIndex + 1).trim(),
      };
    })
    .filter((item) => item.key && item.text);
}

function normalizeQuizQuestion(input, index, setId) {
  const type = String(input?.type || '').trim();
  const title = String(input?.title || '').trim();
  const answer = String(input?.answer || '').trim();
  const validTypes = new Set(['single', 'multiple', 'judge', 'short']);

  if (!validTypes.has(type)) {
    throw new Error(`Question ${index + 1} type is invalid`);
  }

  if (type === 'short') {
    if (!answer) {
      throw new Error(`Question ${index + 1} short answer is required`);
    }

    return {
      id: String(index + 1),
      set: setId,
      title,
      type,
      options: [],
      answer,
    };
  }

  if (type === 'judge') {
    if (answer !== '对' && answer !== '错') {
      throw new Error(`Question ${index + 1} judge answer must be 对 or 错`);
    }

    return {
      id: String(index + 1),
      set: setId,
      title,
      type,
      options: [
        { key: '对', text: '对' },
        { key: '错', text: '错' },
      ],
      answer,
    };
  }

  const options = Array.isArray(input?.options) ? input.options : parseQuizOptions(input?.options);
  const normalizedOptions = options
    .map((option) => ({
      key: String(option?.key || '').trim(),
      text: String(option?.text || '').trim(),
    }))
    .filter((option) => option.key && option.text);
  const optionKeys = new Set(normalizedOptions.map((option) => option.key));

  if (!normalizedOptions.length) {
    throw new Error(`Question ${index + 1} options are required`);
  }

  if (type === 'single') {
    if (!optionKeys.has(answer)) {
      throw new Error(`Question ${index + 1} answer must match an option key`);
    }

    return {
      id: String(index + 1),
      set: setId,
      title,
      type,
      options: normalizedOptions,
      answer,
    };
  }

  const answers = answer
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .sort();

  if (!answers.length || answers.some((item) => !optionKeys.has(item))) {
    throw new Error(`Question ${index + 1} answers must match option keys`);
  }

  return {
    id: String(index + 1),
    set: setId,
    title,
    type,
    options: normalizedOptions,
    answer: [...new Set(answers)].join(','),
  };
}

function normalizeQuizSet(input, index = 0) {
  const id = sanitizeQuizId(input?.id);
  const file = String(input?.file || '').trim();

  if (!id) {
    throw new Error(`Quiz set ${index + 1} id is invalid`);
  }

  if (!quizManifestFilePath(file)) {
    throw new Error(`Quiz set ${id} file must stay inside data/*.csv`);
  }

  return {
    id,
    title: String(input?.title || id).trim() || id,
    description: String(input?.description || '').trim(),
    badge: String(input?.badge || '题库').trim() || '题库',
    file,
    questionCount: Math.max(0, Number(input?.questionCount) || 0),
  };
}

async function readQuizManifest() {
  try {
    const raw = await readFile(quizManifestPath, 'utf8');
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) {
      throw new Error('Quiz manifest must be an array');
    }

    const seenIds = new Set();
    return value.map((item, index) => {
      const set = normalizeQuizSet(item, index);
      if (seenIds.has(set.id)) {
        throw new Error(`Duplicate quiz set id: ${set.id}`);
      }
      seenIds.add(set.id);
      return set;
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

async function writeQuizManifest(sets) {
  await mkdir(quizDataDir, { recursive: true });
  await writeFile(quizManifestPath, `${JSON.stringify(sets, null, 2)}\n`, 'utf8');
}

async function switchQuizBankRoot(rootPath) {
  const nextRoot = String(rootPath || '').trim();
  if (!nextRoot) {
    throw new Error('Quiz bank root path is required');
  }

  const targetRoot = resolve(nextRoot);
  const rootStat = await stat(targetRoot).catch(() => null);
  if (!rootStat?.isDirectory()) {
    throw new Error('Quiz bank root directory does not exist');
  }

  const previousRoot = quizBankRoot;
  setQuizBankRoot(targetRoot);

  try {
    const sets = await readQuizManifest();
    await writeQuizBankRootSetting(quizBankRoot);
    return sets;
  } catch (error) {
    setQuizBankRoot(previousRoot);
    throw error;
  }
}

async function readQuizQuestions(set) {
  const target = quizManifestFilePath(set.file);
  if (!target) {
    throw new Error('Quiz file path is invalid');
  }

  const rows = parseQuizCsv(await readFile(target, 'utf8'));
  return rows
    .filter((row) => row.set === set.id)
    .map((row, index) => normalizeQuizQuestion({ ...row, options: parseQuizOptions(row.options) }, index, set.id));
}

async function writeQuizQuestions(set, questions) {
  const target = quizManifestFilePath(set.file);
  if (!target) {
    throw new Error('Quiz file path is invalid');
  }

  const normalized = (Array.isArray(questions) ? questions : []).map((question, index) => normalizeQuizQuestion(question, index, set.id));
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${serializeQuizCsv(normalized)}\n`, 'utf8');
  return normalized;
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

function getMediaKey(kind) {
  return kind === 'video' ? 'video' : kind === 'audio' ? 'audio' : '';
}

function normalizeDurationLabel(value) {
  const text = String(value ?? '').trim();
  return text || '00:00';
}

function normalizeMediaMime(value) {
  return String(value || '').split(';')[0].trim().toLocaleLowerCase();
}

function hasOwn(value, key) {
  return Boolean(value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key));
}

function validateMediaUpload(kind, fileName, requestMime, declaredMime) {
  const mediaKey = getMediaKey(kind);
  const config = mediaUploadTypes[mediaKey];

  if (!config) {
    throw new Error('Unsupported media type');
  }

  const safeFileName = sanitizeFilename(fileName || 'media');
  const extension = extname(safeFileName).toLocaleLowerCase();
  const canonicalMime = config.extensions.get(extension);

  if (!canonicalMime) {
    throw new Error('Unsupported file extension');
  }

  const mime = normalizeMediaMime(requestMime === 'application/octet-stream' ? declaredMime : requestMime || declaredMime);
  if (mime && mime !== 'application/octet-stream' && !config.mimeTypes.has(mime)) {
    throw new Error('Unsupported MIME type');
  }

  return {
    fileName: safeFileName,
    type: canonicalMime,
  };
}

function pruneAdminSessions() {
  const now = Date.now();
  for (const [token, expiresAt] of adminSessions.entries()) {
    if (expiresAt <= now) {
      adminSessions.delete(token);
    }
  }
}

function createAdminSession() {
  pruneAdminSessions();
  const token = randomUUID();
  adminSessions.set(token, Date.now() + adminSessionTtlMs);
  return token;
}

function getAdminToken(request) {
  const authorization = String(request.headers.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function requireAdminSession(request, response) {
  pruneAdminSessions();
  const token = getAdminToken(request);

  if (!token) {
    sendJson(response, 401, { message: 'Admin login required' });
    return '';
  }

  if (!adminSessions.has(token)) {
    sendJson(response, 403, { message: 'Invalid admin session' });
    return '';
  }

  adminSessions.set(token, Date.now() + adminSessionTtlMs);
  return token;
}

async function createRuntimeMediaUpload(request, url) {
  const kind = getMediaKey(url.searchParams.get('kind'));
  const titleFallback = basename(String(url.searchParams.get('filename') || 'media'), extname(String(url.searchParams.get('filename') || 'media')));
  const title = normalizeText(url.searchParams.get('title'), titleFallback);
  const id = sanitizeId(`${slugify(title)}-${randomUUID().slice(0, 8)}`);
  const upload = validateMediaUpload(
    kind,
    url.searchParams.get('filename'),
    normalizeMediaMime(request.headers['content-type']),
    normalizeMediaMime(url.searchParams.get('type')),
  );
  const targetDir = kind === 'audio' ? publicMusicsDir : resolve(publicVideosDir, id);
  const targetName = kind === 'audio' ? getUniqueMediaFilename(publicMusicsDir, id, upload.fileName) : `original${extname(upload.fileName).toLocaleLowerCase()}`;
  const target = resolve(targetDir, targetName);

  if (
    !id ||
    (kind === 'audio' && (!isInsideDir(publicMusicsDir, target) || target === publicMusicsDir)) ||
    (kind === 'video' && (!isInsideDir(publicVideosDir, targetDir) || !isInsideDir(targetDir, target)))
  ) {
    throw new Error('Invalid media path');
  }

  await writeRequestBodyToFile(request, target);
  const stats = await stat(target);
  if (stats.size <= 0) {
    await rm(target, { force: true });
    throw new Error('Uploaded file is empty');
  }

  const src = kind === 'audio' ? `/musics/${targetName}` : `/videos/${id}/${targetName}`;
  const item =
    kind === 'audio'
      ? {
          id,
          title,
          artist: normalizeText(url.searchParams.get('artist'), '本地上传'),
          duration: normalizeDurationLabel(url.searchParams.get('duration')),
          src,
          type: upload.type,
          fileName: targetName,
          size: stats.size,
        }
      : {
          id,
          title,
          description: normalizeText(url.searchParams.get('description'), '本地上传视频。'),
          genre: normalizeText(url.searchParams.get('genre'), 'Local Video'),
          duration: normalizeDurationLabel(url.searchParams.get('duration')),
          src,
          sources: [{ src, type: upload.type, label: '上传文件' }],
          fileName: targetName,
          size: stats.size,
        };

  if (kind === 'audio') {
    await appendSourceMusicTrack(item);
  } else {
    await appendSourceVideoItem(item);
  }

  return item;
}

async function updateRuntimeMediaItem(kind, id, body) {
  const mediaKey = getMediaKey(kind);
  const safeId = sanitizeId(id);

  if (!mediaKey || !safeId) {
    return null;
  }

  return mediaKey === 'audio' ? updateSourceMusicTrack(safeId, body) : updateSourceVideoItem(safeId, body);
}

async function deleteRuntimeMediaItem(kind, id) {
  const mediaKey = getMediaKey(kind);
  const safeId = sanitizeId(id);

  if (!mediaKey || !safeId) {
    return false;
  }

  return mediaKey === 'audio' ? deleteSourceMusicTrack(safeId) : deleteSourceVideoItem(safeId);
}

function toTsString(value) {
  return JSON.stringify(String(value ?? ''));
}

function normalizeTsString(value, fallback = '') {
  const text = normalizeText(value, fallback);
  return text || fallback;
}

function getUniqueMediaFilename(root, id, fileName) {
  const extension = extname(fileName).toLocaleLowerCase();
  const name = basename(fileName, extname(fileName)).replace(/[^\p{L}\p{N}._ -]+/gu, '-').trim() || id;
  return `${sanitizeFilename(`${name}-${id}${extension}`)}`;
}

function findArrayLiteral(raw, marker) {
  const markerIndex = raw.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const assignmentIndex = raw.indexOf('=', markerIndex);
  const searchStart = assignmentIndex >= 0 ? assignmentIndex : markerIndex;
  const start = raw.indexOf('[', searchStart);
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '[') {
      depth += 1;
    } else if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        return {
          content: raw.slice(start + 1, index),
          contentStart: start + 1,
          end: index,
        };
      }
    }
  }

  return null;
}

function getTopLevelObjectRanges(content) {
  const ranges = [];
  let depth = 0;
  let quote = '';
  let escaped = false;
  let start = -1;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        start = content.lastIndexOf('\n', index) + 1;
      }
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        ranges.push({ start, end: index + 1, text: content.slice(start, index + 1) });
        start = -1;
      }
    }
  }

  return ranges;
}

function extractStringField(text, field) {
  const match = text.match(new RegExp(`${field}:\\s*(['"])([\\s\\S]*?)\\1`));
  return match ? match[2] : '';
}

function extractPathField(text, field) {
  const direct = extractStringField(text, field);
  if (direct) {
    return direct;
  }

  const asset = text.match(new RegExp(`${field}:\\s*videoAssetPath\\(\\s*(['"])([\\s\\S]*?)\\1\\s*,\\s*(['"])([\\s\\S]*?)\\3\\s*\\)`));
  if (asset) {
    return `/videos/${asset[2]}/${asset[4]}`;
  }

  const thumb = text.match(new RegExp(`${field}:\\s*videoThumbPath\\(\\s*(['"])([\\s\\S]*?)\\1\\s*\\)`));
  if (thumb) {
    return `/videos/${thumb[2]}/thumb.png`;
  }

  const poster = text.match(new RegExp(`${field}:\\s*videoPosterPath\\(\\s*(['"])([\\s\\S]*?)\\1\\s*\\)`));
  return poster ? `/videos/${poster[2]}/poster.png` : '';
}

function parseVideoSources(text) {
  const sources = [];
  const sourcePattern = /videoSource\(\s*(['"])([\s\S]*?)\1\s*,\s*(['"])([\s\S]*?)\3\s*,\s*(['"])([\s\S]*?)\5(?:\s*,\s*(['"])([\s\S]*?)\7)?\s*\)/g;
  let match = sourcePattern.exec(text);

  while (match) {
    sources.push({
      src: `/videos/${match[2]}/${match[4]}`,
      type: match[6],
      quality: match[8],
    });
    match = sourcePattern.exec(text);
  }

  const directSrc = extractPathField(text, 'src');
  if (!sources.length && directSrc) {
    sources.push({
      src: directSrc,
      type: directSrc.toLocaleLowerCase().endsWith('.webm') ? 'video/webm' : 'video/mp4',
    });
  }

  return sources;
}

function parseMusicTrackObject(text) {
  const id = sanitizeId(extractStringField(text, 'id'));
  const src = extractStringField(text, 'src');
  const type = extractStringField(text, 'type');

  if (!id || !src || !type) {
    return null;
  }

  return {
    id,
    title: extractStringField(text, 'title') || id,
    artist: extractStringField(text, 'artist') || '本地上传',
    duration: extractStringField(text, 'duration') || '00:00',
    src,
    type,
  };
}

function parseVideoItemObject(text) {
  const id = sanitizeId(extractStringField(text, 'id'));
  const sources = parseVideoSources(text);
  const src = extractPathField(text, 'src') || sources[0]?.src || '';

  if (!id || !src) {
    return null;
  }

  const item = {
    id,
    title: extractStringField(text, 'title') || id,
    description: extractStringField(text, 'description') || '',
    genre: extractStringField(text, 'genre') || 'Local Video',
    duration: extractStringField(text, 'duration') || '00:00',
    src,
  };
  const poster = extractPathField(text, 'poster');
  const thumbnail = extractPathField(text, 'thumbnail');
  const defaultQuality = extractStringField(text, 'defaultQuality');
  const previewTime = Number(text.match(/previewTime:\s*(\d+(?:\.\d+)?)/)?.[1]);

  if (sources.length) {
    item.sources = sources;
  }
  if (defaultQuality) {
    item.defaultQuality = defaultQuality;
  }
  if (poster) {
    item.poster = poster;
  }
  if (thumbnail) {
    item.thumbnail = thumbnail;
  }
  if (Number.isFinite(previewTime)) {
    item.previewTime = previewTime;
  }

  return item;
}

async function readSourceMediaLibrary() {
  const audio = [];
  const video = [];

  try {
    const raw = await readFile(musicDataPath, 'utf8');
    const block = findArrayLiteral(raw, 'const baseMusicTracks');
    if (block) {
      for (const range of getTopLevelObjectRanges(block.content)) {
        const item = parseMusicTrackObject(range.text);
        if (item) {
          audio.push(item);
        }
      }
    }
  } catch {
    return { audio, video };
  }

  try {
    const raw = await readFile(videoDataPath, 'utf8');
    const block = findArrayLiteral(raw, 'export const videos');
    if (block) {
      for (const range of getTopLevelObjectRanges(block.content)) {
        const item = parseVideoItemObject(range.text);
        if (item) {
          video.push(item);
        }
      }
    }
  } catch {
    return { audio, video };
  }

  return { audio, video };
}

function appendArrayObject(raw, marker, entry) {
  const block = findArrayLiteral(raw, marker);
  if (!block) {
    throw new Error('Unable to find media list');
  }

  const prefix = raw.slice(0, block.end).replace(/\s*$/, '');
  const separator = prefix.trimEnd().endsWith('[') || prefix.trimEnd().endsWith(',') ? '\n' : ',\n';
  return `${prefix}${separator}${entry}\n${raw.slice(block.end)}`;
}

function findObjectInArray(raw, marker, id) {
  const block = findArrayLiteral(raw, marker);
  if (!block) {
    return null;
  }

  for (const range of getTopLevelObjectRanges(block.content)) {
    if (extractStringField(range.text, 'id') === id) {
      return {
        ...range,
        absoluteStart: block.contentStart + range.start,
        absoluteEnd: block.contentStart + range.end,
      };
    }
  }

  return null;
}

function updateObjectStringField(objectText, field, value) {
  const safeValue = normalizeTsString(value);
  const fieldPattern = new RegExp(`(\\n\\s*${field}:\\s*)(['"])([\\s\\S]*?)(\\2)(\\s*,)`);

  if (fieldPattern.test(objectText)) {
    return objectText.replace(fieldPattern, `$1${toTsString(safeValue)}$5`);
  }

  return objectText.replace(/\n\s*}$/, `\n    ${field}: ${toTsString(safeValue)},\n  }`);
}

function removeObjectFromArray(raw, objectRange) {
  let start = objectRange.absoluteStart;
  let end = objectRange.absoluteEnd;
  const afterComma = raw.slice(end).match(/^\s*,\s*\r?\n?/);

  if (afterComma) {
    end += afterComma[0].length;
  } else {
    const beforeComma = raw.slice(0, start).match(/,\s*\r?\n?\s*$/);
    if (beforeComma) {
      start -= beforeComma[0].length;
    }
  }

  return `${raw.slice(0, start)}${raw.slice(end)}`;
}

function composeMusicTrackEntry(item) {
  return `  {
    id: ${toTsString(item.id)},
    title: ${toTsString(item.title)},
    artist: ${toTsString(item.artist)},
    duration: ${toTsString(item.duration)},
    src: ${toTsString(item.src)},
    type: ${toTsString(item.type)},
  },`;
}

function composeVideoItemEntry(item, fileName) {
  return `  {
    id: ${toTsString(item.id)},
    title: ${toTsString(item.title)},
    description: ${toTsString(item.description)},
    genre: ${toTsString(item.genre)},
    duration: ${toTsString(item.duration)},
    src: videoAssetPath(${toTsString(item.id)}, ${toTsString(fileName)}),
  },`;
}

async function appendSourceMusicTrack(item) {
  const raw = await readFile(musicDataPath, 'utf8');
  if (findObjectInArray(raw, 'const baseMusicTracks', item.id)) {
    throw new Error('Music track already exists');
  }

  await writeFile(musicDataPath, appendArrayObject(raw, 'const baseMusicTracks', composeMusicTrackEntry(item)), 'utf8');
}

async function appendSourceVideoItem(item) {
  const raw = await readFile(videoDataPath, 'utf8');
  if (findObjectInArray(raw, 'export const videos', item.id)) {
    throw new Error('Video item already exists');
  }

  await writeFile(videoDataPath, appendArrayObject(raw, 'export const videos', composeVideoItemEntry(item, basename(item.src))), 'utf8');
}

async function updateSourceMusicTrack(id, body) {
  const raw = await readFile(musicDataPath, 'utf8');
  const range = findObjectInArray(raw, 'const baseMusicTracks', id);

  if (!range) {
    return null;
  }

  let next = range.text;
  if (hasOwn(body, 'title')) {
    next = updateObjectStringField(next, 'title', normalizeText(body.title, id));
  }
  if (hasOwn(body, 'artist')) {
    next = updateObjectStringField(next, 'artist', normalizeText(body.artist, '本地上传'));
  }
  if (hasOwn(body, 'duration')) {
    next = updateObjectStringField(next, 'duration', normalizeDurationLabel(body.duration));
  }

  await writeFile(musicDataPath, `${raw.slice(0, range.absoluteStart)}${next}${raw.slice(range.absoluteEnd)}`, 'utf8');
  return (await readSourceMediaLibrary()).audio.find((item) => item.id === id) || null;
}

async function updateSourceVideoItem(id, body) {
  const raw = await readFile(videoDataPath, 'utf8');
  const range = findObjectInArray(raw, 'export const videos', id);

  if (!range) {
    return null;
  }

  let next = range.text;
  if (hasOwn(body, 'title')) {
    next = updateObjectStringField(next, 'title', normalizeText(body.title, id));
  }
  if (hasOwn(body, 'description')) {
    next = updateObjectStringField(next, 'description', normalizeText(body.description));
  }
  if (hasOwn(body, 'genre')) {
    next = updateObjectStringField(next, 'genre', normalizeText(body.genre, 'Local Video'));
  }
  if (hasOwn(body, 'duration')) {
    next = updateObjectStringField(next, 'duration', normalizeDurationLabel(body.duration));
  }

  await writeFile(videoDataPath, `${raw.slice(0, range.absoluteStart)}${next}${raw.slice(range.absoluteEnd)}`, 'utf8');
  return (await readSourceMediaLibrary()).video.find((item) => item.id === id) || null;
}

function resolvePublicMediaPath(src) {
  const text = String(src || '');
  if (text.startsWith('/musics/')) {
    const target = resolve(publicMusicsDir, decodeURIComponent(text.replace(/^\/musics\/?/, '')));
    return isInsideDir(publicMusicsDir, target) ? target : '';
  }

  if (text.startsWith('/videos/')) {
    const target = resolve(publicVideosDir, decodeURIComponent(text.replace(/^\/videos\/?/, '')));
    return isInsideDir(publicVideosDir, target) ? target : '';
  }

  return '';
}

async function deleteSourceMusicTrack(id) {
  const raw = await readFile(musicDataPath, 'utf8');
  const range = findObjectInArray(raw, 'const baseMusicTracks', id);

  if (!range) {
    return false;
  }

  const item = parseMusicTrackObject(range.text);
  await writeFile(musicDataPath, removeObjectFromArray(raw, range), 'utf8');

  const file = resolvePublicMediaPath(item?.src);
  if (file) {
    await rm(file, { force: true });
  }

  return true;
}

async function deleteSourceVideoItem(id) {
  const raw = await readFile(videoDataPath, 'utf8');
  const range = findObjectInArray(raw, 'export const videos', id);

  if (!range) {
    return false;
  }

  const item = parseVideoItemObject(range.text);
  await writeFile(videoDataPath, removeObjectFromArray(raw, range), 'utf8');

  const file = resolvePublicMediaPath(item?.src);
  const targetDir = file ? dirname(file) : resolve(publicVideosDir, id);
  if (isInsideDir(publicVideosDir, targetDir)) {
    await rm(targetDir, { recursive: true, force: true });
  }

  return true;
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

const museumProgressStatuses = new Set(['none', 'wishlist', 'playing', 'completed']);

const defaultMuseumData = {
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
      cover: '/images/museum/fatal-frame/cover.png',
      videoIds: [],
      musicIds: [],
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
      cover: '/images/museum/crimson-butterfly-remake/cover.png',
      videoIds: ['crimson-butterfly-remake-canyang', 'crimson-butterfly-remake-yueding', 'crimson-butterfly-remake-mijia', 'crimson-butterfly-remake-uka'],
      musicIds: ['chou-amano-tsukiko'],
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
      cover: '/images/museum/tattooed-voice/cover.png',
      videoIds: ['tattooed-voice-koe-mv', 'fatal-frame-tattooed-voice'],
      musicIds: ['koe-amano-tsukiko'],
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
      cover: '/images/museum/mask-of-lunar-eclipse/cover.png',
      videoIds: [],
      musicIds: ['Yueshou-song-Minazuki Ruka'],
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
      cover: '/images/museum/maiden-of-black-water/cover.png',
      videoIds: ['maiden-black-water-famous-scene', 'maiden-black-water-yuri-bride', 'maiden-black-water-torikago-mv', 'maiden-black-water-higanbana-mv'],
      musicIds: ['torikago-in-this-cage-amano-tsuki', 'anju-higanbana'],
    },
  ],
  progress: {},
};

function normalizeText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function normalizeTextList(value) {
  return Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean)
    : [];
}

function normalizeMuseumWork(value, index) {
  const id = sanitizeId(normalizeText(value?.id)) || `work-${index + 1}`;
  const year = Number(value?.year);

  return {
    id,
    title: normalizeText(value?.title, id),
    aliases: normalizeTextList(value?.aliases),
    latestVersion: normalizeText(value?.latestVersion, '资料条目'),
    year: Number.isInteger(year) ? year : 2000,
    summary: normalizeText(value?.summary),
    spoilerSummary: normalizeText(value?.spoilerSummary),
    tags: normalizeTextList(value?.tags),
    cover: normalizeText(value?.cover),
    videoIds: normalizeTextList(value?.videoIds),
    musicIds: normalizeTextList(value?.musicIds),
  };
}

function normalizeMuseumProgress(value) {
  const status = museumProgressStatuses.has(value?.status) ? value.status : 'none';

  return {
    status,
    favorite: Boolean(value?.favorite),
    note: normalizeText(value?.note),
  };
}

function normalizeMuseumData(value) {
  const source = value && typeof value === 'object' ? value : defaultMuseumData;
  const rawWorks = Array.isArray(source.works) && source.works.length ? source.works : defaultMuseumData.works;
  const works = rawWorks.map(normalizeMuseumWork);
  const knownWorkIds = new Set(works.map((work) => work.id));
  const progress = {};

  if (source.progress && typeof source.progress === 'object') {
    for (const [workId, item] of Object.entries(source.progress)) {
      if (knownWorkIds.has(workId)) {
        progress[workId] = normalizeMuseumProgress(item);
      }
    }
  }

  return {
    works,
    progress,
    updatedAt: normalizeText(source.updatedAt),
  };
}

async function readMuseumData() {
  try {
    return normalizeMuseumData(JSON.parse(await readFile(museumDataPath, 'utf8')));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return normalizeMuseumData(defaultMuseumData);
    }

    throw error;
  }
}

async function writeMuseumData(value) {
  const museum = {
    ...normalizeMuseumData(value),
    updatedAt: new Date().toISOString(),
  };

  await mkdir(dirname(museumDataPath), { recursive: true });
  await writeFile(museumDataPath, JSON.stringify(museum, null, 2), 'utf8');
  return museum;
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

async function handleMediaApi(request, response, url) {
  if (url.pathname === '/api/media/library' && request.method === 'GET') {
    sendJson(response, 200, { library: await readSourceMediaLibrary() });
    return;
  }

  if (url.pathname === '/api/media/admin/login' && request.method === 'POST') {
    try {
      const body = await readJsonBody(request);
      if (String(body.password || '') !== adminPassword) {
        sendJson(response, 403, { message: 'Invalid admin password' });
        return;
      }

      sendJson(response, 200, { token: createAdminSession(), expiresInMs: adminSessionTtlMs });
    } catch {
      sendJson(response, 400, { message: 'Unable to login' });
    }
    return;
  }

  if (url.pathname === '/api/media/admin/session' && request.method === 'GET') {
    const token = requireAdminSession(request, response);
    if (token) {
      sendJson(response, 200, { ok: true, expiresInMs: adminSessionTtlMs });
    }
    return;
  }

  if (url.pathname === '/api/media/admin/upload' && request.method === 'POST') {
    if (!requireAdminSession(request, response)) {
      return;
    }

    try {
      const item = await createRuntimeMediaUpload(request, url);
      sendJson(response, 201, { item, library: await readSourceMediaLibrary() });
    } catch (error) {
      sendJson(response, 400, { message: error.message || 'Unable to upload media' });
    }
    return;
  }

  const match = url.pathname.match(/^\/api\/media\/admin\/(audio|video)\/([^/]+)$/);
  if (match && (request.method === 'PUT' || request.method === 'PATCH')) {
    if (!requireAdminSession(request, response)) {
      return;
    }

    try {
      const item = await updateRuntimeMediaItem(match[1], decodeURIComponent(match[2]), await readJsonBody(request));
      if (!item) {
        sendJson(response, 404, { message: 'Media item not found' });
        return;
      }

      sendJson(response, 200, { item, library: await readSourceMediaLibrary() });
    } catch (error) {
      sendJson(response, 400, { message: error.message || 'Unable to update media' });
    }
    return;
  }

  if (match && request.method === 'DELETE') {
    if (!requireAdminSession(request, response)) {
      return;
    }

    try {
      const deleted = await deleteRuntimeMediaItem(match[1], decodeURIComponent(match[2]));
      if (!deleted) {
        sendJson(response, 404, { message: 'Media item not found' });
        return;
      }

      sendJson(response, 200, { ok: true, library: await readSourceMediaLibrary() });
    } catch (error) {
      sendJson(response, 400, { message: error.message || 'Unable to delete media' });
    }
    return;
  }

  sendJson(response, 404, { message: 'Media API not found' });
}

async function handleMuseumApi(request, response, url) {
  if (url.pathname === '/api/museum' && request.method === 'GET') {
    sendJson(response, 200, { museum: await readMuseumData() });
    return;
  }

  if (url.pathname === '/api/museum' && request.method === 'PUT') {
    try {
      const body = await readJsonBody(request);
      sendJson(response, 200, { museum: await writeMuseumData(body.museum ?? body) });
    } catch (error) {
      sendJson(response, 400, { message: error.message || 'Unable to save museum data' });
    }
    return;
  }

  sendJson(response, 404, { message: 'Museum API not found' });
}

async function handleQuizApi(request, response, url) {
  try {
    if (url.pathname === '/api/quiz/root') {
      if (request.method === 'GET') {
        sendJson(response, 200, { rootPath: quizBankRoot });
        return;
      }

      if (request.method === 'PUT') {
        const body = await readJsonBody(request);
        const sets = await switchQuizBankRoot(body.rootPath ?? body.path);
        sendJson(response, 200, { rootPath: quizBankRoot, sets });
        return;
      }

      sendJson(response, 405, { message: 'Method not allowed' });
      return;
    }

    if (url.pathname === '/api/quiz/sets' && request.method === 'GET') {
      sendJson(response, 200, { rootPath: quizBankRoot, sets: await readQuizManifest() });
      return;
    }

    if (url.pathname === '/api/quiz/sets' && request.method === 'POST') {
      const body = await readJsonBody(request);
      const source = body.set ?? body;
      const sets = await readQuizManifest();
      const id = sanitizeQuizId(source?.id);

      if (!id) {
        sendJson(response, 400, { message: 'Quiz set id is invalid' });
        return;
      }

      if (sets.some((set) => set.id === id)) {
        sendJson(response, 400, { message: 'Quiz set id already exists' });
        return;
      }

      const file = quizFileFromName(source?.fileName || basename(source?.file || `${id}.csv`));
      if (!file) {
        sendJson(response, 400, { message: 'Quiz csv file name is invalid' });
        return;
      }

      const target = quizManifestFilePath(file);
      try {
        await stat(target);
        sendJson(response, 400, { message: 'Quiz csv file already exists' });
        return;
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      const set = normalizeQuizSet({
        id,
        title: source?.title,
        description: source?.description,
        badge: source?.badge,
        file,
        questionCount: 0,
      });
      const questions = await writeQuizQuestions(set, body.questions);
      const nextSet = { ...set, questionCount: questions.length };
      await writeQuizManifest([...sets, nextSet]);
      sendJson(response, 201, { set: nextSet, questions });
      return;
    }

    if (url.pathname.startsWith('/api/quiz/sets/')) {
      const id = sanitizeQuizId(decodeURIComponent(url.pathname.replace(/^\/api\/quiz\/sets\/?/, '').replace(/\/$/, '')));
      const sets = await readQuizManifest();
      const set = sets.find((item) => item.id === id);

      if (!id || !set) {
        sendJson(response, 404, { message: 'Quiz set not found' });
        return;
      }

      if (request.method === 'GET') {
        sendJson(response, 200, { set, questions: await readQuizQuestions(set) });
        return;
      }

      if (request.method === 'PUT') {
        const body = await readJsonBody(request);
        const source = body.set ?? body;
        const nextSet = normalizeQuizSet({
          ...set,
          title: source?.title ?? set.title,
          description: source?.description ?? set.description,
          badge: source?.badge ?? set.badge,
          questionCount: 0,
        });
        const questions = await writeQuizQuestions(nextSet, body.questions);
        const savedSet = { ...nextSet, questionCount: questions.length };
        await writeQuizManifest(sets.map((item) => (item.id === id ? savedSet : item)));
        sendJson(response, 200, { set: savedSet, questions });
        return;
      }

      if (request.method === 'DELETE') {
        const target = quizManifestFilePath(set.file);
        if (!target) {
          sendJson(response, 400, { message: 'Quiz file path is invalid' });
          return;
        }

        await rm(target, { force: true });
        await writeQuizManifest(sets.filter((item) => item.id !== id));
        sendJson(response, 200, { ok: true });
        return;
      }

      sendJson(response, 405, { message: 'Method not allowed' });
      return;
    }

    sendJson(response, 404, { message: 'Quiz API not found' });
  } catch (error) {
    sendJson(response, 400, { message: error.message || 'Quiz API request failed' });
  }
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

function getFileEtag(stats) {
  return `"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`;
}

function matchesEtag(request, etag) {
  const value = request.headers['if-none-match'];
  if (typeof value !== 'string') {
    return false;
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .some((item) => item === '*' || item === etag);
}

function sendFile(request, response, file, stats) {
  const contentType = mimeTypes[extname(file)] || 'application/octet-stream';
  const etag = getFileEtag(stats);
  const cacheHeaders = {
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=0, must-revalidate',
    etag,
    'last-modified': stats.mtime.toUTCString(),
  };
  const range = request.headers.range;

  if (!range && matchesEtag(request, etag)) {
    response.writeHead(304, cacheHeaders);
    response.end();
    return;
  }

  if (range && stats.size > 0) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);

    if (match) {
      const suffixLength = match[1] === '' ? Number(match[2]) : 0;
      const start = match[1] === '' ? Math.max(stats.size - suffixLength, 0) : Number(match[1]);
      const end = match[2] === '' || match[1] === '' ? stats.size - 1 : Math.min(Number(match[2]), stats.size - 1);

      if (Number.isFinite(start) && Number.isFinite(end) && start <= end && start < stats.size) {
        response.writeHead(206, {
          ...cacheHeaders,
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
      ...cacheHeaders,
      'content-range': `bytes */${stats.size}`,
    });
    response.end();
    return;
  }

  response.writeHead(200, {
    ...cacheHeaders,
    'content-length': stats.size,
    'content-type': contentType,
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  createReadStream(file).pipe(response);
}

async function servePublicMedia(request, response, pathname) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 405, { message: 'Method not allowed' });
    return;
  }

  const isMusic = pathname.startsWith('/musics/');
  const root = isMusic ? publicMusicsDir : publicVideosDir;
  const relativePath = decodeURIComponent(pathname.replace(isMusic ? /^\/musics\/?/ : /^\/videos\/?/, ''));
  const target = resolve(root, relativePath);

  if (!isInsideDir(root, target)) {
    sendJson(response, 404, { message: 'Media file not found' });
    return;
  }

  try {
    const fileStats = await stat(target);
    if (!fileStats.isFile()) {
      await serveStatic(request, response, pathname);
      return;
    }

    sendFile(request, response, target, fileStats);
  } catch {
    await serveStatic(request, response, pathname);
  }
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

    if (url.pathname.startsWith('/api/media')) {
      await handleMediaApi(request, response, url);
      return;
    }

    if (url.pathname.startsWith('/api/music')) {
      await handleMusicApi(request, response, url);
      return;
    }

    if (url.pathname.startsWith('/api/museum')) {
      await handleMuseumApi(request, response, url);
      return;
    }

    if (url.pathname.startsWith('/api/quiz')) {
      await handleQuizApi(request, response, url);
      return;
    }

    if (url.pathname.startsWith('/api/storage')) {
      await handleStorageApi(request, response, url);
      return;
    }

    if (url.pathname.startsWith('/musics/') || url.pathname.startsWith('/videos/')) {
      await servePublicMedia(request, response, url.pathname);
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
