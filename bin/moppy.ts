#!/usr/bin/env node

import { Command } from 'commander';
import { runInteractiveMode } from '../src/cli/app.js';
import { generateCommand } from '../src/cli/commands/generate.js';
import { previewCommand } from '../src/cli/commands/preview.js';
import { exportCommand } from '../src/cli/commands/export.js';
import { listCommand } from '../src/cli/commands/list.js';
import { loadConfig } from '../src/utils/config.js';
import { logger } from '../src/utils/logger.js';
import chalk from 'chalk';

const VERSION = '1.0.0';

const program = new Command();

program
  .name('moppy')
  .description('AI-powered slide generator using multiple LLM providers and Marp')
  .version(VERSION);

// Default command - interactive mode
program
  .option('-o, --output <path>', 'Output directory', './slides')
  .option('-t, --theme <name>', 'Theme (default, gaia, uncover)', 'default')
  .action(async (options) => {
    console.log(chalk.magenta.bold('\nMoppy') + chalk.dim(` v${VERSION}`) + ' - AI Slide Generator\n');

    try {
      const config = loadConfig();
      await runInteractiveMode({
        provider: config.provider,
        model: config.model,
        outputDir: options.output,
        theme: options.theme,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('API_KEY')) {
        logger.error('API key not set. Please set it in your environment or .env file.');
        logger.info('For Anthropic: ANTHROPIC_API_KEY=sk-ant-xxx');
        logger.info('For OpenAI: OPENAI_API_KEY=sk-xxx');
        logger.info('Provider can be set with: LLM_PROVIDER=anthropic|openai|google|groq|mistral');
      } else {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(msg);
      }
      process.exit(1);
    }
  });

// Generate command
program
  .command('generate <sources...>')
  .description('Generate slides from PDF files or URLs')
  .option('-o, --output <path>', 'Output directory', './slides')
  .option('-t, --theme <name>', 'Theme (default, gaia, uncover)', 'default')
  .option('-s, --slides <number>', 'Number of slides to generate', parseInt)
  .action(async (sources, options) => {
    console.log(chalk.magenta.bold('\nMoppy') + chalk.dim(` v${VERSION}`) + ' - Generate Mode\n');
    await generateCommand(sources, options);
  });

// Preview command
program
  .command('preview <file>')
  .description('Start live preview server for a Marp markdown file')
  .option('-p, --port <number>', 'Server port', parseInt)
  .option('--no-open', 'Do not open browser automatically')
  .action(async (file, options) => {
    console.log(chalk.magenta.bold('\nMoppy') + chalk.dim(` v${VERSION}`) + ' - Preview Mode\n');
    await previewCommand(file, options);
  });

// Export command
program
  .command('export <file>')
  .description('Export Marp markdown to various formats (supports stored markdown filenames)')
  .option('-f, --format <type>', 'Output format (html, pdf, pptx, png, jpeg)', 'pdf')
  .option('-o, --output <path>', 'Output file path')
  .option('-t, --theme <name>', 'Override theme')
  .action(async (file, options) => {
    console.log(chalk.magenta.bold('\nMoppy') + chalk.dim(` v${VERSION}`) + ' - Export Mode\n');
    await exportCommand(file, options);
  });

// List command
program
  .command('list')
  .alias('ls')
  .description('List stored markdown files')
  .action(async () => {
    console.log(chalk.magenta.bold('\nMoppy') + chalk.dim(` v${VERSION}`) + ' - Stored Files\n');
    await listCommand();
  });

program.parse();
