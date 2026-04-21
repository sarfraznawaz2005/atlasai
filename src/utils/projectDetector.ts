import * as fs from 'fs';
import * as path from 'path';
import { readJSON, fileExists } from './fileUtils';

export interface ProjectInfo {
  name: string;
  type: string;
  language: string;
  languages: string[];
  entryPoints: Record<string, string>;
  architecturePattern: string;
}

interface PackageJson {
  name?: string;
  main?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface CargoToml {
  package?: { name?: string };
}

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.py': 'Python',
  '.go': 'Go',
  '.rb': 'Ruby',
  '.rs': 'Rust',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.php': 'PHP',
  '.swift': 'Swift',
  '.c': 'C',
  '.cpp': 'C++',
  '.cs': 'C#',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
};

export function detectProject(projectRoot: string, sourceFiles: string[]): ProjectInfo {
  const name = detectProjectName(projectRoot);
  const languages = detectLanguages(sourceFiles);
  const language = languages[0] || 'Unknown';
  const type = detectProjectType(projectRoot);
  const entryPoints = detectEntryPoints(projectRoot);
  const architecturePattern = detectArchitecturePattern(sourceFiles, projectRoot);

  return {
    name,
    type,
    language,
    languages,
    entryPoints,
    architecturePattern,
  };
}

function detectProjectName(projectRoot: string): string {
  // Try package.json
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fileExists(pkgPath)) {
    const pkg = readJSON<PackageJson>(pkgPath);
    if (pkg?.name) return pkg.name;
  }

  // Try Cargo.toml
  const cargoPath = path.join(projectRoot, 'Cargo.toml');
  if (fileExists(cargoPath)) {
    const content = fs.readFileSync(cargoPath, 'utf-8');
    const match = content.match(/name\s*=\s*"([^"]+)"/);
    if (match) return match[1];
  }

  // Try go.mod
  const goModPath = path.join(projectRoot, 'go.mod');
  if (fileExists(goModPath)) {
    const content = fs.readFileSync(goModPath, 'utf-8');
    const match = content.match(/^module\s+(\S+)/m);
    if (match) {
      const parts = match[1].split('/');
      return parts[parts.length - 1];
    }
  }

  // Try pyproject.toml
  const pyprojectPath = path.join(projectRoot, 'pyproject.toml');
  if (fileExists(pyprojectPath)) {
    const content = fs.readFileSync(pyprojectPath, 'utf-8');
    const match = content.match(/name\s*=\s*"([^"]+)"/);
    if (match) return match[1];
  }

  // Fall back to directory name
  return path.basename(projectRoot);
}

function detectLanguages(sourceFiles: string[]): string[] {
  const counts: Record<string, number> = {};

  for (const file of sourceFiles) {
    const ext = path.extname(file).toLowerCase();
    const lang = LANGUAGE_EXTENSIONS[ext];
    if (lang) {
      counts[lang] = (counts[lang] || 0) + 1;
    }
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);
}

function detectProjectType(projectRoot: string): string {
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fileExists(pkgPath)) {
    const pkg = readJSON<PackageJson>(pkgPath);
    if (pkg) {
      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };

      if (allDeps['next']) return 'Next.js';
      if (allDeps['react'] && !allDeps['next']) return 'React';
      if (allDeps['vue']) return 'Vue.js';
      if (allDeps['svelte']) return 'Svelte';
      if (allDeps['express'] || allDeps['fastify'] || allDeps['koa']) return 'Node.js API';
      if (allDeps['@nestjs/core']) return 'NestJS';
      return 'Node.js';
    }
  }

  if (fileExists(path.join(projectRoot, 'Cargo.toml'))) return 'Rust';
  if (fileExists(path.join(projectRoot, 'go.mod'))) return 'Go';
  if (fileExists(path.join(projectRoot, 'requirements.txt')) ||
      fileExists(path.join(projectRoot, 'pyproject.toml'))) {
    if (fileExists(path.join(projectRoot, 'manage.py'))) return 'Django';
    if (fileExists(path.join(projectRoot, 'app.py'))) return 'Flask';
    return 'Python';
  }
  if (fileExists(path.join(projectRoot, 'pom.xml'))) return 'Maven/Java';
  if (fileExists(path.join(projectRoot, 'build.gradle'))) return 'Gradle/Java';

  return 'Unknown';
}

