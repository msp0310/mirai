# Mirai

SI企業のチーム開発・運用保守を支える、案件スケジュール管理アプリです。

`Team > Project > Task` の情報構造を軸に、案件ポートフォリオからプロジェクト単位のGanttへ自然につなぎます。タスクの階層、担当者、依存関係、稼働日カレンダーをまとめて扱い、計画と実績の差分をチームで追えることを目指しています。

## 主な機能

### 案件管理

- チーム配下の案件をカード形式で一覧表示
- 案件のステータス、期間、進捗、マイルストーンを確認
- プロジェクトごとのメンバー・担当者を管理
- チーム未所属の案件にも対応

### Gantt

- 日・週・月単位の表示切り替え
- タスクの階層化、展開・折りたたみ、並び替え
- ドラッグによる期間移動・リサイズ
- 稼働日を考慮した期間・工数計算
- 依存関係、マイルストーン、基準計画の表示
- インライン編集とキーボードショートカット
- 複数タスク選択、一括移動、一括担当者変更
- 大量タスクを想定した行仮想化

### プロジェクト運用

- 課題の登録、Markdown本文、返信履歴
- 作業時間・運用保守時間の記録
- リソース画面での担当者別・チーム横断の負荷確認
- 稼働日カレンダーと日本の祝日取得
- Brabio XLSXからのタスク移行
- スケジュール変更履歴とActivity表示

### 管理・認証

- メンバー一覧とログインアカウント管理
- パスワード再設定
- 管理者権限
- チーム、メンバー、カレンダーのマスター管理

## 技術スタック

| 領域 | 技術 |
| --- | --- |
| フロントエンド | React 19 / TypeScript 7 / Vite |
| API | ASP.NET Core 10 Minimal API |
| 永続化 | SQLite / Entity Framework Core 10 |
| E2E・性能検証 | Playwright |
| 静的検査 | TypeScript / Oxlint / .NET Analyzer |

## プロジェクト構成

```text
.
├── frontend/                 # React + TypeScriptの画面
│   ├── src/components/       # Gantt、案件、課題などの機能別コンポーネント
│   ├── src/app/              # 画面状態とアプリケーション導線
│   ├── src/data/             # API、ローカル表示状態、Brabio取込
│   └── src/lib/              # 日付・タスク階層などのドメイン処理
├── backend/
│   └── src/Schedule.Api/     # ASP.NET Core API、ドメイン、DB、Seed
├── tests/
│   ├── e2e/                  # 認証・案件導線・API契約・保存競合
│   └── performance/          # 大量案件・大量タスク・Resource集計
└── docs/                     # アーキテクチャ・DB設計
```

## 必要環境

- Node.js 20.19以上、または22.12以上
- npm
- .NET SDK 10.0.301（`global.json`で固定）

## セットアップ

リポジトリを取得し、依存関係をインストールします。

```bash
git clone https://github.com/msp0310/mirai.git
cd mirai

# ルートの開発ツール
corepack pnpm install

# フロントエンド
npm --prefix frontend ci
```

Playwrightを初めて使う環境では、Chromiumも導入します。

```bash
npx playwright install chromium
```

## 起動

ターミナルを2つ開き、APIとフロントエンドをそれぞれ起動します。

### API

```bash
dotnet run \
  --project backend/src/Schedule.Api/Schedule.Api.csproj \
  --urls http://127.0.0.1:5080
```

### フロントエンド

```bash
cd frontend
npm run dev -- --port 5174
```

ブラウザで [http://127.0.0.1:5174/](http://127.0.0.1:5174/) を開きます。

APIの疎通は次のコマンドで確認できます。

```bash
curl http://127.0.0.1:5080/api/health
```

### ローカル開発用アカウント

Development環境では、API起動時に次の管理者アカウントがSeedされます。

| 項目 | 値 |
| --- | --- |
| メールアドレス | `pm@example.com` |
| パスワード | `Password123!` |
| 権限 | 管理者 |

このアカウントはローカル開発専用です。ログイン画面には初期値を表示しません。

## 検証コマンド

```bash
# フロントエンドの型検査
npm run check

# フロントエンドの本番ビルド
npm run build

# 静的検査
npm run lint

# E2E（フロントエンドとAPIを必要に応じて自動起動）
npm run test:e2e

# 性能テスト
npm run test:performance

# テストコードの型検査
npm run test:types

# API
dotnet build backend/ScheduleManager.sln
```

## 設計方針

- 初期表示は軽量なワークスペースサマリーだけを取得し、タスク明細は選択した案件のGanttを開くときに遅延取得します。
- 保存単位はプロジェクトです。プロジェクトのバージョンを使った楽観的同時実行制御で、他の利用者による更新を検知します。
- タスク、担当者、依存関係はID単位で差分保存し、日付1件の変更で全タスクを再作成しません。
- Ganttの行は仮想化し、タスク数が増えても表示中の行だけをDOMへ配置します。
- `未所属` はチームの仮想レコードではなく、`team_id = NULL` の表示ラベルとして扱います。
- Brabio取込は汎用CSVマッピングではなく、Brabio XLSX専用の移行フローとして扱います。
- スケジュール変更履歴は、将来の見積もり改善・リスク分析につなげるための基盤として保持します。

詳細な取得境界、保存方式、性能上の不変条件は [`docs/architecture.md`](docs/architecture.md) を参照してください。

## 関連ドキュメント

- [`docs/architecture.md`](docs/architecture.md): API境界、保存、性能方針
- [`docs/databases/README.md`](docs/databases/README.md): データモデルとDB設計
- [`frontend/design-qa.md`](frontend/design-qa.md): フロントエンドの検証記録
- [`frontend/product-backlog.md`](frontend/product-backlog.md): 今後の改善候補
