import { MoppyAgent } from '../../core/agent.js';
import { loadConfig, ensureOutputDir } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';

export interface GenerateOptions {
  output?: string;
  theme?: string;
  slides?: number;
}

export async function generateCommand(
  sources: string[],
  options: GenerateOptions
): Promise<void> {
  if (sources.length === 0) {
    logger.error('Please provide at least one source (PDF file or URL)');
    process.exit(1);
  }

  const config = loadConfig();
  const outputDir = ensureOutputDir(options.output || config.outputDir);

  const agent = new MoppyAgent({
    provider: config.provider,
    model: config.model,
    outputDir,
    theme: options.theme || config.defaultTheme,
  });

  try {
    // Load sources
    logger.step('Loading sources...');
    const loaded = await agent.loadSources(sources, {
      onProgress: (msg) => logger.info(msg),
      onError: (err) => logger.error(err.message),
    });

    if (loaded.length === 0) {
      logger.error('No sources could be loaded');
      process.exit(1);
    }

    logger.success(`Loaded ${loaded.length} source(s)`);

    // Generate slides
    logger.step('Generating slides...');
    const result = await agent.generateSlides(options.slides, {
      onProgress: (msg) => logger.info(msg),
      onToken: (token) => process.stdout.write(token),
    });

    if (result) {
      console.log(); // New line after streaming
      logger.success(`Created ${result.slideCount} slides`);
      logger.success(`Output: ${result.filePath}`);
    } else {
      logger.error('Failed to generate slides');
      process.exit(1);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(msg);
    process.exit(1);
  } finally {
    await agent.cleanup();
  }
}
