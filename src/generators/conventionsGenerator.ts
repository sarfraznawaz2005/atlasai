import * as path from 'path';
import * as fs from 'fs';
import { ParsedSymbol, ConventionsData } from '../types';
import { fileExists } from '../utils/fileUtils';

type NamingStyle = 'kebab-case' | 'camelCase' | 'snake_case' | 'PascalCase' | 'mixed';

/**
 * Analyze source files and symbols to detect project conventions.
 */
export function generateConventions(
  sourceFiles: string[],
  allSymbols: ParsedSymbol[],
  projectRoot: string
): ConventionsData {
  const fileNaming = detectFileNaming(sourceFiles);
  const functionNaming = detectFunctionNaming(allSymbols);
  const classNaming = detectClassNaming(allSymbols);
  const constantNaming = detectConstantNaming(allSymbols);
  const testRunner = detectTestRunner(projectRoot);
  const testLocation = detectTestLocation(sourceFiles, projectRoot);
  const fileStructure = detectFileStructure(sourceFiles);
  const patterns = detectPatterns(allSymbols, sourceFiles);

  const confidence = computeConfidence(sourceFiles, allSymbols);

  return {
    naming: {
      files: fileNaming,
      functions: functionNaming,
      classes: classNaming,
      constants: constantNaming,
      confidence,
    },
    patterns,
    test_patterns: {
      location: testLocation,
      runner: testRunner,
    },
    file_structure: {
      detected_pattern: fileStructure,
    },
  };
}

function detectFileNaming(sourceFiles: string[]): string {
  let kebab = 0;
  let camel = 0;
  let snake = 0;
  let pascal = 0;

  for (const file of sourceFiles) {
    const basename = path.basename(file, path.extname(file));
    if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(basename)) kebab++;
    else if (/^[a-z][a-zA-Z0-9]+$/.test(basename)) camel++;
    else if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(basename)) snake++;
    else if (/^[A-Z][a-zA-Z0-9]+$/.test(basename)) pascal++;
  }

  const counts = [
    ['kebab-case', kebab],
    ['camelCase', camel],
    ['snake_case', snake],
    ['PascalCase', pascal],
  ] as [string, number][];

  counts.sort((a, b) => b[1] - a[1]);
  const total = kebab + camel + snake + pascal;
  if (total === 0) return 'unknown';

  const dominant = counts[0];
  if (dominant[1] / total > 0.5) return dominant[0];
  return 'mixed';
}

function detectFunctionNaming(allSymbols: ParsedSymbol[]): string {
  const funcSymbols = allSymbols
    .filter(s => s.type === 'function' || s.type === 'method')
    .slice(0, 20);

  if (funcSymbols.length === 0) return 'unknown';

  let camel = 0;
  let snake = 0;
  let pascal = 0;

  for (const sym of funcSymbols) {
    const name = sym.name;
    if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) camel++;
    else if (/^[a-z][a-z0-9_]*$/.test(name) && name.includes('_')) snake++;
    else if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) pascal++;
    else if (/^[a-z][a-z0-9]*$/.test(name)) camel++; // single-word lowercase → camelCase
  }

  const total = camel + snake + pascal;
  if (total === 0) return 'unknown';

  if (camel >= snake && camel >= pascal) return 'camelCase';
  if (snake >= camel && snake >= pascal) return 'snake_case';
  return 'PascalCase';
}

function detectClassNaming(allSymbols: ParsedSymbol[]): string {
  const classSymbols = allSymbols.filter(s => s.type === 'class' || s.type === 'interface');
  if (classSymbols.length === 0) return 'PascalCase'; // convention almost universal

  const isPascal = classSymbols.filter(s => /^[A-Z][a-zA-Z0-9]*$/.test(s.name));
  if (isPascal.length / classSymbols.length > 0.8) return 'PascalCase';
  return 'mixed';
}

function detectConstantNaming(allSymbols: ParsedSymbol[]): string {
  const constSymbols = allSymbols.filter(s => s.type === 'variable' || s.type === 'export');
  if (constSymbols.length === 0) return 'SCREAMING_SNAKE_CASE or camelCase';

  const screaming = constSymbols.filter(s => /^[A-Z][A-Z0-9_]+$/.test(s.name));
  const camel = constSymbols.filter(s => /^[a-z][a-zA-Z0-9]*$/.test(s.name));

  if (screaming.length > camel.length) return 'SCREAMING_SNAKE_CASE';
  if (camel.length > screaming.length) return 'camelCase';
  return 'mixed';
}

function detectTestRunner(projectRoot: string): string {
  const configs = [
    { file: 'jest.config.js', runner: 'jest' },
    { file: 'jest.config.ts', runner: 'jest' },
    { file: 'jest.config.mjs', runner: 'jest' },
    { file: 'vitest.config.ts', runner: 'vitest' },
    { file: 'vitest.config.js', runner: 'vitest' },
    { file: 'pytest.ini', runner: 'pytest' },
    { file: 'setup.cfg', runner: 'pytest' },
    { file: 'pyproject.toml', runner: 'pytest' },
    { file: 'mocha.opts', runner: 'mocha' },
    { file: '.mocharc.yml', runner: 'mocha' },
    { file: '.mocharc.js', runner: 'mocha' },
    { file: 'karma.conf.js', runner: 'karma' },
    { file: 'go.mod', runner: 'go test' },
    { file: 'Cargo.toml', runner: 'cargo test' },
  ];

  for (const config of configs) {
    if (fileExists(path.join(projectRoot, config.file))) {
      // For pyproject.toml check it actually has pytest config
      if (config.file === 'pyproject.toml') {
        try {
          const content = fs.readFileSync(path.join(projectRoot, config.file), 'utf-8');
          if (!content.includes('[tool.pytest') && !content.includes('pytest')) continue;
        } catch {
          continue;
        }
      }
      return config.runner;
    }
  }

  // Check package.json scripts
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fileExists(pkgPath)) {
    try {
      const content = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);
      const testScript = pkg?.scripts?.test || '';
      if (testScript.includes('jest')) return 'jest';
      if (testScript.includes('vitest')) return 'vitest';
      if (testScript.includes('mocha')) return 'mocha';
      if (testScript.includes('jasmine')) return 'jasmine';
    } catch {
      // ignore
    }
  }

  return 'unknown';
}

