import { spawn, ChildProcess } from 'child_process';
import path from 'path';

export interface PreviewServerOptions {
  input: string;
  port?: number;
  open?: boolean;
}

export interface PreviewServer {
  process: ChildProcess;
  port: number;
  url: string;
  stop: () => void;
}

let activeServer: PreviewServer | null = null;

export async function startPreviewServer(
  options: PreviewServerOptions
): Promise<PreviewServer> {
  // Stop existing server if running
  if (activeServer) {
    activeServer.stop();
  }

  const { input, port = 8080, open = true } = options;
  const inputPath = path.resolve(input);
  const inputDir = path.dirname(inputPath);

  const args = ['@marp-team/marp-cli', '--server', '-p', String(port)];

  if (open) {
    args.push('--open');
  }

  args.push('--allow-local-files');
  args.push(inputPath);

  return new Promise((resolve, reject) => {
    const serverProcess = spawn('npx', args, {
      cwd: inputDir,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const url = `http://localhost:${port}`;

    const server: PreviewServer = {
      process: serverProcess,
      port,
      url,
      stop: () => {
        serverProcess.kill();
        if (activeServer === server) {
          activeServer = null;
        }
      },
    };

    activeServer = server;

    // Listen for server ready
    let started = false;
    const timeout = setTimeout(() => {
      if (!started) {
        resolve(server); // Resolve anyway after timeout
      }
    }, 5000);

    serverProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server') || output.includes('listening') || output.includes(String(port))) {
        if (!started) {
          started = true;
          clearTimeout(timeout);
          resolve(server);
        }
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      // Marp CLI outputs to stderr sometimes
      if (output.includes('Server') || output.includes('listening')) {
        if (!started) {
          started = true;
          clearTimeout(timeout);
          resolve(server);
        }
      }
    });

    serverProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    serverProcess.on('close', (code) => {
      if (activeServer === server) {
        activeServer = null;
      }
      if (!started && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Server exited with code ${code}`));
      }
    });
  });
}

export function stopPreviewServer(): void {
  if (activeServer) {
    activeServer.stop();
    activeServer = null;
  }
}

export function getActiveServer(): PreviewServer | null {
  return activeServer;
}
