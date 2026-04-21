import * as fs from 'fs';
import * as path from 'path';
import ignore, { Ignore } from 'ignore';

// Always ignored regardless of any ignore files
export const ALWAYS_IGNORED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '__pycache__',
  '.venv',
  'venv',
  'vendor',
  'target',
  '.atlas',
  '.turbo',
  '.cache',
  'out',
  '.svelte-kit',
  '.output',
  'tmp',
  'temp',
  '.tmp',
  '.temp',
  '.yarn',
  'bower_components',
  '.idea',
  '.vscode',
];

export const ALWAYS_IGNORED_PATTERNS = [
  ...ALWAYS_IGNORED_DIRS,
  '*.min.js',
  '*.min.css',
  '*.bundle.js',
  '*.d.ts',
  '*.map',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
];

export interface IgnoreRules {
  // Glob patterns for fast-glob (directory-level, efficient)
  ignoreGlobs: string[];
  // Fine-grained per-file check using gitignore semantics
  shouldIgnore: (filePath: string) => boolean;
  // Which ignore files were loaded
  sources: string[];
}

export function loadIgnoreRules(projectRoot: string): IgnoreRules {
  const ig: Ignore = ignore();
  const sources: string[] = ['built-in patterns'];

  // 1. Always-ignored patterns
  ig.add(ALWAYS_IGNORED_PATTERNS);

  // 2. .gitignore
  const gitignorePath = path.join(projectRoot, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    try {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      ig.add(content);
      sources.push('.gitignore');
    } catch {
      // ignore read errors
    }
  }

  // 3. .agentatlasignore (project-specific overrides)
  const atlasIgnorePath = path.join(projectRoot, '.agentatlasignore');
  if (fs.existsSync(atlasIgnorePath)) {
    try {
      const content = fs.readFileSync(atlasIgnorePath, 'utf-8');
      ig.add(content);
      sources.push('.agentatlasignore');
    } catch {
      // ignore read errors
    }
  }

  const shouldIgnore = (filePath: string): boolean => {
    // Normalize to relative forward-slash path
    const rel = path.isAbsolute(filePath)
      ? path.relative(projectRoot, filePath)
      : filePath;
    const normalized = rel.split(path.sep).join('/');
    if (!normalized || normalized.startsWith('..')) return false;
    try {
      return ig.ignores(normalized);
    } catch {
      return false;
    }
  };

  // Glob-level ignores for fast-glob (directory traversal optimization)
  const ignoreGlobs = ALWAYS_IGNORED_DIRS.map(d => `**/${d}/**`);

  return { ignoreGlobs, shouldIgnore, sources };
}
