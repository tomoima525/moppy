import { extractPdfContent, PdfContent, PdfExtractionOptions } from './pdf-source.js';
import {
  extractWebContent,
  WebContent,
  WebExtractionOptions,
  closeBrowser,
} from './web-source.js';
import { isUrl, isPdf } from '../utils/file.js';
import path from 'path';

export type SourceContent = PdfSourceContent | WebSourceContent;

export interface PdfSourceContent {
  type: 'pdf';
  sourcePath: string;
  content: PdfContent;
}

export interface WebSourceContent {
  type: 'web';
  sourceUrl: string;
  content: WebContent;
}

export interface SourceLoadOptions {
  outputDir?: string;
  renderPages?: boolean;
  captureScreenshots?: boolean;
}

export async function loadSource(
  source: string,
  options: SourceLoadOptions = {}
): Promise<SourceContent> {
  const { outputDir = './slides/assets' } = options;

  if (isUrl(source)) {
    const webOptions: WebExtractionOptions = {
      outputDir,
      captureScreenshots: options.captureScreenshots ?? true,
    };
    const content = await extractWebContent(source, webOptions);
    return {
      type: 'web',
      sourceUrl: source,
      content,
    };
  }

  if (isPdf(source)) {
    const pdfOptions: PdfExtractionOptions = {
      outputDir,
      renderPages: options.renderPages ?? true,
    };
    const content = await extractPdfContent(path.resolve(source), pdfOptions);
    return {
      type: 'pdf',
      sourcePath: source,
      content,
    };
  }

  throw new Error(`Unsupported source type: ${source}. Provide a PDF file or URL.`);
}

export async function loadMultipleSources(
  sources: string[],
  options: SourceLoadOptions = {}
): Promise<SourceContent[]> {
  const results: SourceContent[] = [];

  for (const source of sources) {
    const content = await loadSource(source, options);
    results.push(content);
  }

  return results;
}

export { closeBrowser };
export type { PdfContent, WebContent, PdfExtractionOptions, WebExtractionOptions };
