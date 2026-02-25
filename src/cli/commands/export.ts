import path from 'path';
import fs from 'fs-extra';
import { compileMarp, OutputFormat, validateMarpMarkdown } from '../../marp/compiler.js';
import { logger } from '../../utils/logger.js';
import { getStoredMarkdownPath, listStoredMarkdown } from '../../utils/config.js';

export interface ExportOptions {
  format?: OutputFormat;
  output?: string;
  theme?: string;
}

const VALID_FORMATS: OutputFormat[] = ['html', 'pdf', 'pptx', 'png', 'jpeg'];

export async function exportCommand(
  file: string,
  options: ExportOptions
): Promise<void> {
  let filePath = path.resolve(file);

  // Check if it's a stored markdown file (just filename without path)
  if (!file.includes('/') && !file.includes('\\')) {
    const storedPath = await getStoredMarkdownPath(file);
    if (storedPath) {
      filePath = storedPath;
      logger.info(`Using stored markdown: ${file}`);
    }
  }

  // Validate file exists
  if (!(await fs.pathExists(filePath))) {
    // Try to find in stored markdown
    const storedFiles = await listStoredMarkdown();
    if (storedFiles.length > 0) {
      logger.error(`File not found: ${filePath}`);
      logger.info('\nAvailable stored markdown files:');
      storedFiles.slice(0, 5).forEach((f) => console.log(`  - ${f}`));
      if (storedFiles.length > 5) {
        logger.info(`  ... and ${storedFiles.length - 5} more (use "moppy list" to see all)`);
      }
    } else {
      logger.error(`File not found: ${filePath}`);
    }
    process.exit(1);
  }

  // Validate it's a markdown file
  if (!filePath.endsWith('.md')) {
    logger.error('Export only works with Marp markdown (.md) files');
    process.exit(1);
  }

  // Validate format
  const format = options.format || 'pdf';
  if (!VALID_FORMATS.includes(format)) {
    logger.error(`Invalid format: ${format}. Valid formats: ${VALID_FORMATS.join(', ')}`);
    process.exit(1);
  }

  // Validate Marp markdown
  const isValid = await validateMarpMarkdown(filePath);
  if (!isValid) {
    logger.warn('File may not be valid Marp markdown (missing "marp: true" in front matter)');
  }

  logger.step(`Exporting to ${format.toUpperCase()}...`);

  try {
    const result = await compileMarp({
      input: filePath,
      output: options.output,
      format,
      theme: options.theme,
    });

    if (result.success) {
      logger.success(`Exported to: ${result.outputPath}`);
    } else {
      logger.error('Export failed');
      if (result.errors) {
        result.errors.forEach((err) => logger.error(err));
      }
      process.exit(1);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Export failed: ${msg}`);
    process.exit(1);
  }
}
