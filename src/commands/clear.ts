import { detectAgents, type AgentAdapter } from '../lib/agents.js';
import { removeFileIfExists } from '../lib/fs.js';

export interface ClearOptions {
  /** activation ファイルを探すベースディレクトリ。デフォルトは process.cwd()。 */
  baseDir?: string;
  /** テスト DI: 検知済 agent を直接渡す。指定したら detectAgents をスキップする。 */
  agents?: readonly AgentAdapter[];
}

export interface ClearAgentResult {
  agent: string;
  displayName: string;
  /** 実際に削除した activation ファイルの絶対パス群。 */
  deletedPaths: string[];
}

export interface ClearResult {
  agents: ClearAgentResult[];
}

/**
 * clear サブコマンドの本体。各 agent の activation ファイルを削除する。
 * Heart 本体ファイル（取得済みキャッシュ）は残す（再度 use で復帰できるように）。
 */
export async function runClear(opts: ClearOptions = {}): Promise<ClearResult> {
  const baseDir = opts.baseDir ?? process.cwd();
  const agents = opts.agents ?? (await detectAgents(baseDir));

  const results: ClearAgentResult[] = [];
  for (const agent of agents) {
    const deletedPaths: string[] = [];
    for (const path of agent.activationPaths(baseDir)) {
      if (await removeFileIfExists(path)) {
        deletedPaths.push(path);
      }
    }
    results.push({
      agent: agent.name,
      displayName: agent.displayName,
      deletedPaths,
    });
  }

  return { agents: results };
}

/** commander action 用の薄いラッパー */
export async function clearCommand(): Promise<void> {
  const result = await runClear();
  const cleared = result.agents.filter((a) => a.deletedPaths.length > 0);

  if (cleared.length === 0) {
    console.log('✓ 解除するアクティブなハートプロンプトはありませんでした');
    return;
  }

  console.log(
    `✓ ${cleared.map((a) => a.displayName).join(' / ')} のアクティブなハートプロンプトを解除しました`,
  );
  for (const a of cleared) {
    console.log(`  [${a.displayName}]`);
    for (const p of a.deletedPaths) {
      console.log(`    - ${p}（削除）`);
    }
  }
}
