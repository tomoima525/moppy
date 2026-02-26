import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs-extra';
import type { LLMProvider } from '../llm/client.js';

dotenv.config();

export interface MoppyConfig {
  provider: LLMProvider;
  model: string;
  outputDir: string;
  defaultTheme: string;
  // Backward compatibility
  anthropicApiKey?: string;
}

const PROVIDER_API_KEY_ENV: Record<LLMProvider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  mistral: 'MISTRAL_API_KEY',
};

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  google: 'gemini-2.0-flash',
  groq: 'llama-3.3-70b-versatile',
  mistral: 'mistral-large-latest',
};

export function loadConfig(): MoppyConfig {
  const provider = (process.env.LLM_PROVIDER as LLMProvider) || 'anthropic';

  // Validate provider
  if (!PROVIDER_API_KEY_ENV[provider]) {
    throw new Error(
      `Invalid LLM_PROVIDER: ${provider}. Supported: ${Object.keys(PROVIDER_API_KEY_ENV).join(', ')}`
    );
  }

  // Check for API key (pi-ai auto-detects from env, but we validate it exists)
  const apiKeyEnv = PROVIDER_API_KEY_ENV[provider];
  const apiKey = process.env[apiKeyEnv];

  if (!apiKey) {
    throw new Error(
      `${apiKeyEnv} is required for provider '${provider}'. Set it in your environment or .env file.`
    );
  }

  // Model can be overridden, or use provider default
  const model = process.env.LLM_MODEL || process.env.CLAUDE_MODEL || DEFAULT_MODELS[provider];

  return {
    provider,
    model,
    outputDir: process.env.OUTPUT_DIR || './slides',
    defaultTheme: process.env.DEFAULT_THEME || 'default',
    // Backward compatibility
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
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
