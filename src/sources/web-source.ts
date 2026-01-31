import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import fs from 'fs-extra';
import path from 'path';
import { generateUniqueFilename } from '../utils/file.js';

export interface WebContent {
  url: string;
  title: string;
  text: string;
  images: ExtractedImage[];
  tables: string[];
  headings: Heading[];
}

export interface ExtractedImage {
  src: string;
  alt?: string;
  localPath?: string;
}

export interface Heading {
  level: number;
  text: string;
}

export interface WebExtractionOptions {
  outputDir?: string;
  captureScreenshots?: boolean;
  captureElements?: string[];
  waitForSelector?: string;
  timeout?: number;
}

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export async function extractWebContent(
  url: string,
  options: WebExtractionOptions = {}
): Promise<WebContent> {
  const {
    outputDir = './slides/assets',
    captureScreenshots = true,
    captureElements = ['table', 'figure', 'img[src*="chart"]', 'canvas'],
    waitForSelector,
    timeout = 30000,
  } = options;

  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  try {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout });

    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout });
    }

    // Get page HTML
    const html = await page.content();
    const $ = cheerio.load(html);

    // Extract title
    const title = $('title').text() || $('h1').first().text() || 'Untitled';

    // Extract main text content
    const text = extractMainContent($);

    // Extract headings
    const headings: Heading[] = [];
    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const tagName = $(el).prop('tagName')?.toLowerCase() || 'h1';
      headings.push({
        level: parseInt(tagName.replace('h', ''), 10),
        text: $(el).text().trim(),
      });
    });

    // Extract tables as HTML
    const tables: string[] = [];
    $('table').each((_, el) => {
      tables.push($.html(el));
    });

    // Extract and capture images
    const images: ExtractedImage[] = [];
    await fs.ensureDir(outputDir);

    if (captureScreenshots) {
      // Capture full page screenshot
      const screenshotPath = path.join(
        outputDir,
        generateUniqueFilename('fullpage', '.png')
      );
      await page.screenshot({ path: screenshotPath, fullPage: true });
      images.push({
        src: url,
        alt: 'Full page screenshot',
        localPath: screenshotPath,
      });

      // Capture specific elements
      for (const selector of captureElements) {
        const elements = await page.$$(selector);
        for (let i = 0; i < elements.length; i++) {
          try {
            const element = elements[i];
            const filename = generateUniqueFilename(
              `element-${selector.replace(/[^a-z0-9]/gi, '')}-${i}`,
              '.png'
            );
            const elementPath = path.join(outputDir, filename);
            await element.screenshot({ path: elementPath });
            images.push({
              src: selector,
              alt: `Captured ${selector}`,
              localPath: elementPath,
            });
          } catch {
            // Element might not be visible or screenshottable
          }
        }
      }
    }

    // Extract regular images
    $('img').each((_, el) => {
      const src = $(el).attr('src');
      const alt = $(el).attr('alt');
      if (src) {
        images.push({ src, alt });
      }
    });

    return {
      url,
      title,
      text,
      images,
      tables,
      headings,
    };
  } finally {
    await page.close();
  }
}

function extractMainContent($: cheerio.CheerioAPI): string {
  // Remove unwanted elements
  $('script, style, nav, header, footer, aside, .sidebar, .menu').remove();

  // Try to find main content area
  const mainSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '.post-content',
    '.article-content',
    '#content',
  ];

  for (const selector of mainSelectors) {
    const content = $(selector).text().trim();
    if (content.length > 100) {
      return cleanText(content);
    }
  }

  // Fallback to body text
  return cleanText($('body').text());
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

export async function captureUrlScreenshot(
  url: string,
  outputPath: string,
  options: { fullPage?: boolean; waitForSelector?: string } = {}
): Promise<string> {
  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  try {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: 'networkidle2' });

    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector);
    }

    await page.screenshot({
      path: outputPath,
      fullPage: options.fullPage ?? true,
    });

    return outputPath;
  } finally {
    await page.close();
  }
}
