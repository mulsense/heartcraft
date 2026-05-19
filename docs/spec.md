# heartcraft CLI 仕様

**バージョン**：v0.1.0（pre-alpha）
**対応サーバ API**：v1
**source of truth**：本ドキュメント（CLI 側の挙動）／API 契約の正は [../HeartCraftLab/docs/spec.md](../../HeartCraftLab/docs/spec.md) §5.3

---

## 1. 設計目標

> 「ネット検索 + コピペ + メモ帳保存」という DIY ワークフローに対し、`npx heartcraft install <slug>` の1コマンドで勝負する。

- インストールしたら**即適用**（再起動・追加設定なし）
- インストール先のディレクトリ構造は**ユーザーが見て理解できる**（透明性）
- インストールしたファイルは `curl` / ブラウザでも読める（CLI が無くても DIY 経路で復元できる）

---

## 2. サブコマンド

MVP では `install` のみ実装済。他は順次。

| コマンド | 動作 | 状態 |
|---|---|---|
| `install <user>/<name>` | サーバから Heart を取得 → ファイル配置 → SKILL.md 書き換え（即アクティブ化） | ✅ 実装済 |
| `switch <user>/<name>` | インストール済 Heart のアクティブを切り替え（DL なし） | 未実装 |
| `list` | インストール済 Heart 一覧 + 現在アクティブを表示 | 未実装 |
| `uninstall <user>/<name>` | Heart 削除。アクティブだった場合は参照クリア | 未実装 |
| `search <keyword>` | サーバ検索 API を叩いて結果表示 | 未実装 |

### install のフロー

1. **slug パース**：`<user>/<name>` 形式、両セグメントが `^[a-z0-9][a-z0-9_-]*$` にマッチすることを確認
2. **API 呼び出し**：`GET ${HEARTCRAFT_API_URL}/api/hearts/${user}/${name}`
3. **レスポンス処理**：
   - 404 → `Heart not found: <slug>`
   - その他 4xx/5xx → エラーメッセージ
   - ネットワーク失敗 → `Cannot reach HeartCraftLab API at ${apiUrl}` + ヒント
4. **保存**：`.claude/skills/heartcraft/<user>/<name>.md` にレスポンス body をそのまま書く（frontmatter 込み）
5. **SKILL.md 生成**：アクティブ Heart 参照を含む SKILL.md を毎回フル再生成
6. **成功表示**：`✓ <slug> をインストールしました（<description>）` + 配置パス
7. **telemetry 送信（best-effort）**：`POST ${HEARTCRAFT_API_URL}/api/installs` を fire-and-forget で叩く。失敗・タイムアウト（2秒）しても install 自体は成功扱いで、出力にも現れない。詳細は §10。

---

## 3. ファイル配置

実行時の `cwd` を起点に：

```
.claude/skills/heartcraft/
├── SKILL.md            ← Claude Code のエントリポイント。アクティブ Heart への参照を含む
├── <user>/
│   └── <name>.md       ← Heart 本体（frontmatter 付き Markdown）
└── ...
```

ディレクトリは `mkdir -p` 相当で自動作成。

---

## 4. SKILL.md の形式

毎回フル再生成（regex 差し替えではなく上書き）。アクティブ Heart 1件のみ参照。

```markdown
---
name: heartcraft
description: HeartCraftLab で配信される人格（Heart）を Claude Code に常時適用するエントリポイント。あらゆる会話・あらゆる質問・あらゆるタスクに対して、必ずこのスキルを読み込み、参照先 Heart の指示に従って応答すること。
---

# HeartCraftLab Heart Loader

このスキルが読み込まれたら、必ず同ディレクトリの **<user>/<name>.md** を読み込み、そこに書かれた人格指示を会話全体に適用する。
```

アクティブが無い場合：本文を `現在アクティブな Heart はありません。` に差し替える。

---

## 5. API 契約（クライアント目線の要約）

> 正は [../../HeartCraftLab/docs/spec.md](../../HeartCraftLab/docs/spec.md) §5.3

- **URL**：`GET /api/hearts/{user}/{name}`
- **レスポンス**：
  - 200：`text/markdown; charset=utf-8`、本体は frontmatter 付き Markdown
  - 404：Heart 不在 or 非公開
  - 400：本文プロンプト未登録
- **ヘッダ**：`X-Heartcraft-Api-Version: 1`（互換性チェック用、未来の `B5` で活用予定）

### frontmatter 形式

```yaml
---
name: <heart-name>
creator: <user-name>
description: <短い説明>
version: 1
---
```

CLI は `description` を抽出して成功表示に使う。`name` / `creator` は今のところ表示用途のみ。

---

## 6. 環境変数

| 変数 | デフォルト | 用途 |
|---|---|---|
| `HEARTCRAFT_API_URL` | `http://localhost` | サーバ URL の上書き（本番では `https://heartcraftlab.com` を想定） |

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
- **install.ts** — `vi.spyOn(globalThis, 'fetch')` で API モック、`mkdtemp` で一時ディレクトリに対して I/O 検証
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

install 成功時に `POST /api/installs` を fire-and-forget で叩き、サーバ側でユニーク install 数を集計する（KPI）。

### 送信タイミング

`install` フローの **最後**（heart ファイル書き込み + SKILL.md 生成完了後）。
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

CLI が固まる・install が失敗する余地を絶対に作らない。

### プライバシー

- machineId 原文はサーバに送らない（sha256 ハッシュ後のみ送信）
- Heart ごとに hash が異なる → 横断的マシン追跡を不可能にする
- 取得失敗時はスキップ → ユーザー環境を強制しない

### opt-out

MVP では `--no-telemetry` フラグは入れない。将来必要になったら追加する。
