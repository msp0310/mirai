# 外部データ連携REST API

## 目的

COMPASSの外部REST APIは、社内プロジェクト管理、集計基盤、バッチ、将来のMCPサーバーから案件・タスク・実績を安全に連携するための境界です。

画面用のCookie APIとは分離し、URLに`v1`を含めます。MCP固有のTool定義はこのAPIへ混ぜず、将来はREST APIまたは同じApplication Serviceを薄く呼び出します。

```text
社内システム / バッチ ─┐
                       ├─ /api/external/v1 ─ Application Service ─ SQLite
将来のMCPサーバー ─────┘
```

## 認証

すべての外部APIリクエストに次のヘッダーを指定します。

```http
X-Compass-Api-Key: <APIキー>
```

APIキーの平文はサーバーへ保存しません。十分に長いランダム値を発行し、SHA-256ハッシュを環境変数またはシークレットストアから設定します。

```bash
# 本番用キーの生成例
openssl rand -base64 48

# 設定するハッシュの生成
printf '%s' "$COMPASS_EXTERNAL_API_KEY" | shasum -a 256
```

本番環境の設定例です。`ProjectIds`を空にすると全案件へアクセスできるため、連携単位で制限することを推奨します。

```text
ExternalApi__Enabled=true
ExternalApi__PermitLimitPerMinute=120
ExternalApi__Clients__0__Id=internal-pjmgt
ExternalApi__Clients__0__Name=社内プロジェクト管理
ExternalApi__Clients__0__KeyHash=<64文字のSHA-256ハッシュ>
ExternalApi__Clients__0__Enabled=true
ExternalApi__Clients__0__Scopes__0=projects:read
ExternalApi__Clients__0__Scopes__1=tasks:read
ExternalApi__Clients__0__Scopes__2=tasks:write
ExternalApi__Clients__0__Scopes__3=actuals:write
ExternalApi__Clients__0__ProjectIds__0=site-renewal
```

開発環境では`compass-local-external-api-key`を利用できます。このキーは`Development`環境だけで有効です。

本番ではHTTPSを必須とし、APIキーやハッシュをリポジトリへコミットしないでください。キーを更新するときは新旧クライアント設定を一時的に併存させ、接続先の切り替え後に旧設定を無効化します。

## スコープ

| スコープ        | 許可する操作                       |
| --------------- | ---------------------------------- |
| `projects:read` | 案件一覧・案件詳細の取得           |
| `tasks:read`    | 案件単位のタスク取得               |
| `tasks:write`   | タスク計画全体の保存               |
| `actuals:write` | 状態・進捗・実績開始・終了日の更新 |

`*`は全スコープを表します。通常運用では必要最小限の個別スコープを設定してください。

## エンドポイント

| メソッド | パス                                                      | 用途                       |
| -------- | --------------------------------------------------------- | -------------------------- |
| `GET`    | `/api/external/v1/`                                       | 接続クライアントと権限確認 |
| `GET`    | `/api/external/v1/projects`                               | 軽量案件一覧               |
| `GET`    | `/api/external/v1/projects/{projectId}`                   | 案件詳細・集計             |
| `GET`    | `/api/external/v1/projects/{projectId}/tasks`             | タスク計画                 |
| `PUT`    | `/api/external/v1/projects/{projectId}/tasks`             | タスク計画の置換           |
| `PATCH`  | `/api/external/v1/projects/{projectId}/tasks/{id}/actual` | タスク実績更新             |

案件一覧は`teamId`、`lifecycleStatus`、`query`、`offset`、`limit`で絞り込めます。`limit`は最大500件です。

## 競合制御

案件・タスク取得レスポンスには次の`ETag`が付きます。

```http
ETag: "project-12"
```

書き込み時は取得した値を`If-Match`へ指定します。

```bash
curl -X PATCH \
  -H "X-Compass-Api-Key: $COMPASS_EXTERNAL_API_KEY" \
  -H 'If-Match: "project-12"' \
  -H "Content-Type: application/json" \
  -d '{"status":"inProgress","progress":60,"actualStart":"2026-07-13","actualEnd":null}' \
  http://127.0.0.1:5080/api/external/v1/projects/site-renewal/tasks/frontend/actual
```

- バージョン未指定: `428 Precondition Required`
- 他の更新と競合: `409 Conflict`と`currentVersion`
- スコープまたは案件範囲外: `403 Forbidden`
- APIキー不正: `401 Unauthorized`

書き込みは既存のタスク検証、権限制御、変更履歴、監査ログを経由します。

## OpenAPI

開発環境では`/openapi/v1.json`に外部APIも含まれます。クライアント生成時も`/api/external/v1`配下だけを外部契約として扱ってください。

## MCPへの拡張

将来のMCPでは、RESTのリソースをそのまま大量返却せず、目的別Toolへ変換します。

- `list_projects`: 案件検索とページング
- `get_project_tasks`: 指定案件のタスク取得
- `update_task_actual`: 担当タスクの実績更新
- `replace_task_plan`: PM/PL向け計画同期

MCPサーバーには専用APIキーと限定スコープを発行し、利用者の意図確認が必要な書き込みToolは明示的に分離します。
