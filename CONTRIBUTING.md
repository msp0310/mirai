# コントリビューションガイド

Miraiへの変更は、レビューや変更履歴を追いやすくするため、
[Conventional Commits](https://www.conventionalcommits.org/ja/v1.0.0/) に従います。

## コミットメッセージ

基本形式は次のとおりです。

```text
<type>[optional scope]: <description>
```

例:

```text
feat(gantt): タスクの一括移動を追加
fix(auth): ログイン失敗時のエラー表示を修正
docs: READMEに起動手順を追加
```

### type

| type | 用途 |
| --- | --- |
| `feat` | ユーザー向け機能の追加 |
| `fix` | 不具合の修正 |
| `docs` | ドキュメントのみの変更 |
| `style` | 動作に影響しない書式・スタイル変更 |
| `refactor` | 振る舞いを変えない構造変更 |
| `perf` | パフォーマンス改善 |
| `test` | テストの追加・修正 |
| `build` | ビルドや依存関係の変更 |
| `ci` | CI/CD設定の変更 |
| `chore` | その他の保守作業 |
| `revert` | 以前のコミットの取り消し |

### ルール

- 1コミット1目的を基本とします。
- `type` は必須です。必要な場合だけ `(gantt)`、`(api)`、`(auth)` などのscopeを付けます。
- descriptionは短く具体的に書きます。日本語で記述して構いません。
- 破壊的変更は `feat!:` のように `!` を付けるか、本文またはフッターに `BREAKING CHANGE:` を記載します。
- コミット本文やフッターは、背景・影響範囲・移行手順が必要な変更で使用します。

## 変更時の確認

変更内容に応じて、少なくとも次の検証を実行します。

```bash
npm run check
npm run build
```

APIを変更した場合は、次も実行します。

```bash
$HOME/.dotnet/dotnet build backend/ScheduleManager.sln
```

詳細な起動方法と検証コマンドは [README.md](README.md) を参照してください。

## リリースノート

リリースノートはConventional Commits形式の履歴から生成します。

```bash
npm run release:notes -- --version 0.2.0
```

生成後は、利用者向けの概要とアップグレード時の注意を確認・追記してください。
分類ルール、差分範囲の指定、タグ作成までの手順は
[`docs/releases/README.md`](docs/releases/README.md)を参照してください。
