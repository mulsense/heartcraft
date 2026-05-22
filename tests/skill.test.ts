import { describe, expect, it } from 'vitest';
import {
  extractDescription,
  extractName,
  renderCopilotInstructions,
  renderCursorRule,
  renderGeminiManifest,
  renderGeminiMd,
  renderSkillMd,
} from '../src/lib/skill.js';

// API v1 の frontmatter 形式：name はキャラクター表示名（heart_prompts.name）、slug は識別子。
const HEART_BODY = `---
name: ずんだもん
slug: zundamon
creator: tanaka
description: '明るく元気なずんだもん人格'
---

# ずんだもん人格

あなたはずんだもんなのだ。
`;

describe('renderSkillMd', () => {
  it('embeds the heart body inline below the skill frontmatter', () => {
    const out = renderSkillMd({ user: 'tanaka', name: 'zundamon' }, HEART_BODY);
    expect(out).toContain('name: heartcraft');
    expect(out).toContain('# HeartCraftLab Heart Loader (tanaka/zundamon)');
    expect(out).toContain('あなたはずんだもんなのだ。');
    // 人格本体の frontmatter は剥がす
    expect(out).not.toContain('creator: tanaka');
    // 旧形式の「別ファイル参照」は残っていない
    expect(out).not.toContain('**tanaka/zundamon.md**');
  });
});

describe('renderCursorRule', () => {
  it('emits MDC frontmatter with alwaysApply: true and inlines heart body', () => {
    const out = renderCursorRule({ user: 'tanaka', name: 'zundamon' }, HEART_BODY);
    expect(out).toContain('alwaysApply: true');
    expect(out).toContain('# HeartCraftLab Heart Loader (tanaka/zundamon)');
    expect(out).toContain('あなたはずんだもんなのだ。');
    // インライン時に frontmatter は剥がす
    expect(out).not.toContain('creator: tanaka');
  });

});

describe('renderCopilotInstructions', () => {
  it("emits instructions frontmatter with applyTo: '**' and inlines heart body", () => {
    const out = renderCopilotInstructions({ user: 'tanaka', name: 'zundamon' }, HEART_BODY);
    expect(out).toContain("applyTo: '**'");
    expect(out).toContain('# HeartCraftLab Heart Loader (tanaka/zundamon)');
    expect(out).toContain('あなたはずんだもんなのだ。');
  });

});

describe('renderGeminiMd', () => {
  it('inlines heart body with active heading', () => {
    const out = renderGeminiMd({ user: 'tanaka', name: 'zundamon' }, HEART_BODY);
    expect(out).toContain('# HeartCraftLab Heart Loader (tanaka/zundamon)');
    expect(out).toContain('あなたはずんだもんなのだ。');
    // インライン時に frontmatter は剥がす
    expect(out).not.toContain('creator: tanaka');
    expect(out).not.toContain('slug: zundamon');
  });

});

describe('renderGeminiManifest', () => {
  it('emits valid JSON with name/version/contextFileName', () => {
    const out = renderGeminiManifest('0.1.0');
    const parsed = JSON.parse(out) as Record<string, unknown>;
    expect(parsed.name).toBe('heartcraft');
    expect(parsed.version).toBe('0.1.0');
    expect(parsed.contextFileName).toBe('GEMINI.md');
  });
});

describe('extractDescription', () => {
  it('extracts plain description', () => {
    const md = '---\nname: x\ndescription: hello world\n---\nbody';
    expect(extractDescription(md)).toBe('hello world');
  });

  it('strips surrounding single quotes (Yaml::dump output)', () => {
    const md = "---\nname: x\ndescription: 'quoted desc'\n---\nbody";
    expect(extractDescription(md)).toBe('quoted desc');
  });

  it('returns empty when no frontmatter', () => {
    expect(extractDescription('just body')).toBe('');
  });

  it('returns empty when description missing', () => {
    expect(extractDescription('---\nname: x\n---\nbody')).toBe('');
  });
});

describe('extractName', () => {
  it('extracts the localized character name', () => {
    expect(extractName(HEART_BODY)).toBe('ずんだもん');
  });

  it('strips surrounding single quotes (Yaml::dump output)', () => {
    const md = "---\nname: 'ギャル'\nslug: gal\n---\nbody";
    expect(extractName(md)).toBe('ギャル');
  });

  it('returns empty when no frontmatter', () => {
    expect(extractName('just body')).toBe('');
  });

  it('returns empty when name missing', () => {
    expect(extractName('---\nslug: x\n---\nbody')).toBe('');
  });
});
