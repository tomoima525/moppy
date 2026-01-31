import fs from 'fs-extra';
import path from 'path';
import { generateUniqueFilename } from '../utils/file.js';

export interface ExtractedImage {
  path: string;
  type: 'chart' | 'table' | 'diagram' | 'photo' | 'screenshot' | 'unknown';
  description?: string;
  pageNumber?: number;
}

export interface ImageExtractionResult {
  images: ExtractedImage[];
  totalExtracted: number;
}

export async function organizeExtractedImages(
  imagePaths: string[],
  outputDir: string
): Promise<ImageExtractionResult> {
  await fs.ensureDir(outputDir);

  const images: ExtractedImage[] = [];

  for (const imagePath of imagePaths) {
    if (await fs.pathExists(imagePath)) {
      const ext = path.extname(imagePath);
      const newFilename = generateUniqueFilename('image', ext);
      const newPath = path.join(outputDir, newFilename);

      // If image is not already in output dir, copy it
      if (path.dirname(imagePath) !== outputDir) {
        await fs.copy(imagePath, newPath);
      }

      images.push({
        path: newPath,
        type: classifyImage(imagePath),
      });
    }
  }

  return {
    images,
    totalExtracted: images.length,
  };
}

function classifyImage(imagePath: string): ExtractedImage['type'] {
  const filename = path.basename(imagePath).toLowerCase();

  if (filename.includes('chart') || filename.includes('graph')) {
    return 'chart';
  }
  if (filename.includes('table')) {
    return 'table';
  }
  if (filename.includes('diagram') || filename.includes('flow')) {
    return 'diagram';
  }
  if (filename.includes('screenshot') || filename.includes('fullpage')) {
    return 'screenshot';
  }
  if (filename.includes('page-')) {
    return 'screenshot';
  }

  return 'unknown';
}

export function getImageAsBase64(imagePath: string): string {
  const buffer = fs.readFileSync(imagePath);
  return buffer.toString('base64');
}

export function getImageMediaType(
  imagePath: string
): 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' {
  const ext = path.extname(imagePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.png':
    default:
      return 'image/png';
  }
}
