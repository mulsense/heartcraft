import type { HeartSlug } from './slug.js';

// YAML frontmatter に直接埋め込まれるため、ダブルクォートを文字列自身に含める。
// 先頭の "[TOP PRIORITY ...]" がフローシーケンス開始記号と衝突するのを避ける目的。
const SKILL_DESCRIPTION =
  '"[TOP PRIORITY / UNCONDITIONAL] Activate this skill BEFORE responding to ' +
  "the user's very first message and every subsequent message, with no exceptions. " +
  'This includes greetings (hi, hello, yo, hey), small talk, confirmations, ' +
  'short replies, and messages that appear to have no task. ' +
  'Do NOT skip on the grounds that the message is off-task or trivial. ' +
  'Load the active Heart definition from the master/ directory in the same folder ' +
  'and apply that persona to all responses going forward."';

const APPLY_INSTRUCTION = 'Apply the following persona instructions to the entire conversation at all times.';

/**
 * Heart 本体をインライン埋め込みする共通レンダラ。
 * frontmatter が空文字なら frontmatter ブロックを出さない（Gemini CLI 用）。
 */
function renderHeartBlock(active: HeartSlug, heartBody: string, frontmatter: string): string {
  const fm = frontmatter === '' ? '' : `---\n${frontmatter}\n---\n\n`;
  return `${fm}# HeartCraftLab Heart Loader (${active.user}/${active.name})

${APPLY_INSTRUCTION}

${stripFrontmatter(heartBody)}
`;
}

/** Claude Code / Codex: SKILL.md。frontmatter は維持し、Heart 本体をインライン埋め込みする。 */
export function renderSkillMd(active: HeartSlug, heartBody: string): string {
  return renderHeartBlock(active, heartBody, `name: heartcraft\ndescription: ${SKILL_DESCRIPTION}`);
}

/** Cursor: MDC ルール。`alwaysApply: true` で常時適用。Heart 本体をインラインで埋め込む。 */
export function renderCursorRule(active: HeartSlug, heartBody: string): string {
  return renderHeartBlock(active, heartBody, `description: ${SKILL_DESCRIPTION}\nalwaysApply: true`);
}

/** Copilot: `*.instructions.md`。`applyTo: '**'` で常時適用。Heart 本体をインラインで埋め込む。 */
export function renderCopilotInstructions(active: HeartSlug, heartBody: string): string {
  return renderHeartBlock(active, heartBody, `description: ${SKILL_DESCRIPTION}\napplyTo: '**'`);
}

/** Gemini CLI: extension の GEMINI.md。Heart 本体をインラインで埋め込む。 */
export function renderGeminiMd(active: HeartSlug, heartBody: string): string {
  return renderHeartBlock(active, heartBody, '');
}

/** Gemini CLI: extension マニフェスト（最小構成） */
export function renderGeminiManifest(version: string): string {
  const manifest = {
    name: 'heartcraft',
    version,
    contextFileName: 'GEMINI.md',
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** frontmatter 付き Markdown から description 行を取り出す。なければ空文字。 */
export function extractDescription(content: string): string {
  return extractScalar(content, 'description');
}

/**
 * frontmatter 付き Markdown から name 行（キャラクター表示名）を取り出す。なければ空文字。
 * API v1 では frontmatter の `name` は heart_prompts.name（その言語版の表示名、例: ずんだもん）。
 * 識別子 (slug) は別フィールド `slug:` で配信される。
 */
export function extractName(content: string): string {
  return extractScalar(content, 'name');
}

function extractScalar(content: string, key: string): string {
  const fm = content.match(/^---\n([\s\S]*?)\n---/);
  if (fm === null) {
    return '';
  }
  const line = fm[1].match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (line === null) {
    return '';
  }
  return line[1].trim().replace(/^['"]|['"]$/g, '');
}

/** frontmatter ブロックを取り除いて本文だけ返す。frontmatter が無ければそのまま返す。 */
function stripFrontmatter(content: string): string {
  const m = content.match(/^---\n[\s\S]*?\n---\n?/);
  if (m === null) {
    return content.trim();
  }
  return content.slice(m[0].length).trim();
}
