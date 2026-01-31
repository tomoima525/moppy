import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';

export type OutputFormat = 'html' | 'pdf' | 'pptx' | 'png' | 'jpeg';

export interface CompileOptions {
  input: string;
  output?: string;
  format?: OutputFormat;
  theme?: string;
  watch?: boolean;
  allowLocalFiles?: boolean;
}

export interface CompileResult {
  success: boolean;
  outputPath: string;
  errors?: string[];
}

export async function compileMarp(options: CompileOptions): Promise<CompileResult> {
  const { input, format = 'html', theme, watch = false, allowLocalFiles = true } = options;

  // Determine output path
  const inputPath = path.resolve(input);
  const inputDir = path.dirname(inputPath);
  const inputName = path.basename(inputPath, '.md');

  let outputPath = options.output;
  if (!outputPath) {
    const ext = format === 'png' || format === 'jpeg' ? format : format;
    outputPath = path.join(inputDir, `${inputName}.${ext}`);
  }

  const args: string[] = [inputPath];

  // Output options
  if (format === 'pdf') {
    args.push('--pdf');
  } else if (format === 'pptx') {
    args.push('--pptx');
  } else if (format === 'png') {
    args.push('--images', 'png');
  } else if (format === 'jpeg') {
    args.push('--images', 'jpeg');
  }

  args.push('-o', outputPath);

  if (theme) {
    args.push('--theme', theme);
  }

  if (watch) {
    args.push('--watch');
  }

  if (allowLocalFiles) {
    args.push('--allow-local-files');
  }

  return new Promise((resolve) => {
    const errors: string[] = [];

    const marpCli = spawn('npx', ['@marp-team/marp-cli', ...args], {
      cwd: inputDir,
      shell: true,
    });

    marpCli.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Error') || output.includes('error')) {
        errors.push(output);
      }
    });

    marpCli.stderr.on('data', (data) => {
      errors.push(data.toString());
    });

    marpCli.on('close', (code) => {
      resolve({
        success: code === 0,
        outputPath,
        errors: errors.length > 0 ? errors : undefined,
      });
    });

    marpCli.on('error', (err) => {
      errors.push(err.message);
      resolve({
        success: false,
        outputPath,
        errors,
      });
    });
  });
}

export async function compileToHtml(input: string, output?: string): Promise<CompileResult> {
  return compileMarp({ input, output, format: 'html' });
}

export async function compileToPdf(input: string, output?: string): Promise<CompileResult> {
  return compileMarp({ input, output, format: 'pdf' });
}

export async function compileToImages(
  input: string,
  format: 'png' | 'jpeg' = 'png',
  output?: string
): Promise<CompileResult> {
  return compileMarp({ input, output, format });
}

export async function validateMarpMarkdown(filePath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    // Check for Marp front matter
    return content.startsWith('---') && content.includes('marp: true');
  } catch {
    return false;
  }
}
