import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

export function generateUniqueFilename(prefix: string, ext: string): string {
  const hash = crypto.randomBytes(4).toString('hex');
  const timestamp = Date.now();
  return `${prefix}-${timestamp}-${hash}${ext}`;
}

export async function saveBuffer(
  buffer: Buffer,
  outputDir: string,
  filename: string
): Promise<string> {
  const filePath = path.join(outputDir, filename);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function saveText(
  content: string,
  outputDir: string,
  filename: string
): Promise<string> {
  const filePath = path.join(outputDir, filename);
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

export function isUrl(input: string): boolean {
  try {
    new URL(input);
    return true;
  } catch {
    return false;
  }
}

export function isPdf(input: string): boolean {
  return input.toLowerCase().endsWith('.pdf');
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function getRelativePath(from: string, to: string): string {
  return path.relative(path.dirname(from), to);
}
