# 運用ガイド

## ヘルスチェック

- `GET /api/health`: APIプロセスの稼働確認
- `GET /api/health/ready`: SQLiteへの接続を含む準備完了確認

予期しない例外はイベントID `500`、パス付きの構造化ログとして標準出力へ記録されます。コンテナ基盤では標準出力を収集し、HTTP 5xx率、`health/ready`失敗、ディスク使用率を監視してください。

## 本番初期管理者

空の本番DBを初めて起動するときは、次の環境変数を設定します。初回ログイン後にパスワード変更が必須になります。

```bash
Schedule__InitialAdminEmail=admin@example.com
Schedule__InitialAdminPassword='<12文字以上の初期パスワード>'
Schedule__InitialAdminName='システム管理者'
```

既にユーザーが存在するDBではこれらの値からアカウントを追加・更新しません。初期設定後はコンテナ設定からパスワードを削除してください。

## バックアップ

`scripts/backup.sh`はSQLiteのオンラインバックアップAPIでDBを複製し、添付ディレクトリと一緒にtar.gzへ保存します。

```bash
COMPASS_DATA_DIR=/data COMPASS_BACKUP_DIR=/backups ./scripts/backup.sh
```

添付アップロードとDB更新を完全に同一時点へ揃える必要がある場合は、メンテナンス表示中に実行してください。日次バックアップに加えて世代管理と別ストレージへの転送を設定し、四半期ごとに復元試験を行います。

## 復元

1. APIを停止します。
2. バックアップを空の一時ディレクトリへ展開します。
3. `compass.db`と`attachments/`をデータボリュームへ戻します。
4. 所有者を実行ユーザーへ揃え、APIを起動します。
5. `health/ready`と添付ダウンロードを確認します。
