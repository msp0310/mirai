# フロントエンド構造化方針

## 目的

Miraiのフロントエンドは、画面数と業務機能の増加に耐えられるように、変更理由ごとに責務を分離します。
単にファイルを小さくするのではなく、依存方向と状態変更の所有者を明確にすることを優先します。

## 依存方向

依存は次の一方向に揃えます。

```text
app -> features -> components / hooks -> lib / data -> types
```

- `app`: ルーティング、認証後シェル、複数featureの調停
- `features`: Gantt、案件、日報、課題、分析、管理設定などの業務単位
- `components`: featureに依存しない共通UI
- `hooks`: featureに依存しない共通Reactライフサイクル
- `lib`: Reactを参照しない純粋なドメイン計算
- `data`: API、保存、取込形式などのI/O境界
- `types`: 複数層で共有するドメイン型

featureから`app`への逆依存は禁止します。複数featureで必要な処理は`lib`または`data`へ移します。
Oxlintの`no-restricted-imports`を層ごとに設定し、`npm run check`で依存方向も検証します。

## 状態の所有

- URLで復元すべき状態はTanStack Routerで管理する
- 表示設定はワークベンチ単位のJotai Storeで管理する
- APIから取得した案件データはワークスペース状態で管理する
- feature固有の一時状態はfeature Hookまたはfeature Atomで管理する
- 派生値は保存せず、入力状態から`useMemo`または純粋関数で導出する
- API保存、履歴追加、通知を伴う更新はController Hookを唯一の入口にする

## Ganttの責務境界

- `GanttWorkbench`: ツールバー、タイムライン、タスク表、補助パネルの調停だけを行う
- `GanttTimelinePane`: 時間軸と表示期間外タスクへの移動導線を構成する
- `TimelineGrid`: 仮想化された時間軸レイヤーを構成する
- `TimelineTaskRow`: 1行分のバー、マイルストーン、基準計画を描画する
- `TaskTableViewport`: 仮想化されたタスク行と選択・並べ替えガイドを描画する
- `useGanttViewport`: 左表とタイムラインのスクロール同期、今日・開始日への移動を管理する
- `useTaskDragSelection`: 空白領域からの範囲選択を管理する
- `useTaskRowReorder`: 行の上下移動、子階層化、親階層化を管理する
- `useTaskContextMenu`: 右クリックメニューの位置と終了条件を管理する
- `useTimelineBarInteraction`: バーの選択、移動、リサイズ、自動スクロールを管理する
- `taskTableModel`: 階層ソート、子孫探索、移動対象の判定を純粋関数として提供する
- `TaskInspector`: タブ切替とフォーカス移動だけを調停する
- `TaskBasicSection`: 日程、基準計画、進捗、担当者配分を管理する
- `TaskRelationsSection`: 完了条件、依存関係、参考リンクを管理する
- `TaskCollaborationSection`: コメントと添付を管理する

ポインターイベントのリスナーは各操作Hookが所有し、アンマウント時に必ず解除します。
表示コンポーネントはタスク更新規則を持たず、名前付きコールバック経由でControllerへ通知します。

## 要員計画の責務境界

- `WorkloadOverviewPage`: 表示モードと子領域の調停だけを行う
- `useWorkloadOverviewModel`: 全案件から人別・チーム別の表示モデルとサマリーを導出する
- `useStaffingEditors`: アサインと要員要求の編集ライフサイクルを管理する
- `StaffingPlanView`: 要員判断、未充足要求、月別不足、アサインボードを構成する
- `AssignmentPlanBoard`: メンバーごとの月別負荷と案件アサインを描画する
- `WorkloadCapacityGrid`: 人別・チーム別の週次負荷を描画する
- `ResourcePanel`: 案件内の週次負荷表と選択セルの調停だけを行う
- `ResourceDrilldown`: 選択した週の内訳、担当・配分・日程調整の導線を表示する
- `resourceAdjustments`: 負荷軽減効果と分担候補を純粋関数で算出する
- `workloadPlanning`: 期間、負荷集計、アサイン位置などを純粋関数として提供する

ページは集計規則や保存規則を持たず、Hookが返すView Modelと操作だけを子コンポーネントへ渡します。
要員計画の純粋計算はDOMを使わない単体テストで境界値を検証します。

## 課題管理の責務境界

- `ProjectIssuePanel`: 一覧、詳細、編集ダイアログの表示切り替えだけを行う
- `useProjectIssueController`: 検索条件、選択課題、編集draft、返信追加を管理する
- `IssueListView`: サマリー、検索、状態フィルター、課題表を表示する
- `IssueDetailPage`: 本文、関連タスク、添付、返信を構成する
- `IssueEditorDialog`: 課題属性とMarkdown本文の編集だけを行う
- `projectIssues`: 検索、集計、表示形式、draft正規化を純粋関数として提供する

添付I/Oは共通`AttachmentPanel`へ委譲し、課題featureはowner情報と更新通知だけを渡します。

