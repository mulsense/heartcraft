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

const INACTIVE_MESSAGE = 'No Heart is currently active.';

const APPLY_INSTRUCTION = 'Apply the following persona instructions to the entire conversation at all times.';

/** Claude Code: SKILL.md（同ディレクトリの Heart ファイルを参照する） */
export function renderSkillMd(active: HeartSlug | null): string {
  const body = active === null
    ? INACTIVE_MESSAGE
    : `When this skill is loaded, immediately read **${active.user}/${active.name}.md** from the same directory and apply the persona instructions written there to the entire conversation.`;

  return `---
name: heartcraft
description: ${SKILL_DESCRIPTION}
---

# HeartCraftLab Heart Loader

${body}
`;
}

/** Cursor: MDC ルール。`alwaysApply: true` で常時適用。Heart 本体をインラインで埋め込む。 */
export function renderCursorRule(active: HeartSlug | null, heartBody: string | null): string {
  if (active === null || heartBody === null) {
    return `---
description: ${SKILL_DESCRIPTION}
alwaysApply: true
---

# HeartCraftLab Heart Loader

${INACTIVE_MESSAGE}
`;
  }

  return `---
description: ${SKILL_DESCRIPTION}
alwaysApply: true
---

# HeartCraftLab Heart Loader (${active.user}/${active.name})

${APPLY_INSTRUCTION}

${stripFrontmatter(heartBody)}
`;
}

/** Copilot: `*.instructions.md`。`applyTo: '**'` で常時適用。Heart 本体をインラインで埋め込む。 */
export function renderCopilotInstructions(active: HeartSlug | null, heartBody: string | null): string {
  if (active === null || heartBody === null) {
    return `---
description: ${SKILL_DESCRIPTION}
applyTo: '**'
---

# HeartCraftLab Heart Loader

${INACTIVE_MESSAGE}
`;
  }

  return `---
description: ${SKILL_DESCRIPTION}
applyTo: '**'
---

# HeartCraftLab Heart Loader (${active.user}/${active.name})

${APPLY_INSTRUCTION}

${stripFrontmatter(heartBody)}
`;
}

/** Gemini CLI: extension の GEMINI.md。Heart 本体をインラインで埋め込む。 */
export function renderGeminiMd(active: HeartSlug | null, heartBody: string | null): string {
  if (active === null || heartBody === null) {
    return `# HeartCraftLab Heart Loader

${INACTIVE_MESSAGE}
`;
  }

  return `# HeartCraftLab Heart Loader (${active.user}/${active.name})

${APPLY_INSTRUCTION}

${stripFrontmatter(heartBody)}
`;
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
  const fm = content.match(/^---\n([\s\S]*?)\n---/);
  if (fm === null) {
    return '';
  }
  const desc = fm[1].match(/^description:\s*(.+)$/m);
  if (desc === null) {
    return '';
  }
  return desc[1].trim().replace(/^['"]|['"]$/g, '');
}

/** frontmatter ブロックを取り除いて本文だけ返す。frontmatter が無ければそのまま返す。 */
function stripFrontmatter(content: string): string {
  const m = content.match(/^---\n[\s\S]*?\n---\n?/);
  if (m === null) {
    return content.trim();
  }
  return content.slice(m[0].length).trim();
}
