// Core exports
export { MoppyAgent, type AgentConfig, type AgentCallbacks } from './core/agent.js';
export { Session, type SessionState } from './core/session.js';
export { Conversation, type Message } from './core/conversation.js';

// Claude client
export { ClaudeClient, type ClaudeClientOptions, type ImageContent } from './claude/client.js';
export { collectStream, streamToConsole, type StreamCallbacks } from './claude/streaming.js';

// Source processing
export {
  loadSource,
  loadMultipleSources,
  closeBrowser,
  type SourceContent,
  type PdfSourceContent,
  type WebSourceContent,
  type SourceLoadOptions,
} from './sources/index.js';
export { extractPdfContent, type PdfContent, type PageContent } from './sources/pdf-source.js';
export { extractWebContent, type WebContent, type ExtractedImage } from './sources/web-source.js';

// Slide generation
export {
  SlideGenerator,
  createFrontMatter,
  type SlideGenerationOptions,
  type GeneratedSlides,
} from './generation/slide-generator.js';
export { BUILT_IN_THEMES, getTheme, getAvailableThemes, type Theme } from './generation/themes.js';

// Marp integration
export { compileMarp, compileToHtml, compileToPdf, type CompileOptions } from './marp/compiler.js';
export { startPreviewServer, stopPreviewServer, type PreviewServer } from './marp/server.js';
export { startWatcher, stopWatcher, type FileWatcher } from './marp/watcher.js';

// Utilities
export { loadConfig, ensureOutputDir, type MoppyConfig } from './utils/config.js';
export { logger, setLogLevel, type LogLevel } from './utils/logger.js';
