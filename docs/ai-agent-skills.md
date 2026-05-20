# AI コーディングエージェントのカスタム拡張機構 比較調査

**調査時点**：2026 年 5 月
**目的**：主要 AI コーディングエージェントが「Skills / Rules / Instructions」など、ユーザーがカスタムプロンプト・人格・専門知識を持ち込んでエージェントの挙動を拡張する仕組みを、それぞれどう設計しているかを公式ドキュメントベースで整理する。HeartCraft CLI の配信レイヤー設計（どの形式に乗るとクロスエージェント互換が取りやすいか）の判断材料にする。

---

## 1. Claude Code (Anthropic)

- **ファイル形式**：Skills は `SKILL.md`（Markdown + YAML frontmatter）、CLAUDE.md はプレーン Markdown、subagent / slash command は Markdown + frontmatter。
- **配置場所**：
  - Skills：`~/.claude/skills/<name>/SKILL.md`（Personal）、`.claude/skills/<name>/SKILL.md`（Project）、Enterprise managed、Plugin の `skills/` 配下。
  - Subagents：`~/.claude/agents/` / `.claude/agents/`。
  - Slash commands：`~/.claude/commands/` / `.claude/commands/`（2025 年末に Skills へ統合され、`.claude/commands/deploy.md` と `.claude/skills/deploy/SKILL.md` は等価扱い）。
  - CLAUDE.md：プロジェクトルート、`~/.claude/CLAUDE.md`、サブディレクトリの `.claude/`。
