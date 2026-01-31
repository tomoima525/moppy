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
