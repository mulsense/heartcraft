import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(__dirname, '../src/cli.ts');

function runCli(args: string[]): string {
  return execFileSync('npx', ['tsx', cliPath, ...args], { encoding: 'utf8' });
}

describe('heartcraft CLI', () => {
  it('prints version with --version', () => {
    const out = runCli(['--version']);
    expect(out.trim()).toBe('0.0.1');
  });

  it('lists install in help output', () => {
    const out = runCli(['--help']);
    expect(out).toContain('install');
  });
});
