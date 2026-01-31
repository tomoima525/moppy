import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';

export interface WatcherOptions {
  onFileChange?: (filePath: string) => void;
  onError?: (error: Error) => void;
}

export interface FileWatcher {
  watcher: FSWatcher;
  stop: () => Promise<void>;
  addPath: (path: string) => void;
}

let activeWatcher: FileWatcher | null = null;

export function startWatcher(
  paths: string | string[],
  options: WatcherOptions = {}
): FileWatcher {
  // Stop existing watcher
  if (activeWatcher) {
    activeWatcher.stop();
  }

  const watcher = chokidar.watch(paths, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });

  watcher.on('change', (filePath) => {
    options.onFileChange?.(filePath);
  });

  watcher.on('add', (filePath) => {
    options.onFileChange?.(filePath);
  });

  watcher.on('error', (error) => {
    options.onError?.(error);
  });

  const fileWatcher: FileWatcher = {
    watcher,
    stop: async () => {
      await watcher.close();
      if (activeWatcher === fileWatcher) {
        activeWatcher = null;
      }
    },
    addPath: (newPath: string) => {
      watcher.add(newPath);
    },
  };

  activeWatcher = fileWatcher;
  return fileWatcher;
}

export function stopWatcher(): Promise<void> {
  if (activeWatcher) {
    return activeWatcher.stop();
  }
  return Promise.resolve();
}

export function watchSlideFile(
  filePath: string,
  onUpdate: () => void
): FileWatcher {
  const dir = path.dirname(filePath);
  const filename = path.basename(filePath);

  return startWatcher(path.join(dir, filename), {
    onFileChange: () => {
      onUpdate();
    },
  });
}
