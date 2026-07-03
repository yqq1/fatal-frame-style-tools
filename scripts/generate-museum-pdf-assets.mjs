import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import createQpdfModule from '@neslinesli93/qpdf-wasm';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePdf = resolve(appRoot, 'public/documents/museum/zero-guide-culture-95-199.pdf');

const items = [
  {
    id: 'fatal-frame',
    file: 'fatal-frame-culture.pdf',
    pageStart: 3,
    pageEnd: 24,
  },
  {
    id: 'crimson-butterfly-remake',
    file: 'crimson-butterfly-culture.pdf',
    pageStart: 25,
    pageEnd: 48,
  },
  {
    id: 'tattooed-voice',
    file: 'tattooed-voice-culture.pdf',
    pageStart: 49,
    pageEnd: 75,
  },
  {
    id: 'mask-of-lunar-eclipse',
    file: 'mask-of-lunar-eclipse-culture.pdf',
    pageStart: 76,
    pageEnd: 85,
  },
  {
    id: 'maiden-of-black-water',
    file: 'maiden-of-black-water-culture.pdf',
    pageStart: 86,
    pageEnd: 103,
  },
];

async function splitPdf(sourceBytes) {
  const qpdf = await createQpdfModule({
    locateFile: () => resolve(appRoot, 'node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.wasm'),
    noInitialRun: true,
  });
  const inputPath = '/museum-source.pdf';
  qpdf.FS.writeFile(inputPath, new Uint8Array(sourceBytes));

  for (const item of items) {
    const outputPath = `/${item.file}`;
    const target = resolve(appRoot, 'public/documents/museum', item.file);
    qpdf.callMain([inputPath, '--pages', '.', `${item.pageStart}-${item.pageEnd}`, '--', outputPath]);
    await writeFile(target, qpdf.FS.readFile(outputPath));
    console.log(`wrote ${target}`);
  }
}

async function renderCover(item) {
  const pdfBytes = await readFile(sourcePdf);
  const loadingTask = pdfjsLib.getDocument({
    cMapPacked: true,
    cMapUrl: `${resolve(appRoot, 'node_modules/pdfjs-dist/cmaps')}/`,
    data: new Uint8Array(pdfBytes),
    standardFontDataUrl: `${resolve(appRoot, 'node_modules/pdfjs-dist/standard_fonts')}/`,
    useSystemFonts: true,
  });
  const pdfDocument = await loadingTask.promise;
  const page = await pdfDocument.getPage(item.pageStart);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = 1080 / baseViewport.width;
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
  const context = canvas.getContext('2d');

  context.fillStyle = '#120d0b';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;

  const target = resolve(appRoot, 'public/images/museum', item.id, 'pdf-cover.png');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, canvas.toBuffer('image/png'));
  await pdfDocument.cleanup();
  await loadingTask.destroy();
  console.log(`wrote ${target}`);
}

const sourceBytes = await readFile(sourcePdf);
await splitPdf(sourceBytes);

for (const item of items) {
  await renderCover(item);
}
