import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(__dirname, '../src/cli.ts');
const pkgVersion = (
  JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as { version: string }
).version;

function runCli(args: string[]): string {
  return execFileSync('npx', ['tsx', cliPath, ...args], { encoding: 'utf8' });
}

describe('heartcraft CLI', () => {
  it('prints version with --version', () => {
    const out = runCli(['--version']);
    expect(out.trim()).toBe(pkgVersion);
  });

  it('lists use and clear in help output', () => {
    const out = runCli(['--help']);
    expect(out).toContain('use');
    expect(out).toContain('clear');
  });
});
