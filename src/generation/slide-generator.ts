import path from 'path';
import fs from 'fs-extra';
import { ClaudeClient, ImageContent } from '../claude/client.js';
import { SourceContent } from '../sources/index.js';
import {
  SYSTEM_PROMPT,
  GENERATE_SLIDES_PROMPT,
  REFINE_SLIDE_PROMPT,
  formatPrompt,
} from './prompts.js';
import { getImageAsBase64, getImageMediaType } from '../extraction/image-extractor.js';
import { htmlTableToMarkdown } from '../extraction/table-extractor.js';

export interface SlideGenerationOptions {
  theme?: string;
  slideCount?: number;
  paginate?: boolean;
  outputDir?: string;
}

export interface GeneratedSlides {
  markdown: string;
  filePath: string;
  slideCount: number;
  images: string[];
}

export interface ContentSummary {
  text: string;
  images: Array<{ path: string; description?: string }>;
  tables: string[];
}

export class SlideGenerator {
  private claude: ClaudeClient;

  constructor(claude: ClaudeClient) {
    this.claude = claude;
  }

  async generateFromSources(
    sources: SourceContent[],
    options: SlideGenerationOptions = {}
  ): Promise<GeneratedSlides> {
    const {
      theme = 'default',
      slideCount = 10,
      paginate = true,
      outputDir = './slides',
    } = options;

    // Prepare content summary
    const summary = this.summarizeSources(sources);

    // Prepare images list for the prompt
    const imagesInfo = summary.images
      .map((img) => `- ${path.basename(img.path)}: ${img.description || 'Image'}`)
      .join('\n');

    // Generate slides using Claude
    const prompt = formatPrompt(GENERATE_SLIDES_PROMPT, {
      content: summary.text,
      theme,
      slideCount,
      paginate,
      images: imagesInfo || 'No images available',
    });

    // If we have images, use vision API for better understanding
    let markdown: string;
    if (summary.images.length > 0 && summary.images.length <= 5) {
      const imageContents: ImageContent[] = summary.images.slice(0, 5).map((img) => ({
        type: 'base64',
        mediaType: getImageMediaType(img.path),
        data: getImageAsBase64(img.path),
      }));

      markdown = await this.claude.analyzeWithVision(
        SYSTEM_PROMPT,
        prompt,
        imageContents,
        8192
      );
    } else {
      markdown = await this.claude.sendMessage(
        SYSTEM_PROMPT,
        [{ role: 'user', content: prompt }],
        8192
      );
    }

    // Clean up markdown
    markdown = this.cleanMarkdown(markdown);

    // Save to file
    await fs.ensureDir(outputDir);
    const filePath = path.join(outputDir, 'slides.md');
    await fs.writeFile(filePath, markdown, 'utf-8');

    // Count slides
    const actualSlideCount = (markdown.match(/^---$/gm) || []).length + 1;

    return {
      markdown,
      filePath,
      slideCount: actualSlideCount,
      images: summary.images.map((img) => img.path),
    };
  }

  async refineSlide(
    currentSlide: string,
    userRequest: string,
    availableImages: string[]
  ): Promise<string> {
    const imagesInfo = availableImages
      .map((img) => `- ${path.basename(img)}`)
      .join('\n');

    const prompt = formatPrompt(REFINE_SLIDE_PROMPT, {
      currentSlide,
      userRequest,
      images: imagesInfo || 'No images available',
    });

    const result = await this.claude.sendMessage(
      SYSTEM_PROMPT,
      [{ role: 'user', content: prompt }],
      2048
    );

    return this.cleanMarkdown(result);
  }

  async *streamGeneration(
    sources: SourceContent[],
    options: SlideGenerationOptions = {}
  ): AsyncGenerator<string, GeneratedSlides, unknown> {
    const {
      theme = 'default',
      slideCount = 10,
      paginate = true,
      outputDir = './slides',
    } = options;

    const summary = this.summarizeSources(sources);
    const imagesInfo = summary.images
      .map((img) => `- ${path.basename(img.path)}: ${img.description || 'Image'}`)
      .join('\n');

    const prompt = formatPrompt(GENERATE_SLIDES_PROMPT, {
      content: summary.text,
      theme,
      slideCount,
      paginate,
      images: imagesInfo || 'No images available',
    });

    let markdown = '';
    const stream = this.claude.streamMessage(
      SYSTEM_PROMPT,
      [{ role: 'user', content: prompt }],
      8192
    );

    for await (const token of stream) {
      markdown += token;
      yield token;
    }

    markdown = this.cleanMarkdown(markdown);
    await fs.ensureDir(outputDir);
    const filePath = path.join(outputDir, 'slides.md');
    await fs.writeFile(filePath, markdown, 'utf-8');

    const actualSlideCount = (markdown.match(/^---$/gm) || []).length + 1;

    return {
      markdown,
      filePath,
      slideCount: actualSlideCount,
      images: summary.images.map((img) => img.path),
    };
  }

  private summarizeSources(sources: SourceContent[]): ContentSummary {
    const textParts: string[] = [];
    const images: Array<{ path: string; description?: string }> = [];
    const tables: string[] = [];

    for (const source of sources) {
      if (source.type === 'pdf') {
        textParts.push(`# Source: ${source.sourcePath}\n\n${source.content.text}`);

        for (const page of source.content.pages) {
          if (page.imagePath) {
            images.push({
              path: page.imagePath,
              description: `PDF page ${page.pageNumber}`,
            });
          }
        }
      } else if (source.type === 'web') {
        textParts.push(`# Source: ${source.sourceUrl}\n\n## ${source.content.title}\n\n${source.content.text}`);

        for (const img of source.content.images) {
          if (img.localPath) {
            images.push({
              path: img.localPath,
              description: img.alt,
            });
          }
        }

        for (const table of source.content.tables) {
          const converted = htmlTableToMarkdown(table);
          tables.push(converted.markdown);
        }
      }
    }

    return {
      text: textParts.join('\n\n---\n\n'),
      images,
      tables,
    };
  }

  private cleanMarkdown(markdown: string): string {
    // Remove any code block wrappers Claude might add
    let cleaned = markdown
      .replace(/^```markdown\n?/i, '')
      .replace(/^```marp\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();

    // Ensure front matter exists
    if (!cleaned.startsWith('---')) {
      cleaned = `---
marp: true
theme: default
paginate: true
---

${cleaned}`;
    }

    return cleaned;
  }
}

export function createFrontMatter(options: {
  theme?: string;
  paginate?: boolean;
  size?: string;
  header?: string;
  footer?: string;
}): string {
  const lines = ['---', 'marp: true'];

  if (options.theme) {
    lines.push(`theme: ${options.theme}`);
  }
  if (options.paginate !== false) {
    lines.push('paginate: true');
  }
  if (options.size) {
    lines.push(`size: ${options.size}`);
  }
  if (options.header) {
    lines.push(`header: "${options.header}"`);
  }
  if (options.footer) {
    lines.push(`footer: "${options.footer}"`);
  }

  lines.push('---');
  return lines.join('\n');
}
