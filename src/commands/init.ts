import * as path from 'path';
import * as fs from 'fs';
import fg from 'fast-glob';
import { parseFile } from '../parsers/parserFactory';
import { generateConcepts } from '../generators/conceptsGenerator';
import { detectDomains, generateDomainMarkdown } from '../generators/domainsGenerator';
import { generateConventions } from '../generators/conventionsGenerator';
import { generateIndex, generateConstraintsMd } from '../generators/indexGenerator';
import { installGitHook } from '../git/hookInstaller';
import { detectProject } from '../utils/projectDetector';
import { writeJSON, writeFile, ensureDir, toRelativePath, fileExists } from '../utils/fileUtils';
import { logger } from '../utils/logger';
import { loadIgnoreRules } from '../utils/ignoreUtils';
import { ParsedSymbol } from '../types';

const SOURCE_EXTENSIONS = [
  'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rb', 'rs',
  'java', 'kt', 'php', 'swift', 'c', 'cpp', 'cs', 'vue', 'svelte',
];

export async function runInit(projectPath: string): Promise<void> {
  const projectRoot = path.resolve(projectPath);

  if (!fs.existsSync(projectRoot)) {
    logger.error(`Project path does not exist: ${projectRoot}`);
    process.exit(1);
  }

  if (!fs.statSync(projectRoot).isDirectory()) {
    logger.error(`Project path is not a directory: ${projectRoot}`);
    process.exit(1);
  }

  logger.step('Initializing', `atlas for ${projectRoot}`);

  const atlasDir = path.join(projectRoot, '.agent-atlas');
  const domainsDir = path.join(atlasDir, 'domains');
  ensureDir(atlasDir);
  ensureDir(domainsDir);

  // Discover source files
  logger.step('Discovering', 'source files...');
  const { ignoreGlobs, shouldIgnore, sources } = loadIgnoreRules(projectRoot);
  logger.info(`Ignore rules loaded from: ${sources.join(', ')}`);

  const extensionGlob = `**/*.{${SOURCE_EXTENSIONS.join(',')}}`;

  const absoluteFiles = await fg(extensionGlob, {
    cwd: projectRoot,
    ignore: ignoreGlobs,
    absolute: true,
    followSymbolicLinks: false,
    dot: false,
  });

  const sourceFiles = absoluteFiles
    .map(f => toRelativePath(f, projectRoot))
    .filter(f => !shouldIgnore(f));

  if (sourceFiles.length === 0) {
    logger.warn(`No source files found in ${projectRoot}.`);
    logger.warn('Check that the path is correct and contains supported source files (.ts, .js, .py, .go, etc.)');
    logger.warn('If files are being excluded, check your .gitignore or .agentatlasignore.');
    process.exit(1);
  }

  logger.info(`Found ${sourceFiles.length} source files`);

  // Parse all files
  logger.step('Parsing', 'source files...');
  const allSymbols: ParsedSymbol[] = [];
  let parseErrors = 0;

  for (const relFile of sourceFiles) {
    const absFile = path.join(projectRoot, relFile);
    try {
      const content = fs.readFileSync(absFile, 'utf-8');
      const symbols = parseFile(relFile, content);
      allSymbols.push(...symbols);
    } catch (err) {
      parseErrors++;
      logger.warn(`Could not read ${relFile}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  logger.info(`Extracted ${allSymbols.length} symbols from ${sourceFiles.length} files`);
  if (parseErrors > 0) {
    logger.warn(`${parseErrors} files could not be read`);
  }

  // Detect project info
  const projectInfo = detectProject(projectRoot, sourceFiles);

  // Generate concepts
  logger.step('Generating', 'concepts.json...');
  const conceptsMap = generateConcepts(allSymbols);
  writeJSON(path.join(atlasDir, 'concepts.json'), conceptsMap);

  // Generate domains
  logger.step('Generating', 'domain files...');
  const domains = detectDomains(sourceFiles, allSymbols, projectRoot);
  for (const domain of domains) {
    const md = generateDomainMarkdown(domain);
    writeFile(path.join(domainsDir, `${domain.name}.md`), md);
  }
  logger.info(`Generated ${domains.length} domain files`);

  // Generate conventions
  logger.step('Generating', 'conventions.json...');
  const conventions = generateConventions(sourceFiles, allSymbols, projectRoot);
  writeJSON(path.join(atlasDir, 'conventions.json'), conventions);

  // Generate constraints template
  logger.step('Generating', 'constraints.md...');
  const constraintsMd = generateConstraintsMd();
  writeFile(path.join(atlasDir, 'constraints.md'), constraintsMd);

  // Initialize history.jsonl (empty)
  const historyPath = path.join(atlasDir, 'history.jsonl');
  if (!fileExists(historyPath)) {
    writeFile(historyPath, '');
  }

  // Generate index
  logger.step('Generating', 'index.json...');
  const index = generateIndex(projectInfo, domains, atlasDir, projectRoot);
  writeJSON(path.join(atlasDir, 'index.json'), index);

  // Install git hook
  installGitHook(projectRoot);

  // Write bridge lines to AI config files
  writeBridgeLines(projectRoot);

  // Print summary
  logger.summary([
    `${sourceFiles.length} files scanned`,
    `${allSymbols.length} symbols extracted`,
    `${domains.length} domains detected`,
    `${Object.keys(conceptsMap).length} concept keywords indexed`,
    `Project type: ${projectInfo.type}`,
    `Architecture: ${projectInfo.architecturePattern}`,
    `.agent-atlas/ directory created at ${atlasDir}`,
  ]);
}

function writeBridgeLines(projectRoot: string): void {
  const bridgeLine = `IMPORTANT: Before starting any task, read and follow .agent-atlas/index.json — a codebase navigation layer providing domain docs, a keyword→file:line concepts index, conventions, and constraints.\n\n`;
  const bridgeFiles = ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md', '.cursorrules'];

  for (const bridgeFile of bridgeFiles) {
    const filePath = path.join(projectRoot, bridgeFile);
    if (fileExists(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (!content.includes('.agent-atlas/index.json')) {
        fs.writeFileSync(filePath, bridgeLine + content, 'utf-8');
        logger.info(`Added atlas bridge line to ${bridgeFile}`);
      }
    }
  }
}

export { SOURCE_EXTENSIONS };
