# heartcraft CLI 仕様

**バージョン**：v0.1.0（pre-alpha）
**対応サーバ API**：v1
**source of truth**：本ドキュメント（CLI 側の挙動）

---

## 1. 設計目標

> 「ネット検索 + コピペ + メモ帳保存」という DIY ワークフローに対し、`npx heartcraft use <slug>` の1コマンドで勝負する。

- インストールしたら**即適用**（再起動・追加設定なし）
- インストール先のディレクトリ構造は**ユーザーが見て理解できる**（透明性）
- インストールしたファイルは `curl` / ブラウザでも読める（CLI が無くても DIY 経路で復元できる）

---

## 2. サブコマンド

**設計方針**：基本は `use` だけ知っていれば使える。インストール / 切り替えの状態差はユーザーが意識しなくていい（未取得ならサーバから DL、取得済みなら SKILL.md 書き換えのみ）。

MVP では `use` 系を実装。`list` / `search` は MVP 対象外（Phase 2 以降）。

| コマンド | 動作 | 状態 |
|---|---|---|
| `use <user>/<name>` | アクティブハートを `<user>/<name>` にする。検知された AI エージェント（Claude Code / Cursor / Copilot / Gemini CLI / Codex）ごとに Heart 本体 + activation ファイルを配置。検知無しなら Claude Code にフォールバック。ローカルに無ければサーバから DL、有れば activation 書き換えのみ。即アクティブ化 | 実装済 |
| `clear` | 検知された各 agent の activation ファイル（SKILL.md 等）を削除（ハートプロンプト適用停止）。取得済み Heart 本体は残す | 実装済 |
| `list` | インストール済 Heart 一覧 + 現在アクティブを表示 | MVP 対象外 |
| `search <keyword>` | サーバ検索 API を叩いて結果表示 | MVP 対象外 |

### use のフロー

1. **slug パース**：`<user>/<name>` 形式、両セグメントが `^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$`（先頭・末尾は英数字）にマッチすることを確認
2. **エージェント検知**：`cwd` 直下の marker file/dir をスキャンして利用中の AI エージェント群を判定（§3）。1 つも検知されなければ Claude Code をフォールバックとして使う
3. **ローカル存在チェック**：検知された agent のいずれかの heartPath に `<user>/<name>.md` が既に存在する場合、その内容を読んで再利用し、手順 4 をスキップ
4. **API 呼び出し**：`GET ${HEARTCRAFT_API_URL}/api/hearts/${user}/${name}`
   - 404 → `Heart not found: <slug>`
   - その他 4xx/5xx → エラーメッセージ
   - ネットワーク失敗 → `Cannot reach HeartCraftLab API at ${apiUrl}` + ヒント
5. **各 agent に配置**：検知された agent ごとに
   - Heart 本体 Markdown を agent の heartPath に書き出す（frontmatter 込み）
   - activation ファイル群（agent ごとに 1〜2 個）を書き出す
6. **成功表示**：DL が走った場合は `✓ <slug> を <Agent1> / <Agent2> にインストールしました（<description>）`、切り替えのみなら `✓ <slug> を <...> に切り替えました` + 各 agent の配置パス
7. **telemetry 送信（best-effort）**：DL が走った場合のみ `POST ${HEARTCRAFT_API_URL}/api/installs` を fire-and-forget で叩く。失敗・タイムアウト（2秒）しても use 自体は成功扱いで、出力にも現れない。詳細は §10。

### clear のフロー

1. **エージェント検知**：use と同じく cwd から検知。検知されなければ Claude Code をフォールバック
2. **各 agent の activation ファイルを削除**：SKILL.md / `.mdc` / `.instructions.md` / Gemini extension ファイルを削除する。既に存在しなくてもエラーにしない（冪等）
3. **成功表示**：実際に削除されたファイルがあれば `✓ <Agent1> / <Agent2> のアクティブなハートプロンプトを解除しました` + 各 agent の削除パス。削除対象が 1 件も無ければその旨を表示
4. Heart 本体ファイルは削除しない（取得済みキャッシュとして残し、再度 `use` で復帰できるようにする）

---

## 3. ファイル配置（エージェント別）

実行時の `cwd` を起点に、検知された AI エージェントごとに別パスへ配置する。**検知ルール**は marker file / dir のいずれかが存在すれば該当 agent と判定。