## 管理設定の責務境界

- `MasterSettingsPage`: 設定カテゴリと編集中チームの選択だけを管理する
- `TeamSettingsSection`: チーム基本情報、所属メンバー、チーム権限を編集する
- `MemberSettingsSection`: メンバー作成とアカウント一覧を構成する
- `useMemberAccountAdministration`: アカウント取得、保存、パスワード再設定のAPI境界を管理する
- `MemberAccountTable`: 検索、集計、一覧行の構成だけを行う
- `useMemberAccountRow`: 一人分のアカウントdraftと非稼働日編集を管理する
- `CalendarSettingsSection`: 稼働曜日、会社休日、国民の祝日取込を管理する
- `AuditLogSection` / `useAuditLogs`: 監査タブ表示時の遅延取得と表示を管理する
- `masterSettings` / `memberAccounts`: 権限更新、検索、集計、表示形式を純粋関数で提供する

各設定セクションは表示中かどうかを受け取り、入力中のdraftをカテゴリ切替後も保持します。
APIアクセスは専用Hookに閉じ込め、表示コンポーネントからrepositoryを直接呼び出しません。

## 共通Topbarの責務境界

- `Topbar`: 開いているポップアップと各操作群の構成だけを調停する
- `useTopbarMenu`: 外側クリック、Esc、排他的なポップアップ表示を管理する
- `TopbarContextPicker`: チーム・案件の現在地、案件検索、キーボード移動を管理する
- `TopbarSyncControls`: 保存状態、API送信キュー、保存・再送操作を表示する
- `TopbarProjectActions`: 共有、取込、書出、案件設定を管理する
- `TopbarNotifications`: 通知件数と通知一覧を表示する
- `TopbarAccount`: ログイン中ユーザーとログアウト操作を表示する
- `topbarPresentation`: 画面文脈、案件検索、並び順、時刻表示を純粋関数として提供する

共通レイアウトは業務データを更新せず、親から渡された名前付き操作だけを呼び出します。
案件検索のキーボードリスナーは専用コンポーネントが所有し、アンマウント時に解除します。

## 日報の責務境界

- `DailyReportPage`: 自分・チーム表示と子領域の構成だけを調停する
- `useDailyReportsController`: 取得、選択、保存、提出、削除、コメント、リマインドを管理する
- `DailyReportList`: 自分の日報の選択一覧を表示する
- `DailyReportEditor`: 基本情報、本文、明細、コメント、削除確認を構成する
- `DailyReportEntries`: 案件・タスク別の作業時間明細を編集する
- `DailyReportSidebar`: 案件実績への反映見込みとコメントを表示する
- `DailyReportMarkdownField`: Markdown編集とプレビューを提供する
- `dailyReports`: メンバー解決、権限判定、下書き生成、工数集計を純粋関数として提供する

repository呼び出しはController Hookだけが行い、編集コンポーネントはdraftと名前付き操作だけを受け取ります。
純粋モデルはrepository型に依存せず、必要最小限の構造型でテストできる状態を保ちます。

## 現在の技術的債務

| 優先度 | 債務                                            | 影響                             | 対応方針                                                    |
| ------ | ----------------------------------------------- | -------------------------------- | ----------------------------------------------------------- |
| P0     | `AppWorkbench`に複数featureの状態変更が残る     | 変更影響が広く、レビューが難しい | 案件、取込、保存、ナビゲーション単位のController Hookへ分離 |
| P0     | `Topbar`や管理設定画面に複数操作が同居する      | 権限・表示条件の変更が波及する   | 操作群、通知、アカウント、設定Sectionの境界で分割           |
| P1     | `scheduleImportExport.ts`が複数形式を扱う       | CSV、JSON、Brabio変更が干渉する  | format別adapterと共通validationへ分割                       |
| P1     | `taskOperations.ts`に編集操作が集中する         | 単体テストと権限境界が不鮮明     | hierarchy、date、clipboard、dependencyへ分割                |
| P1     | API DTOと画面モデルの変換がrepositoryへ集中する | API変更がUIへ波及する            | mapperをAPI feature境界へ分離                               |
| P2     | 一部CSSがglobal CSSとVanilla Extractに分散する  | 上書き関係を追いにくい           | 新規画面からVanilla Extractへ統一                           |
| P2     | 巨大コンポーネントのpropsが多い                 | 呼び出し側と子画面が密結合になる | feature ControllerとView Modelで受け渡す                    |

## 分割の完了条件

- featureから`app`へのimportが0件
- `AppWorkbench`はルーティング、レイアウト、feature間調停を中心にする
- 状態変更は名前付きController Hookまたは純粋関数を経由する
- 取込や計算ロジックはDOMなしでテストできる
- Unit、Integration、E2E、Performanceを個別に実行できる
- 分割前後で型検査、Lint、ビルド、全テスト、ブラウザ確認が成功する
