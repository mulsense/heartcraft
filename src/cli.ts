#!/usr/bin/env node
import { Command } from 'commander';
import { installCommand } from './commands/install.js';
import { readCliVersion } from './lib/version.js';

const program = new Command();

program
  .name('heartcraft')
  .description('AI 人格プロンプト（Heart）を Claude Code に導入する CLI')
  .version(await readCliVersion());

program
  .command('install <slug>')
  .description('Heart をサーバから取得して .claude/skills/heartcraft/ に配置する')
  .action(installCommand);

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`✗ ${message}`);
  process.exit(1);
});
