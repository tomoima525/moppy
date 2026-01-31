import path from 'path';
import fs from 'fs-extra';
import { compileMarp, OutputFormat, validateMarpMarkdown } from '../../marp/compiler.js';
import { logger } from '../../utils/logger.js';

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
  const filePath = path.resolve(file);

  // Validate file exists
  if (!(await fs.pathExists(filePath))) {
    logger.error(`File not found: ${filePath}`);
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
