import { ClaudeClient } from '../claude/client.js';
import { Session } from './session.js';
import { loadSource, SourceContent, closeBrowser } from '../sources/index.js';
import { SlideGenerator, GeneratedSlides } from '../generation/slide-generator.js';
import { compileMarp, OutputFormat } from '../marp/compiler.js';
import { startPreviewServer, stopPreviewServer, PreviewServer } from '../marp/server.js';
import { SYSTEM_PROMPT } from '../generation/prompts.js';
import { logger } from '../utils/logger.js';
import { isValidTheme } from '../generation/themes.js';
import path from 'path';

export interface AgentConfig {
  apiKey: string;
  model?: string;
  outputDir?: string;
  theme?: string;
}

export interface AgentCallbacks {
  onProgress?: (message: string) => void;
  onToken?: (token: string) => void;
  onComplete?: (result: unknown) => void;
  onError?: (error: Error) => void;
}

export class MoppyAgent {
  private claude: ClaudeClient;
  private generator: SlideGenerator;
  private session: Session;
  private previewServer: PreviewServer | null = null;

  constructor(config: AgentConfig) {
    this.claude = new ClaudeClient({
      apiKey: config.apiKey,
      model: config.model,
    });
    this.generator = new SlideGenerator(this.claude);
    this.session = new Session(
      config.outputDir || './slides',
      config.theme || 'default'
    );
  }

  getSession(): Session {
    return this.session;
  }

  async loadSources(
    sources: string[],
    callbacks?: AgentCallbacks
  ): Promise<SourceContent[]> {
    const loaded: SourceContent[] = [];

    for (const source of sources) {
      callbacks?.onProgress?.(`Loading ${source}...`);

      try {
        const content = await loadSource(source, {
          outputDir: path.join(this.session.getOutputDir(), 'assets'),
          renderPages: true,
          captureScreenshots: true,
        });
        this.session.addSource(content);
        loaded.push(content);

        const type = content.type === 'pdf' ? 'PDF' : 'web page';
        callbacks?.onProgress?.(`Loaded ${type}: ${source}`);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        callbacks?.onError?.(err);
        logger.error(`Failed to load source: ${source}`, err);
      }
    }

    return loaded;
  }

