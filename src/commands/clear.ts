import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { renderSkillMd } from '../lib/skill.js';

const SKILLS_SUBPATH = '.claude/skills/heartcraft';

export interface ClearOptions {
  /** SKILL.md を書き出すベースディレクトリ。デフォルトは process.cwd()。 */
  baseDir?: string;
}

export interface ClearResult {
  skillMdPath: string;
}

/** clear サブコマンドの本体。SKILL.md のアクティブ参照だけ消す。Heart 本体は残す。 */
export async function runClear(opts: ClearOptions = {}): Promise<ClearResult> {
  const baseDir = opts.baseDir ?? process.cwd();
  const skillsDir = resolve(baseDir, SKILLS_SUBPATH);
  const skillMdPath = join(skillsDir, 'SKILL.md');

  await mkdir(skillsDir, { recursive: true });
  await writeFile(skillMdPath, renderSkillMd(null), 'utf8');

  return { skillMdPath };
}

/** commander action 用の薄いラッパー */
export async function clearCommand(): Promise<void> {
  const result = await runClear();
  console.log('✓ アクティブなハートプロンプトを解除しました');
  console.log(`  - ${result.skillMdPath}`);
}
