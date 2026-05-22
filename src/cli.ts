#!/usr/bin/env node
import { Command } from 'commander';
import { clearCommand } from './commands/clear.js';
import { useCommand } from './commands/use.js';
import { readCliVersion } from './lib/version.js';

const program = new Command();

program
  .name('heartcraft')
  .description('AI 人格プロンプト（Heart）を Claude Code に導入する CLI')
  .version(await readCliVersion());

program
  .command('use <slug>')
  .description('Heart をアクティブ化する。ローカルに無ければサーバから取得して配置する')
  .action(useCommand);

program
  .command('clear')
  .description('アクティブ Heart の activation ファイルを削除する（取得済みキャッシュは残す）')
  .action(clearCommand);

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`✗ ${message}`);
  process.exit(1);
});
