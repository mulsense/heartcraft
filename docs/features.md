# heartcraft 機能一覧

**最終更新**：2026-05-20（CLI コマンド体系を `install`/`switch` から `use`/`clear` にリネーム）
**バージョン**：v0.1.0（pre-alpha）

仕様スナップショット（リネーム後の設計）。詳細仕様は [spec.md](spec.md)、今後の計画は [roadmap.md](roadmap.md)。

> **実装状況**：旧 `install` 相当のロジック（取得 → 配置 → SKILL.md 生成 → telemetry）は実装済。`use` への改名 + 「DL スキップ分岐（取得済みなら切り替えのみ）」+ `clear` は未実装（[roadmap.md](roadmap.md)）。

---

## 1. サブコマンド

### `use <user>/<name>`

アクティブハートを `<user>/<name>` に切り替える。ローカルに無ければサーバから取得 → 配置、有れば SKILL.md 書き換えのみ。ユーザーから見ると「インストールも切り替えも同じコマンド」。

```sh
npx heartcraft use master/zundamon
```

#### フロー

1. slug を `<user>/<name>` 形式でパース（各セグメントが `^[a-z0-9][a-z0-9_-]*$` にマッチ）
2. `.claude/skills/heartcraft/<user>/<name>.md` の存在チェック。あれば手順 3-4 をスキップ
3. `GET ${HEARTCRAFT_API_URL}/api/hearts/<user>/<name>` で frontmatter 付き Markdown を取得
4. `.claude/skills/heartcraft/<user>/<name>.md` にレスポンス本体を書き込み
5. `.claude/skills/heartcraft/SKILL.md` をフル再生成（アクティブ Heart 参照を含む）
6. 成功メッセージを stdout に表示
7. **DL が走った場合のみ** `POST /api/installs` で telemetry を fire-and-forget 送信（§4）

#### エラーハンドリング

| 状況 | 出力 | 終了コード |
|---|---|---|
| slug 形式不正 | `Invalid slug "X". Expected format: <user>/<name>` | 1 |
| slug 文字種違反 | `Invalid user name "X". Allowed: ...` | 1 |
| ネットワーク失敗 | `Cannot reach HeartCraftLab API at <url> (...)` | 1 |
| 404 | `Heart not found: <slug>` | 1 |
| その他 4xx/5xx | `API error (status): <body>` | 1 |
| 成功（DL あり） | `✓ <slug> をインストールしました（<description>）` + 配置パス | 0 |
| 成功（切り替えのみ） | `✓ <slug> に切り替えました` + 配置パス | 0 |

### `clear`

SKILL.md のアクティブ参照をクリアして、Claude Code がハートプロンプトを適用しない状態に戻す。配置済みファイルは残すので、後で `use` するとサーバへのアクセスなしで復帰できる。

```sh
npx heartcraft clear
```

#### 出力

| 状況 | 出力 | 終了コード |
|---|---|---|
| 成功 | `✓ アクティブなハートプロンプトを解除しました` | 0 |
| SKILL.md が見つからない | `No active heart prompt to clear.` | 0 |

---

## 2. CLI 共通オプション

| オプション | 動作 |
|---|---|
| `--version` / `-V` | `package.json` の version を表示（`0.1.0`） |
| `--help` / `-h` | サブコマンド一覧と説明を表示 |

---

## 3. 環境変数

| 変数 | デフォルト | 用途 |
|---|---|---|
| `HEARTCRAFT_API_URL` | `https://heartcraftlab.com` | サーバ URL の上書き（ローカル開発時は `http://localhost` を指定） |

末尾のスラッシュは自動で除去される（`https://heartcraftlab.com/` でも OK）。

---

## 4. Install Telemetry（fire-and-forget）

`use` で**新規 DL が走った時のみ** `POST ${HEARTCRAFT_API_URL}/api/installs` を **best-effort** で送信し、サーバ側でユニーク install 数（KPI）を集計する。切り替えのみ・`clear` は送信しない。

### 送信内容

```json
{
  "heart_id": "<user>/<name>",
  "machine_hash": "<sha256(machineId + slug) の hex 64 文字>",
  "cli_version": "0.1.0",
  "os": "darwin | linux | win32"
}
```

### 失敗時の挙動

- ネットワーク失敗・4xx/5xx・タイムアウト（2秒 hard）はすべて **silent skip**
- `use` 自体の成否・出力には影響しない
- 不正な OS（freebsd 等）・不正な slug・machineId 取得失敗時もスキップ（KPI を歪めないため）

### プライバシー

- machineId 原文はサーバに送信しない（sha256 ハッシュ後のみ）
- Heart ごとに hash が異なる → 横断的マシン追跡を不可能にする
- `--no-telemetry` フラグは未実装（MVP では入れない方針）

詳細は [spec.md §10](spec.md#10-install-telemetry)。

---

## 5. ファイル配置

実行時の `cwd` を起点に：

```
.claude/skills/heartcraft/
├── SKILL.md            ← Claude Code エントリポイント。アクティブ Heart 参照を含む
└── <user>/
    └── <name>.md       ← Heart 本体（frontmatter 付き Markdown）
```

ディレクトリは自動作成（`mkdir -p` 相当）。

### SKILL.md の形式

毎回フル再生成（regex 差し替えではなく上書き）：

```markdown
---
name: heartcraft
description: HeartCraftLab で配信される人格（Heart）を ... 必ずこのスキルを読み込み、参照先 Heart の指示に従って応答すること。
---

# HeartCraftLab Heart Loader

このスキルが読み込まれたら、必ず同ディレクトリの **<user>/<name>.md** を読み込み、そこに書かれた人格指示を会話全体に適用する。
```

アクティブ Heart が無い場合（`clear` 実行後）：本文を `現在アクティブな Heart はありません。` に差し替え。

---

## 6. サーバ API 接続

| 用途 | エンドポイント | メソッド |
|---|---|---|
| Heart 取得 | `/api/hearts/{user}/{name}` | `GET` |
| Telemetry | `/api/installs` | `POST` |

`X-Heartcraft-Api-Version: 1` ヘッダのチェックは未実装（v0.2.0 以降）。

---

## 7. 未実装機能

| 機能 | 状態 |
|---|---|
| `use` の DL スキップ分岐（既存ファイル検知して切り替えのみ） | 未実装（[roadmap.md](roadmap.md)） |
| `clear` | 未実装（[roadmap.md](roadmap.md)） |
| `list` / `search` | MVP 対象外（Phase 2 以降） |
| atomic write（破壊事故防止） | 未実装 |
| dry-run モード | 未実装 |
| バックアップ作成 | 未実装 |
| API バージョンミスマッチ警告 | 未実装 |
| 認証付き private Heart 取得 | MVP 範囲外 |
| `--no-telemetry` フラグ | 未実装（必要になったら追加） |
