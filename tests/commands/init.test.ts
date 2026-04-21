import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { runInit } from '../../src/commands/init';
import { AtlasIndex, ConceptsMap } from '../../src/types';

// Suppress logger output during tests
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    step: jest.fn(),
    summary: jest.fn(),
  },
}));

// Suppress git hook installer during tests
jest.mock('../../src/git/hookInstaller', () => ({
  installGitHook: jest.fn(),
}));

describe('init command - integration test', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-init-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createProjectFiles(files: Record<string, string>): void {
    for (const [relativePath, content] of Object.entries(files)) {
      const fullPath = path.join(tmpDir, relativePath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullPath, content, 'utf-8');
    }
  }

  it('should create .agent-atlas/ directory', async () => {
    createProjectFiles({
      'src/index.ts': 'export const app = {};',
    });

    await runInit(tmpDir);

    expect(fs.existsSync(path.join(tmpDir, '.agent-atlas'))).toBe(true);
  });

  it('should create index.json with correct structure', async () => {
    createProjectFiles({
      'package.json': JSON.stringify({ name: 'test-project', version: '1.0.0' }),
      'src/index.ts': `
export function startServer() {
  console.log('started');
}
      `.trim(),
    });

    await runInit(tmpDir);

    const indexPath = path.join(tmpDir, '.agent-atlas', 'index.json');
    expect(fs.existsSync(indexPath)).toBe(true);

    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as AtlasIndex;

    expect(index.project).toBeDefined();
    expect(index.project.name).toBe('test-project');
    expect(index.entry_points).toBeDefined();
    expect(index.domains).toBeDefined();
    expect(index.concepts_index).toBeDefined();
    expect(index.conventions).toBeDefined();
    expect(index.constraints).toBeDefined();
    expect(index.last_generated).toBeDefined();
    expect(() => new Date(index.last_generated)).not.toThrow();
  });

  it('should create concepts.json with entries from source files', async () => {
    createProjectFiles({
      'src/users/service.ts': `
export function getUserById(id: string) {
  return null;
}

export function createUserAccount(name: string, email: string) {
  return null;
}
      `.trim(),
    });

    await runInit(tmpDir);

    const conceptsPath = path.join(tmpDir, '.agent-atlas', 'concepts.json');
    expect(fs.existsSync(conceptsPath)).toBe(true);

    const concepts = JSON.parse(fs.readFileSync(conceptsPath, 'utf-8')) as ConceptsMap;

    // Should have entries for keywords from the function names
    expect(concepts['user']).toBeDefined();
    expect(concepts['get']).toBeDefined();
    expect(concepts['create']).toBeDefined();
    expect(concepts['account']).toBeDefined();
  });

  it('should create domains/ directory with domain files', async () => {
    createProjectFiles({
      'src/auth/service.ts': `
export class AuthService {
  login(email: string, password: string) {}
}
      `.trim(),
      'src/users/service.ts': `
export class UserService {
  getUser(id: string) {}
}
      `.trim(),
    });

    await runInit(tmpDir);

    const domainsDir = path.join(tmpDir, '.agent-atlas', 'domains');
    expect(fs.existsSync(domainsDir)).toBe(true);

    const domainFiles = fs.readdirSync(domainsDir);
    expect(domainFiles).toContain('auth.md');
    expect(domainFiles).toContain('users.md');
  });

  it('should create conventions.json', async () => {
    createProjectFiles({
      'src/index.ts': `
export function processRequest() {}
export function handleResponse() {}
      `.trim(),
    });

    await runInit(tmpDir);

    const conventionsPath = path.join(tmpDir, '.agent-atlas', 'conventions.json');
    expect(fs.existsSync(conventionsPath)).toBe(true);

    const conventions = JSON.parse(fs.readFileSync(conventionsPath, 'utf-8'));
    expect(conventions.naming).toBeDefined();
    expect(conventions.test_patterns).toBeDefined();
    expect(conventions.file_structure).toBeDefined();
  });

  it('should create constraints.md', async () => {
    createProjectFiles({
      'src/index.ts': 'export const x = 1;',
    });

    await runInit(tmpDir);

    const constraintsPath = path.join(tmpDir, '.agent-atlas', 'constraints.md');
    expect(fs.existsSync(constraintsPath)).toBe(true);

    const content = fs.readFileSync(constraintsPath, 'utf-8');
    expect(content.length).toBeGreaterThan(100);
    expect(content).toContain('Authentication');
  });

  it('should create empty history.jsonl', async () => {
    createProjectFiles({
      'src/index.ts': 'export const x = 1;',
    });

    await runInit(tmpDir);

    const historyPath = path.join(tmpDir, '.agent-atlas', 'history.jsonl');
    expect(fs.existsSync(historyPath)).toBe(true);
    // Should be empty or contain only whitespace
    const content = fs.readFileSync(historyPath, 'utf-8');
    expect(content.trim()).toBe('');
  });

  it('should handle TypeScript and Python mixed project', async () => {
    createProjectFiles({
      'src/app.ts': `
export function startApp() {}
      `.trim(),
      'scripts/migrate.py': `
def run_migrations():
    pass

class MigrationRunner:
    pass
      `.trim(),
    });

    await runInit(tmpDir);

    const conceptsPath = path.join(tmpDir, '.agent-atlas', 'concepts.json');
    const concepts = JSON.parse(fs.readFileSync(conceptsPath, 'utf-8')) as ConceptsMap;

    // Should have symbols from both files
    expect(concepts['start'] || concepts['app'] || concepts['run']).toBeDefined();
  });

  it('should handle errors gracefully when a file cannot be parsed', async () => {
    createProjectFiles({
      'src/index.ts': 'export function hello() {}',
    });

    // Create a binary-ish file that will cause issues
    const badFile = path.join(tmpDir, 'src', 'bad.ts');
    // Write some content that might trip up parsers but should be handled gracefully
    fs.writeFileSync(badFile, 'function ??? () {}', 'utf-8');

    // Should not throw
    await expect(runInit(tmpDir)).resolves.not.toThrow();

    // Atlas should still be created
    expect(fs.existsSync(path.join(tmpDir, '.agent-atlas', 'index.json'))).toBe(true);
  });

  it('should detect multiple domains correctly', async () => {
    createProjectFiles({
      'src/auth/login.ts': 'export function login() {}',
      'src/users/profile.ts': 'export function getProfile() {}',
      'src/payments/checkout.ts': 'export function checkout() {}',
    });

    await runInit(tmpDir);

    const index = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.agent-atlas', 'index.json'), 'utf-8')
    ) as AtlasIndex;

    expect(Object.keys(index.domains)).toContain('auth');
    expect(Object.keys(index.domains)).toContain('users');
    expect(Object.keys(index.domains)).toContain('payments');
  });

  it('should populate entry_points from detected entry files', async () => {
    createProjectFiles({
      'src/index.ts': 'export {}',
      'src/app.ts': 'export {}',
    });

    await runInit(tmpDir);

    const index = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.agent-atlas', 'index.json'), 'utf-8')
    ) as AtlasIndex;

    // Should detect src/index.ts and/or src/app.ts as entry points
    expect(Object.keys(index.entry_points).length).toBeGreaterThan(0);
  });

  it('should write bridge line to CLAUDE.md if it exists', async () => {
    createProjectFiles({
      'src/index.ts': 'export {}',
      'CLAUDE.md': '# Claude Instructions\n\nSome existing content.\n',
    });

    await runInit(tmpDir);

    const claudeMd = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    expect(claudeMd).toContain('.agent-atlas/index.json');
  });

  it('should not write bridge line to CLAUDE.md if it does not exist', async () => {
    createProjectFiles({
      'src/index.ts': 'export {}',
    });

    await runInit(tmpDir);

    expect(fs.existsSync(path.join(tmpDir, 'CLAUDE.md'))).toBe(false);
  });

  it('should not duplicate bridge line if already present', async () => {
    createProjectFiles({
      'src/index.ts': 'export {}',
      'CLAUDE.md': '# Instructions\n\nBefore starting any task, read .agent-atlas/index.json first.\n',
    });

    await runInit(tmpDir);
    await runInit(tmpDir); // run twice

    const claudeMd = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
    const occurrences = (claudeMd.match(/\.agent-atlas\/index\.json/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it('should fail gracefully with a non-existent path', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });

    await expect(runInit('/non/existent/path/xyz')).rejects.toThrow();

    mockExit.mockRestore();
  });
});
