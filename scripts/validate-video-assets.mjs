import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const videosPath = resolve(appRoot, 'src', 'data', 'videos.ts');
const publicVideosRoot = resolve(appRoot, 'public', 'videos');
const source = readFileSync(videosPath, 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});
const exportsObject = {};
const sandbox = {
  exports: exportsObject,
  module: { exports: exportsObject },
};

vm.runInNewContext(output.outputText, sandbox, { filename: videosPath });

const videos = sandbox.module.exports.videos ?? sandbox.exports.videos;

if (!Array.isArray(videos)) {
  console.error('src/data/videos.ts did not export a videos array.');
  process.exit(1);
}

const errors = [];
const ids = new Set();

function isInsidePublicVideos(target) {
  const path = relative(publicVideosRoot, target);
  return path === '' || (!path.startsWith('..') && !isAbsolute(path));
}

function checkPublicVideoPath(video, field, value) {
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(`${video.id}: ${field} is empty.`);
    return;
  }

  if (!value.startsWith('/videos/')) {
    errors.push(`${video.id}: ${field} must start with /videos/: ${value}`);
    return;
  }

  const target = resolve(appRoot, 'public', value.replace(/^\//, ''));
  if (!isInsidePublicVideos(target)) {
    errors.push(`${video.id}: ${field} escapes public/videos: ${value}`);
    return;
  }

  if (!existsSync(target)) {
    errors.push(`${video.id}: missing ${field}: ${value}`);
  }
}

for (const video of videos) {
  if (!video || typeof video.id !== 'string' || !video.id.trim()) {
    errors.push('A video item is missing id.');
    continue;
  }

  if (ids.has(video.id)) {
    errors.push(`${video.id}: duplicate id.`);
  }
  ids.add(video.id);

  checkPublicVideoPath(video, 'poster', video.poster);
  checkPublicVideoPath(video, 'thumbnail', video.thumbnail);

  if (Array.isArray(video.sources) && video.sources.length > 0) {
    video.sources.forEach((sourceItem, index) => {
      checkPublicVideoPath(video, `sources[${index}].src`, sourceItem?.src);
    });
    continue;
  }

  checkPublicVideoPath(video, 'src', video.src);
}

if (errors.length > 0) {
  console.error(`Video asset validation failed with ${errors.length} issue(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Video asset validation passed for ${videos.length} item(s).`);
