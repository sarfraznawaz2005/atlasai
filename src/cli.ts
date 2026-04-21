#!/usr/bin/env node

import { Command } from 'commander';
import { runInit } from './commands/init';
import { runUpdate } from './commands/update';
import { runWatch } from './commands/watch';
import { version } from '../package.json';

const program = new Command();

program
  .name('agent-atlas')
  .description('Auto-generate a navigational index for AI agents to understand any codebase')
  .version(version);

program
  .command('init [path]')
  .description('Full generation of all .agent-atlas/ files for a project')
  .action(async (projectPath: string = '.') => {
    await runInit(projectPath);
  });

program
  .command('update [path]')
  .description('Incremental update — only changed files are re-processed')
  .action(async (projectPath: string = '.') => {
    await runUpdate(projectPath);
  });

program
  .command('watch [path]')
  .description('Watch mode — auto-updates .agent-atlas/ on file save')
  .action(async (projectPath: string = '.') => {
    await runWatch(projectPath);
  });

program.parseAsync(process.argv).catch((err: Error) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
