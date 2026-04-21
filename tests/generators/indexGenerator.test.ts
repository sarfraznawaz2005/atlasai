import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { generateIndex, generateConstraintsMd } from '../../src/generators/indexGenerator';
import { detectEntryPoints } from '../../src/utils/projectDetector';
import { DomainInfo } from '../../src/types';

describe('generateIndex', () => {
  const projectInfo = {
    name: 'my-app',
    type: 'Node.js API',
    language: 'TypeScript',
    languages: ['TypeScript', 'JavaScript'],
    entryPoints: { main: 'src/index.ts' },
    architecturePattern: 'Layered (routes + services)',
  };

  const domains: DomainInfo[] = [
    {
      name: 'auth',
      dirPath: 'src/auth',
      files: ['src/auth/service.ts'],
      symbols: [],
    },
    {
      name: 'users',
      dirPath: 'src/users',
      files: ['src/users/service.ts'],
      symbols: [],
    },
  ];

  it('should include project info', () => {
    const index = generateIndex(projectInfo, domains, '/project/.atlas', '/project');

    expect(index.project.name).toBe('my-app');
    expect(index.project.type).toBe('Node.js API');
    expect(index.project.language).toBe('TypeScript');
    expect(index.project.languages).toContain('TypeScript');
  });

  it('should include entry points', () => {
    const index = generateIndex(projectInfo, domains, '/project/.atlas', '/project');
    expect(index.entry_points).toMatchObject({ main: 'src/index.ts' });
  });

  it('should include domain references', () => {
    const index = generateIndex(projectInfo, domains, '/project/.atlas', '/project');

    expect(index.domains['auth']).toContain('auth.md');
    expect(index.domains['users']).toContain('users.md');
  });

  it('should reference the concepts index', () => {
    const index = generateIndex(projectInfo, domains, '/project/.atlas', '/project');
    expect(index.concepts_index).toContain('concepts.json');
  });

  it('should reference the conventions file', () => {
    const index = generateIndex(projectInfo, domains, '/project/.atlas', '/project');
    expect(index.conventions).toContain('conventions.json');
  });

  it('should reference the constraints file', () => {
    const index = generateIndex(projectInfo, domains, '/project/.atlas', '/project');
    expect(index.constraints).toContain('constraints.md');
  });

  it('should include architecture pattern', () => {
    const index = generateIndex(projectInfo, domains, '/project/.atlas', '/project');
    expect(index.architecture_pattern).toBe('Layered (routes + services)');
  });

  it('should include last_generated timestamp', () => {
    const before = new Date();
    const index = generateIndex(projectInfo, domains, '/project/.atlas', '/project');
    const after = new Date();

    const generated = new Date(index.last_generated);
    expect(generated.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(generated.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should handle empty domains', () => {
    const index = generateIndex(projectInfo, [], '/project/.atlas', '/project');
    expect(index.domains).toEqual({});
  });
});

describe('detectEntryPoints', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-test-entry-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should detect src/index.ts', () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir);
    fs.writeFileSync(path.join(srcDir, 'index.ts'), 'export {}');

    const entries = detectEntryPoints(tmpDir);
    expect(entries['index']).toBe('src/index.ts');
  });

  it('should detect src/main.ts', () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir);
    fs.writeFileSync(path.join(srcDir, 'main.ts'), 'export {}');

    const entries = detectEntryPoints(tmpDir);
    expect(entries['main']).toBe('src/main.ts');
  });

  it('should detect src/app.ts', () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir);
    fs.writeFileSync(path.join(srcDir, 'app.ts'), 'export {}');

    const entries = detectEntryPoints(tmpDir);
    expect(entries['app']).toBe('src/app.ts');
  });

  it('should detect src/server.ts', () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir);
    fs.writeFileSync(path.join(srcDir, 'server.ts'), 'export {}');

    const entries = detectEntryPoints(tmpDir);
    expect(entries['server']).toBe('src/server.ts');
  });

  it('should detect main.py for Python projects', () => {
    fs.writeFileSync(path.join(tmpDir, 'main.py'), '# python');

    const entries = detectEntryPoints(tmpDir);
    expect(entries['main']).toBe('main.py');
  });

  it('should detect main.go for Go projects', () => {
    fs.writeFileSync(path.join(tmpDir, 'main.go'), 'package main');

    const entries = detectEntryPoints(tmpDir);
    expect(entries['main']).toBe('main.go');
  });

  it('should read main from package.json', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test', main: 'dist/index.js' })
    );

    const entries = detectEntryPoints(tmpDir);
    expect(entries['main']).toBe('dist/index.js');
  });

  it('should return empty object when no entry points found', () => {
    const entries = detectEntryPoints(tmpDir);
    expect(Object.keys(entries)).toHaveLength(0);
  });
});

describe('generateConstraintsMd', () => {
  it('should contain Authentication section', () => {
    const md = generateConstraintsMd();
    expect(md).toContain('Authentication');
  });

  it('should contain Security section', () => {
    const md = generateConstraintsMd();
    expect(md).toContain('Security');
  });

  it('should contain Testing section', () => {
    const md = generateConstraintsMd();
    expect(md).toContain('Testing');
  });

  it('should contain Data Validation section', () => {
    const md = generateConstraintsMd();
    expect(md).toContain('Data Validation');
  });

  it('should contain Error Handling section', () => {
    const md = generateConstraintsMd();
    expect(md).toContain('Error Handling');
  });

  it('should indicate it is a template needing review', () => {
    const md = generateConstraintsMd();
    expect(md.toLowerCase()).toMatch(/template|review|todo/i);
  });
});
