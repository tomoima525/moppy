import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import pdfParse from 'pdf-parse';
import * as pdfjs from 'pdfjs-dist';
import { createCanvas } from 'canvas';
import { generateUniqueFilename, saveBuffer } from '../utils/file.js';

// ESM compatibility
const require = createRequire(import.meta.url);

// Set up PDF.js worker
const pdfjsPath = path.dirname(require.resolve('pdfjs-dist/package.json'));
pdfjs.GlobalWorkerOptions.workerSrc = path.join(
  pdfjsPath,
  'build',
  'pdf.worker.mjs'
);

export interface PdfContent {
  text: string;
  pageCount: number;
  pages: PageContent[];
  metadata: PdfMetadata;
}

export interface PageContent {
  pageNumber: number;
  text: string;
  imagePath?: string;
}

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
}

export interface PdfExtractionOptions {
  renderPages?: boolean;
  outputDir?: string;
  scale?: number;
  pageRange?: { start: number; end: number };
}

export async function extractPdfContent(
  pdfPath: string,
  options: PdfExtractionOptions = {}
): Promise<PdfContent> {
  const { renderPages = true, outputDir = './slides/assets', scale = 2.0 } = options;

  const pdfBuffer = await fs.readFile(pdfPath);

  // Extract text using pdf-parse
  const parsed = await pdfParse(pdfBuffer);

  // Load document with pdfjs for page-by-page processing
  const loadingTask = pdfjs.getDocument({ data: pdfBuffer });
  const pdfDoc = await loadingTask.promise;

  const pageCount = pdfDoc.numPages;
  const pages: PageContent[] = [];

  const startPage = options.pageRange?.start ?? 1;
  const endPage = Math.min(options.pageRange?.end ?? pageCount, pageCount);

  for (let i = startPage; i <= endPage; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');

    const pageContent: PageContent = {
      pageNumber: i,
      text: pageText,
    };

    // Render page as image if requested
    if (renderPages && outputDir) {
      await fs.ensureDir(outputDir);
      const imagePath = await renderPageAsImage(page, outputDir, i, scale);
      pageContent.imagePath = imagePath;
    }

    pages.push(pageContent);
  }

  return {
    text: parsed.text,
    pageCount,
    pages,
    metadata: {
      title: parsed.info?.Title,
      author: parsed.info?.Author,
      subject: parsed.info?.Subject,
      keywords: parsed.info?.Keywords,
    },
  };
}

async function renderPageAsImage(
  page: pdfjs.PDFPageProxy,
  outputDir: string,
  pageNumber: number,
  scale: number
): Promise<string> {
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');

  await page.render({
    // Cast to any to avoid type mismatch between canvas library and pdfjs-dist types
    canvasContext: context as any,
    viewport,
  }).promise;

  const buffer = canvas.toBuffer('image/png');
  const filename = generateUniqueFilename(`page-${pageNumber}`, '.png');
  return saveBuffer(buffer, outputDir, filename);
}

export async function extractPdfImages(
  pdfPath: string,
  outputDir: string
): Promise<string[]> {
  // This is a simplified implementation
  // Full image extraction from PDF requires more complex parsing
  const content = await extractPdfContent(pdfPath, {
    renderPages: true,
    outputDir,
  });

  return content.pages
    .filter((p) => p.imagePath)
    .map((p) => p.imagePath!);
}
