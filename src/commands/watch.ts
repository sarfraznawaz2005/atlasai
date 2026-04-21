import * as path from 'path';
import * as fs from 'fs';
import chokidar from 'chokidar';
import { runUpdate } from './update';
import { fileExists } from '../utils/fileUtils';
import { logger } from '../utils/logger';
import { SOURCE_EXTENSIONS, IGNORED_DIRS } from './init';

const DEBOUNCE_MS = 500;

export async function runWatch(projectPath: string): Promise<void> {
  const projectRoot = path.resolve(projectPath);

  if (!fs.existsSync(projectRoot)) {
    logger.error(`Project path does not exist: ${projectRoot}`);
    process.exit(1);
  }

  if (!fileExists(path.join(projectRoot, '.atlas', 'index.json'))) {
    logger.warn('.atlas/ not initialized. Running init first...');
    const { runInit } = await import('./init');
    await runInit(projectPath);
  }

  const extPattern = `**/*.{${SOURCE_EXTENSIONS.join(',')}}`;
  const ignoredPatterns = [
    ...IGNORED_DIRS.map(d => `**/${d}/**`),
    '**/.atlas/**',
  ];

  logger.info(`Watching ${projectRoot} for changes...`);
  logger.info('Press Ctrl+C to stop.');

  // Debounce: accumulate changed files and process in batches
  let pendingFiles = new Set<string>();
  let debounceTimer: NodeJS.Timeout | null = null;

  const flushPending = async () => {
    if (pendingFiles.size === 0) return;
    const files = Array.from(pendingFiles);
    pendingFiles = new Set();

    logger.step('Change detected', `updating ${files.length} file(s)...`);
    try {
      await runUpdate(projectRoot, files);
    } catch (err) {
      logger.error(`Update failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const scheduleFlush = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(flushPending, DEBOUNCE_MS);
  };

  const watcher = chokidar.watch(extPattern, {
    cwd: projectRoot,
    ignored: ignoredPatterns,
    persistent: true,
    ignoreInitial: true,
    followSymlinks: false,
    usePolling: false,
    awaitWriteFinish: {
      stabilityThreshold: 200,
      pollInterval: 100,
    },
  });

  const handleChange = (relPath: string) => {
    logger.debug(`File changed: ${relPath}`);
    pendingFiles.add(relPath);
    scheduleFlush();
  };

  watcher.on('change', handleChange);
  watcher.on('add', handleChange);
  watcher.on('unlink', (relPath) => {
    logger.debug(`File removed: ${relPath}`);
    pendingFiles.add(relPath);
    scheduleFlush();
  });

  watcher.on('error', (err) => {
    logger.error(`Watcher error: ${err instanceof Error ? err.message : String(err)}`);
  });

  watcher.on('ready', () => {
    logger.success('Watch mode active. Waiting for file changes...');
  });

  // Keep alive
  process.on('SIGINT', () => {
    logger.info('\nStopping watch mode...');
    watcher.close().then(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    watcher.close().then(() => process.exit(0));
  });
}