  async generateSlides(
    slideCount?: number,
    callbacks?: AgentCallbacks
  ): Promise<GeneratedSlides | null> {
    const sources = this.session.getSources();

    if (sources.length === 0) {
      callbacks?.onError?.(new Error('No sources loaded. Load a PDF or URL first.'));
      return null;
    }

    callbacks?.onProgress?.('Generating slides...');

    try {
      let result: GeneratedSlides;

      if (callbacks?.onToken) {
        // Streaming mode
        let finalResult: GeneratedSlides | null = null;
        const stream = this.generator.streamGeneration(sources, {
          theme: this.session.getTheme(),
          slideCount,
          outputDir: this.session.getOutputDir(),
        });

        for await (const token of stream) {
          callbacks.onToken(token);
        }

        // Get the return value from the generator
        const lastResult = await stream.next();
        if (lastResult.done && lastResult.value) {
          finalResult = lastResult.value;
        }

        if (!finalResult) {
          throw new Error('Failed to get generated slides result');
        }
        result = finalResult;
      } else {
        // Non-streaming mode
        result = await this.generator.generateFromSources(sources, {
          theme: this.session.getTheme(),
          slideCount,
          outputDir: this.session.getOutputDir(),
        });
      }

      this.session.setCurrentSlideFile(result.filePath);
      this.session.getConversation().addAssistantMessage(
        `Created ${result.slideCount} slides. File: ${result.filePath}`
      );

      callbacks?.onComplete?.(result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      callbacks?.onError?.(err);
      return null;
    }
  }

  async chat(
    message: string,
    callbacks?: AgentCallbacks
  ): Promise<string> {
    this.session.getConversation().addUserMessage(message);

    // Check for special commands
    const command = this.parseCommand(message);
    if (command) {
      return this.handleCommand(command, callbacks);
    }

    // Regular chat - ask Claude for help
    const context = this.buildChatContext();
    const messages = this.session.getConversation().getContext();

    try {
      let response = '';

      if (callbacks?.onToken) {
        const stream = this.claude.streamMessage(SYSTEM_PROMPT, messages, 4096);
        for await (const token of stream) {
          response += token;
          callbacks.onToken(token);
        }
      } else {
        response = await this.claude.sendMessage(SYSTEM_PROMPT, messages, 4096);
      }

      this.session.getConversation().addAssistantMessage(response);
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      callbacks?.onError?.(err);
      throw err;
    }
  }

  private parseCommand(message: string): { type: string; args: string[] } | null {
    const lower = message.toLowerCase().trim();

    // Load command
    const loadMatch = lower.match(/^load\s+(.+)$/i);
    if (loadMatch) {
      return { type: 'load', args: loadMatch[1].split(/\s+/) };
    }

    // Theme command
    const themeMatch = lower.match(/^(?:set\s+)?theme\s+(?:to\s+)?(\w+)$/i);
    if (themeMatch) {
      return { type: 'theme', args: [themeMatch[1]] };
    }

    // Export command
    const exportMatch = lower.match(/^export(?:\s+to)?\s+(html|pdf|png|jpeg|pptx)$/i);
    if (exportMatch) {
      return { type: 'export', args: [exportMatch[1].toLowerCase()] };
    }

    // Preview command
    if (lower === 'preview' || lower === 'start preview') {
      return { type: 'preview', args: [] };
    }

    // Generate command
    const generateMatch = lower.match(/^(?:generate|create)\s+(\d+)\s+slides?$/i);
    if (generateMatch) {
      return { type: 'generate', args: [generateMatch[1]] };
    }

    return null;
  }

  private async handleCommand(
    command: { type: string; args: string[] },
    callbacks?: AgentCallbacks
  ): Promise<string> {
    switch (command.type) {
      case 'load':
        await this.loadSources(command.args, callbacks);
        return `Loaded ${command.args.length} source(s).`;

      case 'theme':
        const theme = command.args[0];
        if (isValidTheme(theme)) {
          this.session.setTheme(theme);
          return `Theme set to: ${theme}`;
        }
        return `Unknown theme: ${theme}. Available: default, gaia, uncover`;

      case 'export':
        const format = command.args[0] as OutputFormat;
        const result = await this.export(format, callbacks);
        return result
          ? `Exported to: ${result}`
          : 'Export failed. No slides to export.';

      case 'preview':
        const server = await this.startPreview(callbacks);
        return server
          ? `Preview started at: ${server.url}`
          : 'Failed to start preview. No slides file found.';

      case 'generate':
        const count = parseInt(command.args[0], 10);
        const slides = await this.generateSlides(count, callbacks);
        return slides
          ? `Generated ${slides.slideCount} slides: ${slides.filePath}`
          : 'Failed to generate slides.';

      default:
        return 'Unknown command.';
    }
  }

  private buildChatContext(): string {
    const state = this.session.getState();
    const parts: string[] = [];

    if (state.sources.length > 0) {
      parts.push(`Loaded sources: ${state.sources.map((s) => s.path).join(', ')}`);
    }

    if (state.currentSlideFile) {
      parts.push(`Current slide file: ${state.currentSlideFile}`);
    }

    parts.push(`Theme: ${state.theme}`);
    parts.push(`Output directory: ${state.outputDir}`);

    return parts.join('\n');
  }

  async export(
    format: OutputFormat,
    callbacks?: AgentCallbacks
  ): Promise<string | null> {
    const slideFile = this.session.getCurrentSlideFile();

    if (!slideFile) {
      callbacks?.onError?.(new Error('No slides to export. Generate slides first.'));
      return null;
    }

    callbacks?.onProgress?.(`Exporting to ${format}...`);

    const result = await compileMarp({
      input: slideFile,
      format,
    });

    if (result.success) {
      this.session.addGeneratedFile(result.outputPath);
      callbacks?.onComplete?.(result);
      return result.outputPath;
    }

    callbacks?.onError?.(new Error(result.errors?.join('\n') || 'Export failed'));
    return null;
  }

  async startPreview(callbacks?: AgentCallbacks): Promise<PreviewServer | null> {
    const slideFile = this.session.getCurrentSlideFile();

    if (!slideFile) {
      callbacks?.onError?.(new Error('No slides to preview. Generate slides first.'));
      return null;
    }

    callbacks?.onProgress?.('Starting preview server...');

    try {
      this.previewServer = await startPreviewServer({
        input: slideFile,
        open: true,
      });
      return this.previewServer;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      callbacks?.onError?.(err);
      return null;
    }
  }

  stopPreview(): void {
    stopPreviewServer();
    this.previewServer = null;
  }

  async cleanup(): Promise<void> {
    this.stopPreview();
    await closeBrowser();
  }
}