| Agent | 検知 marker | Heart 本体 | activation ファイル |
|---|---|---|---|
| **Claude Code** | `CLAUDE.md` or `.claude/` | `.claude/skills/heartcraft/<user>/<name>.md` | `.claude/skills/heartcraft/SKILL.md` |
| **Cursor** | `.cursor/` or `.cursorrules` | `.cursor/rules/heartcraft/<user>/<name>.md` | `.cursor/rules/heartcraft.mdc` |
| **GitHub Copilot** | `.github/copilot-instructions.md` or `.github/instructions/` | `.github/instructions/heartcraft/<user>/<name>.md` | `.github/instructions/heartcraft.instructions.md` |
| **Gemini CLI** | `GEMINI.md` or `.gemini/` | `.gemini/extensions/heartcraft/hearts/<user>/<name>.md` | `.gemini/extensions/heartcraft/gemini-extension.json` + `.gemini/extensions/heartcraft/GEMINI.md` |
| **Codex** | `.codex/` | `.codex/skills/heartcraft/<user>/<name>.md` | `.codex/skills/heartcraft/SKILL.md` |

**フォールバック**：どの marker も無ければ Claude Code として配置する（最大ユーザー数を想定した既定動作）。

**設計判断**：
- 各 agent の Heart 本体は同一内容のコピー。`use` 時の DL は 1 回のみで全 agent に同じ body を書く。
- すべての agent の activation ファイルは Heart 本体をインラインで埋め込む（参照を確実にロードさせる手段が agent 横断で揃っていないため。Claude Code / Codex の SKILL.md も埋め込み式）。
- ユーザーが手動で書いた既存ファイル（例：`AGENTS.md`、`CLAUDE.md` 本体、`.github/copilot-instructions.md` 本体）は一切編集しない。新規ファイルのみ作成・上書きする。

ディレクトリは `mkdir -p` 相当で自動作成。

---

## 4. activation ファイルの形式

毎回フル再生成（regex 差し替えではなく上書き）。アクティブ Heart 1 件のみ埋め込み。

### 4.1 Claude Code / Codex: `SKILL.md`

frontmatter（`name` / `description`）はそのまま維持し、その下に Heart 本体をインライン埋め込みする。

```markdown
---
name: heartcraft
description: <常時起動を指示する description（変更なし）>
---

# HeartCraftLab Heart Loader (<user>/<name>)

Apply the following persona instructions to the entire conversation at all times.

<heart body（frontmatter を除いた本文）>
```

### 4.2 Cursor: `.cursor/rules/heartcraft.mdc`

```markdown
---
description: HeartCraftLab で配信される人格（Heart）を常時適用するエントリポイント。...
alwaysApply: true
---

# HeartCraftLab Heart Loader (<user>/<name>)

以下の人格指示を会話全体に常時適用すること。

<heart body（frontmatter を除いた本文）>
```

### 4.3 GitHub Copilot: `.github/instructions/heartcraft.instructions.md`

```markdown
---
description: ...
applyTo: '**'
---

# HeartCraftLab Heart Loader (<user>/<name>)

以下の人格指示を会話全体に常時適用すること。

<heart body（frontmatter を除いた本文）>
```

### 4.4 Gemini CLI: `.gemini/extensions/heartcraft/`

`gemini-extension.json`：

```json
{
  "name": "heartcraft",
  "version": "0.1.0",
  "contextFileName": "GEMINI.md"
}
```

`GEMINI.md`：

```markdown
# HeartCraftLab Heart Loader (<user>/<name>)

以下の人格指示を会話全体に常時適用すること。

<heart body（frontmatter を除いた本文）>
```

### 4.5 `clear` 実行後

すべての agent で activation ファイルを**削除**する（既に無ければ何もしない＝冪等）。Heart 本体ファイル（取得済みキャッシュ）は削除せず残す。

---

## 5. API 契約（クライアント目線の要約）

- **URL**：`GET /api/hearts/{user}/{name}`
- **レスポンス**：
  - 200：`text/markdown; charset=utf-8`、本体は frontmatter 付き Markdown
  - 404：Heart 不在 or 非公開
  - 400：本文プロンプト未登録
- **ヘッダ**：`X-Heartcraft-Api-Version: 1`（互換性チェック用、未来の `B5` で活用予定）

### frontmatter 形式

```yaml
---
name: <キャラクター表示名（その言語版） 例: ずんだもん>
slug: <識別子 例: zundamon>
creator: <user-name>
description: <短い説明>
version: 1
---
```

- `name` は `heart_prompts.name`（言語別のキャラクター表示名）。
- `slug` は識別子（`hearts.slug`）。CLI が `<user>/<slug>` を組み立てる際に使うが、CLI 引数として既に渡されているため重複情報として保持される。
- CLI は `description` と `name` を抽出して成功表示に使う：
  - `name` が空でない場合：`✓ ずんだもん (tanaka/zundamon) を ... にインストールしました（<description>）`
  - `name` が空の場合（フォールバック）：`✓ tanaka/zundamon を ... にインストールしました（<description>）`

