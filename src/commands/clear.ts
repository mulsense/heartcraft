import { detectAgents, type AgentAdapter } from '../lib/agents.js';
import { writeFileEnsureDir } from '../lib/fs.js';

export interface ClearOptions {
  /** SKILL.md 等 activation ファイルを書き出すベースディレクトリ。デフォルトは process.cwd()。 */
  baseDir?: string;
  /** テスト DI: 検知済 agent を直接渡す。指定したら detectAgents をスキップする。 */
  agents?: readonly AgentAdapter[];
}

export interface ClearAgentResult {
  agent: string;
  displayName: string;
  activationPaths: string[];
}

export interface ClearResult {
  agents: ClearAgentResult[];
}

/**
 * clear サブコマンドの本体。各 agent の activation ファイルを inactive 状態に書き換える。
 * Heart 本体ファイルは残す（再度 use で復帰できるように）。
 */
export async function runClear(opts: ClearOptions = {}): Promise<ClearResult> {
  const baseDir = opts.baseDir ?? process.cwd();
  const agents = opts.agents ?? (await detectAgents(baseDir));

  const results: ClearAgentResult[] = [];
  for (const agent of agents) {
    const activation = agent.renderActivation(baseDir, null, null);
    for (const file of activation) {
      await writeFileEnsureDir(file.path, file.content);
    }
    results.push({
      agent: agent.name,
      displayName: agent.displayName,
      activationPaths: activation.map((f) => f.path),
    });
  }

  return { agents: results };
}

/** commander action 用の薄いラッパー */
export async function clearCommand(): Promise<void> {
  const result = await runClear();
  console.log(`✓ ${result.agents.map((a) => a.displayName).join(' / ')} のアクティブなハートプロンプトを解除しました`);
  for (const a of result.agents) {
    console.log(`  [${a.displayName}]`);
    for (const ap of a.activationPaths) {
      console.log(`    - ${ap}`);
    }
  }
}
