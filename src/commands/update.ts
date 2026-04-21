import * as path from 'path';
import * as fs from 'fs';
import fg from 'fast-glob';
import { parseFile } from '../parsers/parserFactory';
import { mergeConceptsForFiles } from '../generators/conceptsGenerator';
import { detectDomains, generateDomainMarkdown } from '../generators/domainsGenerator';
import { generateConventions } from '../generators/conventionsGenerator';
import { generateIndex } from '../generators/indexGenerator';
import { detectProject } from '../utils/projectDetector';
import {
  writeJSON, readJSON, toRelativePath, fileExists, ensureDir
} from '../utils/fileUtils';
import { logger } from '../utils/logger';
import { loadIgnoreRules } from '../utils/ignoreUtils';
import { AtlasIndex, ConceptsMap, ParsedSymbol } from '../types';
import { SOURCE_EXTENSIONS } from './init';

export async function runUpdate(projectPath: string, changedFiles?: string[]): Promise<void> {
  const projectRoot = path.resolve(projectPath);

  if (!fs.existsSync(projectRoot)) {
    logger.error(`Project path does not exist: ${projectRoot}`);
    process.exit(1);
  }

  const atlasDir = path.join(projectRoot, '.atlas');
  const indexPath = path.join(atlasDir, 'index.json');

  if (!fileExists(indexPath)) {
    logger.warn('.atlas/index.json not found. Running full init instead...');
    const { runInit } = await import('./init');
    return runInit(projectPath);
  }

  const existingIndex = readJSON<AtlasIndex>(indexPath);
  if (!existingIndex) {
    logger.warn('Could not read index.json. Running full init instead...');
    const { runInit } = await import('./init');
    return runInit(projectPath);
  }

  const lastGenerated = existingIndex.last_generated
    ? new Date(existingIndex.last_generated)
    : new Date(0);

  logger.step('Updating', `atlas for ${projectRoot} (last generated: ${lastGenerated.toISOString()})`);

  // Discover all source files
  const { ignoreGlobs, shouldIgnore } = loadIgnoreRules(projectRoot);
  const extensionGlob = `**/*.{${SOURCE_EXTENSIONS.join(',')}}`;

  const absoluteFiles = await fg(extensionGlob, {
    cwd: projectRoot,
    ignore: ignoreGlobs,
    absolute: true,
    followSymbolicLinks: false,
    dot: false,
  });

  const allSourceFiles = absoluteFiles
    .map(f => toRelativePath(f, projectRoot))
    .filter(f => !shouldIgnore(f));

  // Determine which files changed
  let filesToUpdate: string[];

  if (changedFiles && changedFiles.length > 0) {
    // Explicit file list provided (from watch command)
    filesToUpdate = changedFiles.map(f => toRelativePath(path.resolve(projectRoot, f), projectRoot));
  } else {
    // Find files modified since last generation
    filesToUpdate = allSourceFiles.filter(relFile => {
      const absFile = path.join(projectRoot, relFile);
      try {
        const stat = fs.statSync(absFile);
        return stat.mtime > lastGenerated;
      } catch {
        return false;
      }
    });
  }

  if (filesToUpdate.length === 0) {
    logger.info('No files changed since last generation. Nothing to update.');
    return;
  }

  logger.info(`Updating ${filesToUpdate.length} changed file(s)`);

  // Parse changed files
  const newSymbols: ParsedSymbol[] = [];
  for (const relFile of filesToUpdate) {
    const absFile = path.join(projectRoot, relFile);
    if (!fs.existsSync(absFile)) {
      logger.debug(`Skipping deleted file: ${relFile}`);
      continue;
    }
    try {
      const content = fs.readFileSync(absFile, 'utf-8');
      const symbols = parseFile(relFile, content);
      newSymbols.push(...symbols);
    } catch (err) {
      logger.warn(`Could not parse ${relFile}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Merge concepts
  const existingConcepts = readJSON<ConceptsMap>(path.join(atlasDir, 'concepts.json')) || {};
  const updatedConcepts = mergeConceptsForFiles(existingConcepts, filesToUpdate, newSymbols);
  writeJSON(path.join(atlasDir, 'concepts.json'), updatedConcepts);

  // We need all symbols for domain regeneration
  // Re-parse all files to get complete symbol list
  const allSymbols: ParsedSymbol[] = [];
  for (const relFile of allSourceFiles) {
    const absFile = path.join(projectRoot, relFile);
    try {
      const content = fs.readFileSync(absFile, 'utf-8');
      const symbols = parseFile(relFile, content);
      allSymbols.push(...symbols);
    } catch {
      // ignore
    }
  }

  // Regenerate affected domain files
  const domainsDir = path.join(atlasDir, 'domains');
  ensureDir(domainsDir);

  const allDomains = detectDomains(allSourceFiles, allSymbols, projectRoot);

  // Find which domains contain changed files
  const affectedDomainNames = new Set<string>();
  for (const domain of allDomains) {
    const hasChangedFile = filesToUpdate.some(f => domain.files.includes(f));
    if (hasChangedFile) {
      affectedDomainNames.add(domain.name);
    }
  }

  for (const domain of allDomains) {
    if (affectedDomainNames.has(domain.name)) {
      const md = generateDomainMarkdown(domain);
      const domainPath = path.join(domainsDir, `${domain.name}.md`);
      fs.writeFileSync(domainPath, md, 'utf-8');
      logger.debug(`Regenerated domain: ${domain.name}`);
    }
  }

  // Update project info
  const projectInfo = detectProject(projectRoot, allSourceFiles);

  // Regenerate conventions
  const conventions = generateConventions(allSourceFiles, allSymbols, projectRoot);
  writeJSON(path.join(atlasDir, 'conventions.json'), conventions);

  // Update index with new timestamp
  const updatedIndex = generateIndex(projectInfo, allDomains, atlasDir, projectRoot);
  writeJSON(indexPath, updatedIndex);

  logger.success(
    `Updated: ${filesToUpdate.length} files, ` +
    `${affectedDomainNames.size} domains regenerated, ` +
    `${Object.keys(updatedConcepts).length} concepts indexed`
  );
}