export function detectEntryPoints(projectRoot: string): Record<string, string> {
  const entryPoints: Record<string, string> = {};

  // TypeScript/JavaScript candidates
  const tsCandidates = [
    'src/index.ts',
    'src/main.ts',
    'src/app.ts',
    'src/server.ts',
    'src/main.tsx',
    'src/App.tsx',
    'index.ts',
    'main.ts',
    'app.ts',
    'server.ts',
  ];

  for (const candidate of tsCandidates) {
    const fullPath = path.join(projectRoot, candidate);
    if (fileExists(fullPath)) {
      const label = path.basename(candidate, path.extname(candidate));
      entryPoints[label] = candidate;
    }
  }

  // JavaScript candidates (only if no TS found)
  if (Object.keys(entryPoints).length === 0) {
    const jsCandidates = [
      'src/index.js',
      'src/main.js',
      'src/app.js',
      'src/server.js',
      'index.js',
      'main.js',
    ];
    for (const candidate of jsCandidates) {
      const fullPath = path.join(projectRoot, candidate);
      if (fileExists(fullPath)) {
        const label = path.basename(candidate, path.extname(candidate));
        entryPoints[label] = candidate;
      }
    }
  }

  // Python candidates
  const pyCandidates = ['main.py', 'app.py', 'run.py', 'manage.py', 'wsgi.py'];
  for (const candidate of pyCandidates) {
    const fullPath = path.join(projectRoot, candidate);
    if (fileExists(fullPath)) {
      const label = path.basename(candidate, '.py');
      entryPoints[label] = candidate;
    }
  }

  // Go candidates
  const goCandidates = ['main.go', 'cmd/main.go'];
  for (const candidate of goCandidates) {
    const fullPath = path.join(projectRoot, candidate);
    if (fileExists(fullPath)) {
      entryPoints['main'] = candidate;
    }
  }

  // Check package.json main field
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fileExists(pkgPath)) {
    const pkg = readJSON<PackageJson>(pkgPath);
    if (pkg?.main && !entryPoints['main']) {
      entryPoints['main'] = pkg.main;
    }
  }

  return entryPoints;
}

function detectArchitecturePattern(sourceFiles: string[], projectRoot: string): string {
  const dirs = new Set<string>();
  for (const file of sourceFiles) {
    const rel = file.replace(/\\/g, '/');
    const parts = rel.split('/');
    if (parts.length > 1) dirs.add(parts[0]);
    if (parts.length > 2 && parts[0] === 'src') dirs.add(parts[1]);
  }

  const dirList = Array.from(dirs).map(d => d.toLowerCase());

  // MVC pattern
  if (dirList.includes('controllers') || dirList.includes('controller')) {
    if (dirList.includes('models') || dirList.includes('model')) {
      if (dirList.includes('views') || dirList.includes('view')) {
        return 'MVC';
      }
      return 'MVC (no views)';
    }
  }

  // Layered architecture
  if (dirList.includes('services') || dirList.includes('service')) {
    if (dirList.includes('repositories') || dirList.includes('repository')) {
      return 'Layered (services + repositories)';
    }
    if (dirList.includes('routes') || dirList.includes('api')) {
      return 'Layered (routes + services)';
    }
  }

  // Domain-driven
  if (dirList.includes('domain')) {
    return 'Domain-Driven Design';
  }

  // Feature-based
  const knownFeatures = ['auth', 'users', 'payments', 'orders', 'products', 'notifications'];
  const featureCount = knownFeatures.filter(f => dirList.includes(f)).length;
  if (featureCount >= 2) {
    return 'Feature-based';
  }

  // Modular / CLI pattern: commands + organised modules
  const modularDirs = ['commands', 'generators', 'parsers', 'handlers', 'processors', 'transformers', 'resolvers'];
  const modularCount = modularDirs.filter(d => dirList.includes(d)).length;
  if (modularCount >= 2) {
    return 'Modular';
  }
  if (modularCount >= 1 && dirList.includes('utils')) {
    return 'Modular';
  }

  // Next.js / framework patterns
  if (dirList.includes('pages') || dirList.includes('app')) {
    const pkgPath = path.join(projectRoot, 'package.json');
    if (fileExists(pkgPath)) {
      const pkg = readJSON<PackageJson>(pkgPath);
      const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
      if (deps['next']) return 'Next.js App Router';
    }
  }

  return 'Flat / Unstructured';
}