---

## 6. 環境変数

| 変数 | デフォルト | 用途 |
|---|---|---|
| `HEARTCRAFT_API_URL` | `https://heartcraftlab.com` | サーバ URL の上書き（ローカル開発時は `http://localhost` を指定） |

---

## 7. エラーハンドリング方針

CLI が `process.exit(1)` する場合は必ず `✗ <理由>` を stderr に出す。
ユーザーが次に何をすればよいか分かるメッセージにする：

| シチュエーション | メッセージ例 |
|---|---|
| slug 形式不正 | `Invalid slug "X". Expected format: <user>/<name>` |
| slug 文字種違反 | `Invalid user name "X". Allowed: ^[a-z0-9]...` |
| ネットワーク失敗 | `Cannot reach HeartCraftLab API at <url> (...). Set HEARTCRAFT_API_URL to override.` |
| 404 | `Heart not found: <slug>` |
| その他 API | `API error (status): <body>` |

---

## 8. テスト戦略

- **slug.ts / skill.ts** — pure 関数、直接ユニットテスト
- **use.ts / clear.ts** — `vi.spyOn(globalThis, 'fetch')` で API モック、`mkdtemp` で一時ディレクトリに対して I/O 検証。`use` は「DL あり」「DL スキップ（取得済み）」の両分岐をテスト
- **cli.ts** — `execFileSync('npx', ['tsx', cliPath, '--version'])` 等のスモークのみ。ネットワークに依存させない

---

## 9. 既知の制限・将来追加

| 項目 | 状態 |
|---|---|
| atomic write（破壊事故防止） | 未実装、Phase E2 系で追加 |
| dry-run モード | 未実装 |
| バックアップ作成 | 未実装 |
| telemetry 送信 | ✅ 実装済（§10） |
| API バージョンミスマッチ警告 | 未実装 |
| 認証付き private Heart 取得 | MVP では不要（public のみ） |

---

## 10. Install Telemetry

`use` で**新規 DL が走った時**だけ `POST /api/installs` を fire-and-forget で叩き、サーバ側でユニーク install 数を集計する（KPI）。
切り替えのみ（ローカル存在のため DL スキップ）の場合は送信しない。`clear` も送信しない。

### 送信タイミング

`use` フローの **最後**（heart ファイル書き込み + SKILL.md 生成完了後、かつ DL が実際に走った場合のみ）。
ユーザーへの成功表示には影響しない（telemetry の成否は出力しない）。

### Payload

| 項目 | 値 |
|---|---|
| URL | `${HEARTCRAFT_API_URL}/api/installs` |
| Method | `POST` |
| Content-Type | `application/json` |

```json
{
  "heart_id": "<user>/<name>",
  "machine_hash": "<sha256 hex 64>",
  "cli_version": "<package.json version>",
  "os": "darwin | linux | win32"
}
```

`machine_hash` は `sha256(machineId + "<user>/<name>")`。`heart_id` を mix することで、横断的なマシン追跡を不可能にしつつ「同一マシン × 同一 Heart」のみ uniq 判定できるようにする。

### machineId 取得

[`node-machine-id`](https://www.npmjs.com/package/node-machine-id) を使用：
- macOS：`ioreg`
- Linux：`/etc/machine-id` or `/var/lib/dbus/machine-id`
- Windows：レジストリ `MachineGuid`

取得失敗時は telemetry をスキップ（ランダム値で代用しない → KPI が歪む）。

### 失敗時の方針：fire-and-forget

| 状況 | 挙動 |
|---|---|
| ネットワーク失敗 | silent skip。install は成功で終了 |
| 4xx / 5xx | silent skip |
| タイムアウト | `AbortController` で **2 秒 hard timeout** |
| 不正な OS（freebsd 等）| silent skip（サーバ enum は `darwin / linux / win32` のみ） |
| 不正な slug / cliVersion | silent skip（サーバを 422 で困らせない） |

CLI が固まる・use が失敗する余地を絶対に作らない。

### プライバシー

- machineId 原文はサーバに送らない（sha256 ハッシュ後のみ送信）
- Heart ごとに hash が異なる → 横断的マシン追跡を不可能にする
- 取得失敗時はスキップ → ユーザー環境を強制しない

### opt-out

MVP では `--no-telemetry` フラグは入れない。将来必要になったら追加する。
