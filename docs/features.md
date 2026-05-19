# heartcraft 機能一覧（v0.1.0 時点）

**最終更新**：2026-05-20
**バージョン**：v0.1.0（pre-alpha）

実装済・実機検証済の機能スナップショット。詳細仕様は [spec.md](spec.md)、今後の計画は [roadmap.md](roadmap.md)。

---

## 1. サブコマンド

### `install <user>/<name>`

サーバから Heart を取得し、`.claude/skills/heartcraft/` に配置 → SKILL.md を書き換えて即アクティブ化する。

```sh
npx heartcraft install hatarson/zundamon
```

#### フロー

1. slug を `<user>/<name>` 形式でパース（各セグメントが `^[a-z0-9][a-z0-9_-]*$` にマッチ）
2. `GET ${HEARTCRAFT_API_URL}/api/hearts/<user>/<name>` で frontmatter 付き Markdown を取得
3. `.claude/skills/heartcraft/<user>/<name>.md` にレスポンス本体を書き込み
4. `.claude/skills/heartcraft/SKILL.md` をフル再生成（アクティブ Heart 参照を含む）
5. 成功メッセージを stdout に表示
6. `POST /api/installs` で telemetry を fire-and-forget 送信（§4）

#### エラーハンドリング

| 状況 | 出力 | 終了コード |
|---|---|---|
| slug 形式不正 | `Invalid slug "X". Expected format: <user>/<name>` | 1 |
| slug 文字種違反 | `Invalid user name "X". Allowed: ...` | 1 |
| ネットワーク失敗 | `Cannot reach HeartCraftLab API at <url> (...)` | 1 |
| 404 | `Heart not found: <slug>` | 1 |
| その他 4xx/5xx | `API error (status): <body>` | 1 |
| 成功 | `✓ <slug> をインストールしました（<description>）` + 配置パス | 0 |

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
| `HEARTCRAFT_API_URL` | `http://localhost` | サーバ URL の上書き（本番リリース時に `https://heartcraftlab.com` 想定） |

末尾のスラッシュは自動で除去される（`http://localhost/` でも OK）。

---

## 4. Install Telemetry（fire-and-forget）

install 成功時に `POST ${HEARTCRAFT_API_URL}/api/installs` を **best-effort** で送信し、サーバ側でユニーク install 数（KPI）を集計する。

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
- install 自体の成否・出力には影響しない
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

アクティブ Heart が無い場合：本文を `現在アクティブな Heart はありません。` に差し替え（コードパスとしては存在、現状の install では到達しない）。

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
| `switch` / `list` / `uninstall` / `search` | 未実装（[roadmap.md](roadmap.md)） |
| atomic write（破壊事故防止） | 未実装 |
| dry-run モード | 未実装 |
| バックアップ作成 | 未実装 |
| API バージョンミスマッチ警告 | 未実装 |
| 認証付き private Heart 取得 | MVP 範囲外 |
| `--no-telemetry` フラグ | 未実装（必要になったら追加） |
