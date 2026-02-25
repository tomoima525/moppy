import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs-extra';

dotenv.config();

export interface MoppyConfig {
  anthropicApiKey: string;
  claudeModel: string;
  outputDir: string;
  defaultTheme: string;
}

export function loadConfig(): MoppyConfig {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is required. Set it in your environment or .env file.'
    );
  }

  return {
    anthropicApiKey,
    claudeModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
    outputDir: process.env.OUTPUT_DIR || './slides',
    defaultTheme: process.env.DEFAULT_THEME || 'default',
  };
}

export function ensureOutputDir(outputDir: string): string {
  const resolvedPath = path.resolve(outputDir);
  fs.ensureDirSync(resolvedPath);
  return resolvedPath;
}

export function getAssetsDir(outputDir: string): string {
  const assetsDir = path.join(outputDir, 'assets');
  fs.ensureDirSync(assetsDir);
  return assetsDir;
}

export function getMarkdownStorageDir(): string {
  const storageDir = path.resolve('.moppy/markdown');
  fs.ensureDirSync(storageDir);
  return storageDir;
}

export function generateMarkdownFilename(prefix: string = 'slides'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${prefix}-${timestamp}.md`;
}

export async function listStoredMarkdown(): Promise<string[]> {
  const storageDir = getMarkdownStorageDir();
  const files = await fs.readdir(storageDir);
  return files
    .filter((f) => f.endsWith('.md'))
    .sort()
    .reverse();
}

export async function getStoredMarkdownPath(filename: string): Promise<string | null> {
  const storageDir = getMarkdownStorageDir();
  const filePath = path.join(storageDir, filename);
  if (await fs.pathExists(filePath)) {
    return filePath;
  }
  return null;
}