- **発火条件 / スコープ制御**：Skills は frontmatter の `description` をモデルが読んで自律発火、`/skill-name` で明示呼び出し、`paths` で glob 限定、`disable-model-invocation: true` で手動専用、`user-invocable: false` で背景知識化。CLAUDE.md は常時ロード。subagent は `description` ベースで委譲。
- **配布・共有**：`.claude/` を git に commit、または **Plugins / Marketplaces**（`/plugin marketplace add anthropics/claude-plugins-official` のように追加）。Plugin は skills / commands / agents / hooks / MCP をバンドル可能。
- **frontmatter フィールド（Skills）**：`name`, `description`, `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `model`, `effort`, `context: fork`, `agent`, `hooks`, `paths`, `shell`。
- **互換性**：[Agent Skills 公開標準](https://agentskills.io) に準拠し、Cursor / Codex CLI など 20 以上のツールで同じ SKILL.md が動く。CLAUDE.md は Copilot 等にも認識される。

## 2. Gemini CLI (Google)

- **ファイル形式**：Extension は `gemini-extension.json`（必須マニフェスト）+ `GEMINI.md`（Markdown）+ TOML カスタムコマンド。frontmatter は使わず JSON / TOML 中心。
- **配置場所**：ユーザーは `~/.gemini/extensions/<name>/`、プロジェクトは `.gemini/`。GEMINI.md は workspace ルートに自動検出。
- **発火条件 / スコープ制御**：GEMINI.md は workspace を開けば常時ロード。Extension はインストールすれば常駐し、`excludeTools` で組み込みツールを抑制可能。カスタムコマンドは `/name` で明示呼び出し（衝突時は `/gcp.deploy` のように名前空間化）。
- **配布・共有**：`gemini extensions install <github-url>` または `--path` / `link` で配布。Google が 2025 年 10 月に 70+ パートナー extension を提供する公式エコシステムを開設。
- **マニフェストフィールド**：`name`, `version`, `mcpServers`, `contextFileName`（既定 `GEMINI.md`）, `excludeTools`。変数展開 `${extensionPath}` / `${workspacePath}` / `${/}` をサポート。
- **互換性**：GEMINI.md は Copilot / Codex CLI でも認識される。AGENTS.md は Google も共同提唱者で、Gemini CLI も対応。

## 3. OpenAI Codex CLI

- **ファイル形式**：`AGENTS.md`（プレーン Markdown、frontmatter なし）。`~/.codex/config.toml` で挙動を設定。
- **配置場所**：`~/.codex/AGENTS.md`（Global）と、Git ルートから cwd までの各ディレクトリの `AGENTS.md`（Nested）。各レベルで `AGENTS.override.md` があればそちらを優先。
- **発火条件 / スコープ制御**：タスク起動時に instruction chain を構築し、**親から子へ降りるディレクトリ順に連結。下層ほど後勝ち（later overrides earlier）**。ネストにより自然にスコープ制御。combined サイズは `project_doc_max_bytes`（既定 32 KiB）で制限。
- **配布・共有**：git にチェックインするだけ。専用マーケットプレイスは無く、シンプルさが特徴。フォールバック名（例 `TEAM_GUIDE.md`）を `project_doc_fallback_filenames` で受け付け可能。
- **frontmatter フィールド**：無し。本文を見出しで章立てするのが慣行（公式 `openai/codex` の AGENTS.md も「Rust / TUI conventions / Tests」など見出しベース）。
- **互換性**：**AGENTS.md 標準の提唱元の 1 つ**（OpenAI / Google / Cursor / Factory / Sourcegraph 共同で発表、Linux Foundation 配下の Agentic AI Foundation が管理）。Cursor / Copilot / Gemini CLI / Jules / Aider / Zed なども読む。

## 4. Cursor

- **ファイル形式**：Project Rules は `.mdc`（Markdown + YAML frontmatter）。User Rules はプレーンテキスト（設定 UI）。レガシーは単一の `.cursorrules`。
- **配置場所**：`.cursor/rules/*.mdc`（プロジェクト、サブディレクトリにもネスト可）、User Rules は IDE 設定でグローバル。Team Rules はダッシュボードで組織配布。AGENTS.md にも対応。
- **発火条件 / 4 モード**：
  1. **Always Apply** (`alwaysApply: true`) — 全会話に常駐。
  2. **Auto Attached** (`globs:` に一致するファイルを開く / 編集時) — 自動添付。
  3. **Agent Requested** (`description:` をモデルが評価して関連性で添付)。
  4. **Manual** (`@rule-name` で明示参照)。
- **配布・共有**：`.cursor/rules/` を git で共有。Team Rules はダッシュボード配信。Notepads は会話間で再利用するスニペット。Memories は会話から自動生成され workspace に保存。
- **frontmatter フィールド**：`description`, `globs`, `alwaysApply`。500 行以下推奨。
- **互換性**：AGENTS.md 共同提唱者。`.mdc` の `description` ベース選択は Claude Skills と思想がほぼ同じ。

## 5. GitHub Copilot

- **ファイル形式**：常時系はプレーン Markdown、条件付きは `*.instructions.md`（YAML frontmatter）、プロンプトテンプレートは `*.prompt.md`、Chat mode は専用 JSON / Markdown。SKILL.md にも 2026 年 4 月から対応。
- **配置場所**：
  - 常時：`.github/copilot-instructions.md`、ルートまたはネストの `AGENTS.md`、`CLAUDE.md`、`GEMINI.md` も認識。
  - 条件付き：`.github/instructions/*.instructions.md`、ユーザープロファイル `~/.copilot/instructions/`。
  - プロンプト：`.github/prompts/*.prompt.md`。
  - Coding agent（クラウド）は AGENTS.md と nested AGENTS.md に対応。
- **発火条件**：常時系は全チャットに自動適用、`*.instructions.md` は `applyTo:` の glob に一致するファイル編集時に発火、`*.prompt.md` は手動実行、`AGENTS.md` は VS Code 設定で有効化。優先順位は **User > Repo > Organization**。
- **配布・共有**：`.github/` を git でチェックイン。`github/awesome-copilot` 等のコミュニティリポからコピー流用。組織レベル instruction を GitHub 側で配信可能。
- **frontmatter フィールド**：`name`, `description`, `applyTo`（glob）、Claude 互換の `paths`（配列）も解釈。
- **互換性**：AGENTS.md / CLAUDE.md / GEMINI.md を読む。SKILL.md（Agent Skills 標準）にも対応し、クロスエージェント互換性は最も広い。

## 6. Windsurf (Codeium / 現 OpenAI 傘下)

- **ファイル形式**：プレーン Markdown（または `.windsurfrules` 単一ファイル）。Memories は自動生成の構造化ノート。
- **配置場所**：`.windsurf/rules/*.md` または `.windsurfrules`（プロジェクト、git 管理）、`~/.codeium/windsurf/memories/global_rules.md`（Global）、Memories は `~/.codeium/windsurf/memories/` にローカル保存。
- **発火条件**：Cascade の Context Engine が「Global rules → Project rules → Memories → 開いてるファイル → コードベース検索」の順で組み立て、毎ターン適用。
- **配布・共有**：git で `.windsurf/` を共有、dotfiles リポで `global_rules.md` を配布する慣行。専用マーケットプレイスは無し。
- **frontmatter フィールド**：基本は無し（活性化トリガーは Cascade 側のヒューリスティック）。
- **互換性**：独自仕様中心。AGENTS.md への対応は限定的（コミュニティで部分対応）。

## 7. Cline

- **ファイル形式**：Markdown ファイル群（YAML frontmatter で `paths` を任意指定）。
- **配置場所**：ワークスペースは `.clinerules/`（ディレクトリ）または `.clinerules` 単一ファイル、Global はシステムの Cline Rules ディレクトリ。
- **発火条件**：トグル ON のファイル内容を system prompt に直接 append。frontmatter の `paths`（glob 配列）でコンテキスト内のファイルに一致した場合のみ活性化。
- **配布・共有**：git でチェックイン。v3.13+ で VS Code サイドバーから rule ごとに ON/OFF できる UI を提供。Rules Bank パターンで複数の規約ファイルを切り替え。
- **frontmatter フィールド**：`paths`（glob 配列の条件付き活性化）。
- **互換性**：独自寄り。Workspace > Global の優先順位、トグル制御という UI 面の独自性が強い。

---

## 比較表

| エージェント | 主要ファイル | 形式 | スコープ制御 | frontmatter キー | 配布手段 | AGENTS.md 対応 |
|---|---|---|---|---|---|---|
| Claude Code | `SKILL.md`, `CLAUDE.md`, `.claude/agents/`, `.claude/commands/` | MD + YAML | description / paths / `disable-model-invocation` / `user-invocable` / `context:fork` | name, description, paths, allowed-tools, model, effort, hooks ほか | Plugins / Marketplaces | △（CLAUDE.md 中心、Skills は agentskills.io 標準） |
| Gemini CLI | `gemini-extension.json` + `GEMINI.md` | JSON + MD + TOML | 常時 / `excludeTools` / 名前空間化 | （JSON: name, version, mcpServers, contextFileName, excludeTools） | `gemini extensions install` | ○（共同提唱） |
| Codex CLI | `AGENTS.md` / `AGENTS.override.md` | プレーン MD | ネスト + 後勝ち + override | 無し | git のみ | ◎（提唱元） |
| Cursor | `.cursor/rules/*.mdc` | MD + YAML (MDC) | Always / Auto / Agent Req / Manual | description, globs, alwaysApply | git / Team Rules | ◎（共同提唱） |
| Copilot | `.github/copilot-instructions.md`, `*.instructions.md`, `*.prompt.md`, AGENTS.md, SKILL.md | MD + YAML | applyTo glob / 常時 / 手動 / chat mode | name, description, applyTo, paths | git / 組織配信 | ◎ |
| Windsurf | `.windsurf/rules/`, `global_rules.md`, Memories | プレーン MD | 常時、context engine 内自動組立 | 無し | git / dotfiles | △ |
| Cline | `.clinerules/` | MD + YAML | UI トグル + `paths` glob | paths | git | △ |

---

## 共通点と相違点の総評

### 共通点

- ほぼ全エージェントが **Markdown + YAML frontmatter** に収束。テキスト + メタデータでバージョン管理しやすい構造が事実上の標準。
- **プロジェクト（git 共有）/ ユーザー（個人）/ 組織** の 3 層スコープがほぼ全勢力で採用される。
- 発火制御の 4 大パターンが定着：(a) **常時** ／ (b) **glob で限定** ／ (c) **description でモデル判断** ／ (d) **明示呼び出し（`/cmd` / `@rule`）**。Cursor の 4 モードはこの整理を明文化した形。
- **AGENTS.md が 2025 年中に事実上の共通標準として成立**。OpenAI / Google / Cursor / Factory / Sourcegraph の共同発表、Linux Foundation 傘下の Agentic AI Foundation 管理、60k+ OSS プロジェクト採用。Copilot もこれを読む方向に追随。
- 「人格 / Skill / 専門ワークフロー」レベルでは、`SKILL.md`（Agent Skills 標準）が Claude Code / Copilot / Cursor / Codex などで再利用可能になりつつあり、**AGENTS.md（プロジェクト共通文脈）と SKILL.md（再利用可能スキル）が二大標準**として分業しつつある。

### 相違点

- **Codex CLI は frontmatter を持たず**、ネスト + 後勝ち + override 専用ファイルというファイルシステム規約のみで全てを表現する最小主義。
- **Cursor は MDC で 4 モードを明文化**、**Claude Code は最も豊富な frontmatter フィールド**（model / effort / context:fork / hooks など）を持ち、subagent と統合した実行制御まで提供。
- **Gemini CLI は JSON マニフェスト主義**で MCP / 命令 / コマンドをパッケージ化、CLI コマンドでインストール可能（OS パッケージマネージャ的アプローチ）。
- **配布インフラの厚み**は Claude Code（Plugins / Marketplaces）と Gemini CLI（`gemini extensions install`）がリード。Copilot は `awesome-copilot` 等のコミュニティ + GitHub 組織配信。Codex / Cursor / Windsurf / Cline は基本 git 配布。
- **Windsurf / Cline は frontmatter ベースの絞り込みが弱い**代わりに、Windsurf は Memories による暗黙学習、Cline は UI トグルでの動的 ON/OFF と独自路線。

### HeartCraft への含意

2026 年現在は **「プロジェクト共通文脈は AGENTS.md、再利用可能なスキル / 人格は SKILL.md（agentskills.io）」** の二本立てに収束しつつある。HeartCraft のような「人格プロンプト配信」レイヤーは、SKILL.md 形式（Markdown + YAML frontmatter）に乗ることで Claude Code / Cursor / Copilot / Codex CLI へクロスエージェント互換を取りやすいポジションにある。配布手段（npx 一発 → ファイル配置 + アクティブ参照書き換え）も、Plugins / Extensions のように「インストール手順を覚えなくていい」方向に各社が向かっている流れに沿っている。

---

## 参考リンク

- [Extend Claude with skills - Claude Code Docs](https://code.claude.com/docs/en/skills)
- [Create custom subagents - Claude Code Docs](https://code.claude.com/docs/en/sub-agents)
- [Agent Skills - Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Gemini CLI Extensions](https://google-gemini.github.io/gemini-cli/docs/extensions/)
- [Gemini CLI extensions let you customize your command line](https://blog.google/innovation-and-ai/technology/developers-tools/gemini-cli-extensions/)
- [Custom instructions with AGENTS.md – Codex | OpenAI Developers](https://developers.openai.com/codex/guides/agents-md)
- [codex/AGENTS.md at main · openai/codex](https://github.com/openai/codex/blob/main/AGENTS.md)
- [Rules | Cursor Docs](https://cursor.com/docs/rules)
- [Use custom instructions in VS Code](https://code.visualstudio.com/docs/copilot/customization/custom-instructions)
- [Copilot coding agent now supports AGENTS.md custom instructions - GitHub Changelog](https://github.blog/changelog/2025-08-28-copilot-coding-agent-now-supports-agents-md-custom-instructions/)
- [AGENTS.md – open standard](https://agents.md/)
- [AGENTS.md Emerges as Open Standard for AI Coding Agents - InfoQ](https://www.infoq.com/news/2025/08/agents-md/)
- [Cascade Memories - Windsurf Docs](https://docs.windsurf.com/windsurf/cascade/memories)
- [Cline Rules](https://docs.cline.bot/customization/cline-rules)
