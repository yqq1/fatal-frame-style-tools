import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicVideosRoot = resolve(appRoot, 'public', 'videos');
const videosPath = resolve(appRoot, 'src', 'data', 'videos.ts');
const supportedTypes = new Map([
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
]);

function printUsage() {
  console.error('Usage: npm run import:videos -- "<video-directory>"');
}

function tsString(value) {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function normalizeTitle(filename) {
  return basename(filename, extname(filename)).replace(/\s+/g, ' ').trim();
}

function makeId(title) {
  const hash = createHash('sha1').update(title).digest('hex').slice(0, 8);
  const slug = title
    .normalize('NFKD')
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/-+$/g, '');

  return `${slug || 'video'}-${hash}`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '00:00';
  }

  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: appRoot,
    encoding: 'utf8',
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(output || `${command} exited with ${result.status}`);
  }

  return result;
}

function readDuration(videoPath) {
  const result = run('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=nw=1:nk=1',
    videoPath,
  ]);
  return Number.parseFloat(result.stdout.trim());
}

function createThumbnail(videoPath, thumbPath, duration) {
  const seekSeconds = Math.max(1, Math.floor((Number.isFinite(duration) ? duration : 0) * 0.4));
  run('ffmpeg', [
    '-y',
    '-v',
    'warning',
    '-ss',
    String(seekSeconds),
    '-i',
    videoPath,
    '-frames:v',
    '1',
    '-update',
    '1',
    '-vf',
    'scale=480:-1',
    thumbPath,
  ]);
}

function getExistingIds(source) {
  return new Set([...source.matchAll(/id:\s*'([^']+)'/g)].map((match) => match[1]));
}

function makeVideoEntry({ id, title, duration, assetName }) {
  return [
    '',
    '  {',
    `    id: ${tsString(id)},`,
    `    title: ${tsString(title)},`,
    `    description: ${tsString(`${title}本地视频。`)},`,
    "    genre: 'Fatal Frame, Local Video',",
    `    duration: ${tsString(duration)},`,
    `    src: videoAssetPath(${tsString(id)}, ${tsString(assetName)}),`,
    `    poster: videoThumbPath(${tsString(id)}),`,
    `    thumbnail: videoThumbPath(${tsString(id)}),`,
    '    previewTime: 6,',
    '  },',
  ].join('\n');
}

function appendEntries(entries) {
  if (entries.length === 0) {
    return;
  }

  const source = readFileSync(videosPath, 'utf8');
  const insertAt = source.lastIndexOf('\n];');
  if (insertAt === -1) {
    throw new Error('Could not find the videos array closing marker in src/data/videos.ts.');
  }

  writeFileSync(videosPath, `${source.slice(0, insertAt)}${entries.join('')}${source.slice(insertAt)}`, 'utf8');
}

function validateVideos() {
  run(process.execPath, [resolve(appRoot, 'scripts', 'validate-video-assets.mjs')], { stdio: 'inherit' });
}

function main() {
  const inputArg = process.argv[2];
  if (!inputArg) {
    printUsage();
    process.exit(1);
  }

  const inputDir = resolve(process.cwd(), inputArg);
  if (!existsSync(inputDir) || !statSync(inputDir).isDirectory()) {
    throw new Error(`Input directory does not exist: ${inputDir}`);
  }

  const source = readFileSync(videosPath, 'utf8');
  const existingIds = getExistingIds(source);
  const importedEntries = [];
  const files = readdirSync(inputDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && supportedTypes.has(extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'));

  if (files.length === 0) {
    console.log(`No supported video files found in ${inputDir}.`);
    validateVideos();
    return;
  }

  for (const filename of files) {
    const extension = extname(filename).toLowerCase();
    const title = normalizeTitle(filename);
    const id = makeId(title);

    if (existingIds.has(id)) {
      console.log(`Skipped existing video: ${title} (${id})`);
      continue;
    }

    const inputPath = join(inputDir, filename);
    const targetDir = join(publicVideosRoot, id);
    const assetName = `original${extension}`;
    const targetVideoPath = join(targetDir, assetName);
    const targetThumbPath = join(targetDir, 'thumb.png');

    mkdirSync(targetDir, { recursive: true });
    copyFileSync(inputPath, targetVideoPath);

    const durationSeconds = readDuration(targetVideoPath);
    createThumbnail(targetVideoPath, targetThumbPath, durationSeconds);

    existingIds.add(id);
    importedEntries.push(makeVideoEntry({
      id,
      title,
      duration: formatDuration(durationSeconds),
      assetName,
    }));
    console.log(`Imported: ${title} (${id})`);
  }

  appendEntries(importedEntries);
  validateVideos();
  console.log(`Imported ${importedEntries.length} video item(s).`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
