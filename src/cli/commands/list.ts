import { listStoredMarkdown, getMarkdownStorageDir } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';

export async function listCommand(): Promise<void> {
  const files = await listStoredMarkdown();

  if (files.length === 0) {
    logger.info('No stored markdown files found.');
    logger.info(`Storage directory: ${getMarkdownStorageDir()}`);
    return;
  }

  logger.info(`Found ${files.length} stored markdown file(s):\n`);

  files.forEach((file, index) => {
    console.log(`  ${index + 1}. ${file}`);
  });

  console.log();
  logger.info(`Storage directory: ${getMarkdownStorageDir()}`);
  logger.info('Use "moppy export <filename>" to export a stored file.');
}
