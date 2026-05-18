# heartcraft CLI 仕様

**バージョン**：v0.0.1（pre-alpha）
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
| telemetry 送信 | サーバ側仕様あり、CLI 未実装 |
| API バージョンミスマッチ警告 | 未実装 |
| 認証付き private Heart 取得 | MVP では不要（public のみ） |
