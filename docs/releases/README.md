# リリースノート運用

COMPASSのリリースノートは、Conventional Commits形式のGit履歴からMarkdownを生成します。
利用者向けの変更を漏れなく集めつつ、概要やアップグレード手順は公開前に人が確認します。

## 生成方法

```bash
npm run release:notes -- --version 0.2.0
```

最新の`v*`タグから`HEAD`までを集計し、`docs/releases/v0.2.0.md`へ出力します。
タグが1件もない初回リリースでは、すべてのコミットが対象になります。

差分範囲や出力先を明示する場合は、次のように指定します。

```bash
npm run release:notes -- \
  --version 0.2.0 \
  --from v0.1.0 \
  --to HEAD \
  --date 2026-07-12 \
  --output docs/releases/v0.2.0.md
```

ファイルを作らず内容だけ確認する場合は`--stdout`、既存ファイルを上書きする場合は
`--force`を使用します。

```bash
npm run release:notes -- --version 0.2.0 --stdout
```

## 分類ルール

| コミットtype                           | リリースノートの節 |
| -------------------------------------- | ------------------ |
| `feat`                                 | 新機能             |
| `fix`, `revert`                        | 不具合修正         |
| `perf`                                 | パフォーマンス改善 |
| `refactor`, `build`                    | 品質・運用改善     |
| `docs`, `style`, `test`, `ci`, `chore` | 自動生成では非表示 |

`feat!:`または`BREAKING CHANGE:`を含むコミットは、「破壊的変更」にも掲載されます。
見出し、対象type、scopeの日本語表示は`release-notes.config.json`で変更できます。

## リリース手順

1. リリース対象のコミットがConventional Commits形式になっていることを確認します。
2. リリースノートを生成し、「概要」と「アップグレード時の注意」を編集します。
3. `npm run test:release-notes`で生成器を確認します。
4. リリースノートをコミットします。
5. `git tag -a v0.2.0 -m "COMPASS v0.2.0"`でリリースタグを作成します。
6. `git push origin main --follow-tags`でコミットとタグを公開します。

生成結果はあくまで下書きです。機能名の統一、利用者への影響、DB移行、設定変更、
再ログインの要否をリリース担当者が確認してから公開します。