function detectTestLocation(sourceFiles: string[], projectRoot: string): string {
  const testFiles = sourceFiles.filter(f =>
    f.includes('.test.') || f.includes('.spec.') || f.includes('_test.')
  );

  if (testFiles.length === 0) {
    // Check for separate test directories
    const testDirs = ['tests', 'test', '__tests__', 'spec'];
    for (const dir of testDirs) {
      if (fileExists(path.join(projectRoot, dir))) {
        return `${dir}/ directory`;
      }
    }
    return 'unknown';
  }

  const colocated = testFiles.filter(f => {
    const dir = path.dirname(f);
    return !dir.startsWith('tests') && !dir.startsWith('test') &&
           !dir.startsWith('__tests__') && !dir.startsWith('spec');
  });

  const inTestDir = testFiles.filter(f => {
    const dir = path.dirname(f).replace(/\\/g, '/');
    return dir.startsWith('tests/') || dir.startsWith('test/') ||
           dir.startsWith('__tests__/') || dir.startsWith('spec/') ||
           dir === 'tests' || dir === 'test' || dir === '__tests__' || dir === 'spec';
  });

  if (colocated.length > inTestDir.length) return 'colocated (alongside source)';
  if (inTestDir.length > colocated.length) return 'tests/ directory';
  return 'mixed';
}

function detectFileStructure(sourceFiles: string[]): string {
  const hasSrc = sourceFiles.some(f => f.replace(/\\/g, '/').startsWith('src/'));
  const dirs = new Set<string>();

  for (const file of sourceFiles) {
    const normalized = file.replace(/\\/g, '/');
    const parts = normalized.split('/');
    if (parts.length > 1) dirs.add(parts[0]);
    if (parts.length > 2 && parts[0] === 'src') dirs.add(parts[1]);
  }

  const dirList = Array.from(dirs).map(d => d.toLowerCase());

  if (dirList.includes('controllers') || dirList.includes('controller')) {
    if (dirList.includes('models') || dirList.includes('model')) {
      return 'MVC';
    }
  }

  if (dirList.includes('features') || dirList.includes('modules')) {
    return 'Feature-based';
  }

  const knownLayerDirs = ['services', 'repositories', 'entities', 'domain', 'infrastructure'];
  const layerCount = knownLayerDirs.filter(d => dirList.includes(d)).length;
  if (layerCount >= 2) return 'Layered Architecture';

  if (hasSrc) return 'src/ root with subdirectories';
  return 'flat';
}

function detectPatterns(
  allSymbols: ParsedSymbol[],
  sourceFiles: string[]
): Record<string, string> {
  const patterns: Record<string, string> = {};

  // Detect if Express routes are used
  const hasRoutes = allSymbols.some(s => s.type === 'route');
  if (hasRoutes) {
    patterns['routing'] = 'Express-style route handlers';
  }

  // Detect service pattern
  const serviceSymbols = allSymbols.filter(s =>
    s.type === 'class' && s.name.endsWith('Service')
  );
  if (serviceSymbols.length > 0) {
    patterns['services'] = `Service class pattern (${serviceSymbols.length} service classes found)`;
  }

  // Detect repository pattern
  const repoSymbols = allSymbols.filter(s =>
    s.type === 'class' && (s.name.endsWith('Repository') || s.name.endsWith('Repo'))
  );
  if (repoSymbols.length > 0) {
    patterns['data_access'] = `Repository pattern (${repoSymbols.length} repository classes)`;
  }

  // Detect controller pattern
  const controllerSymbols = allSymbols.filter(s =>
    s.type === 'class' && s.name.endsWith('Controller')
  );
  if (controllerSymbols.length > 0) {
    patterns['controllers'] = `Controller pattern (${controllerSymbols.length} controller classes)`;
  }

  // Detect hook pattern (React)
  const hookSymbols = allSymbols.filter(s =>
    (s.type === 'function' || s.type === 'export') &&
    s.name.startsWith('use') && s.name.length > 3 && /^use[A-Z]/.test(s.name)
  );
  if (hookSymbols.length > 0) {
    patterns['react_hooks'] = `React hooks pattern (${hookSymbols.length} custom hooks)`;
  }

  // TypeScript decorators (NestJS, Angular)
  const hasDecorators = sourceFiles.some(f => {
    const ext = path.extname(f).toLowerCase();
    return ext === '.ts' || ext === '.tsx';
  });
  if (hasDecorators) {
    const nestPatterns = allSymbols.filter(s =>
      s.type === 'class' && (
        s.name.endsWith('Module') || s.name.endsWith('Guard') ||
        s.name.endsWith('Interceptor') || s.name.endsWith('Pipe')
      )
    );
    if (nestPatterns.length > 0) {
      patterns['framework'] = 'NestJS-style decorators pattern';
    }
  }

  return patterns;
}

function computeConfidence(sourceFiles: string[], allSymbols: ParsedSymbol[]): number {
  // Higher confidence with more files/symbols
  const fileScore = Math.min(sourceFiles.length / 20, 1);
  const symbolScore = Math.min(allSymbols.length / 50, 1);
  return Math.round(((fileScore + symbolScore) / 2) * 100) / 100;
}
