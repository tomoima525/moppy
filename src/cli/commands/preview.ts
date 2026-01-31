import path from 'path';
import fs from 'fs-extra';
import { startPreviewServer } from '../../marp/server.js';
import { validateMarpMarkdown } from '../../marp/compiler.js';
import { logger } from '../../utils/logger.js';

export interface PreviewOptions {
  port?: number;
  noOpen?: boolean;
}

export async function previewCommand(
  file: string,
  options: PreviewOptions
): Promise<void> {
  const filePath = path.resolve(file);

  // Validate file exists
  if (!(await fs.pathExists(filePath))) {
    logger.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  // Validate it's a Marp markdown file
  if (!filePath.endsWith('.md')) {
    logger.error('Preview only works with Marp markdown (.md) files');
    process.exit(1);
  }

  const isValid = await validateMarpMarkdown(filePath);
  if (!isValid) {
    logger.warn('File may not be valid Marp markdown (missing "marp: true" in front matter)');
  }

  logger.step('Starting preview server...');

  try {
    const server = await startPreviewServer({
      input: filePath,
      port: options.port || 8080,
      open: !options.noOpen,
    });

    logger.success(`Preview server running at: ${server.url}`);
    logger.info('Press Ctrl+C to stop');

    // Keep the process running
    await new Promise<void>((resolve) => {
      process.on('SIGINT', () => {
        logger.info('\nStopping preview server...');
        server.stop();
        resolve();
      });
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to start preview: ${msg}`);
    process.exit(1);
  }
}
