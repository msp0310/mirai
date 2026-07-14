# フロントエンド構造化方針

## 目的

COMPASSのフロントエンドは、画面数と業務機能の増加に耐えられるように、変更理由ごとに責務を分離します。
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
- APIから取得した認証・案件・日報などのサーバー状態はTanStack Queryで管理する
- Queryから取得した案件スナップショットを初期値として、未保存のガント編集はワークスペースdraftで管理する
- feature固有の一時状態はfeature Hookまたはfeature Atomで管理する
- 派生値は保存せず、入力状態から`useMemo`または純粋関数で導出する
- API保存、履歴追加、通知を伴う更新はController Hookを唯一の入口にする

### TanStack Query境界

- `app/query/queryClient.ts`で鮮度、再試行、再取得の既定値を管理する
- featureの`api/*Queries.ts`でQuery KeyとQuery Optionsを定義する
- 案件詳細のQuery Keyは案件IDを必ず含め、全案件詳細を一つのキャッシュへ詰め込まない
- Mutation成功時は応答を案件キャッシュへ反映し、案件サマリーなど関連Queryだけを無効化する
- Queryのバックグラウンド再取得で未保存draftを上書きしない
- ログアウト、パスワード変更、セッション失効時は利用者固有のQueryキャッシュを破棄する
- Router contextへQueryClientを渡し、route loaderから`ensureQueryData`を利用できる構成を保つ

### Form・入力検証境界

- 送信を伴う構造化フォームはTanStack Formで値、dirty、touched、送信状態を管理する
- Zodスキーマは各featureの`model/*FormSchemas.ts`へ置き、UIコンポーネントから検証規則を分離する
- TanStack FormのStandard Schema検証に加え、送信直前にも`schema.parse`を通してtrim・型保証を確定する
- API側の検証を正本とし、Zodは入力ミスを早く伝えるクライアント境界として扱う
- ガントのドラッグ、インライン編集、Undo/Redoはフォーム化せず、既存の操作Hookとdraftモデルを維持する
- エラー表示は共通`FormFieldError`を使い、該当入力へ`aria-invalid`を付ける

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

## 案件一覧の責務境界

- `ProjectPortfolioPanel`: チーム選択、案件一覧、横断状況の構成だけを行う
- `useProjectPortfolio`: 検索条件と案件・マイルストーン・残作業の共有View Modelを構築する
- `PortfolioHeader`: 選択チーム、チーム切替、案件追加導線を表示する
- `PortfolioSummary`: 進行中案件を基準にチーム状況を要約する
- `PortfolioControls`: 検索、状態絞り込み、並び替えを管理する
- `PortfolioSidePanels`: 要対応、直近マイルストーン、担当者別残作業を表示する

## 案件設定の責務境界

- `ProjectSettingsPage`: 案件基本情報、要員権限、整理操作の構成だけを行う
- `useProjectSettingsEditor`: 案件draft、所属チーム変更、要員権限、保存時正規化を管理する
- `ProjectBasicSettings`: 識別情報、期間、次のマイルストーンを編集する
- `ProjectMemberSettings`: 所属チーム内の要員と案件権限を編集する
- `ProjectArchiveSettings`: アーカイブの影響説明と二段階確認を提供する

## カレンダーの責務境界

- `CalendarPanel`: 月グリッドと編集サイドバーの構成だけを行う
- `useCalendarPanel`: 表示月・選択日と稼働曜日・休日編集を管理する
- `CalendarMonthGrid`: 42日グリッドと開始・終了・マイルストーンを描画する
- `CalendarSidebar`: 選択日、稼働曜日、休日マスターを編集する
- `calendarView`: 日別イベント、表示優先度、フォーカス対象を純粋関数で提供する

## 案件概要の責務境界

- `SummaryStrip`: 主要指標と各ダッシュボードパネルの構成だけを行う
- `projectSummary`: 工程、リスク、負荷、工数、基準計画を純粋関数で集計する
- `StatusSummaryCards`: 案件全体の主要指標を表示する
- `TaskProgressPanels`: 工程別進捗と要確認タスクを表示する
- `HealthPanel`: 健全性スコアと修正導線を段階表示する
- `MilestoneLoadPanels`: 直近マイルストーンとチーム負荷を表示する

## 変更履歴の責務境界

- `ActivityPanel`: 保存前差分と保存済み履歴の構成だけを行う
- `ActivityTimeline`: 保存済み履歴の検索・カテゴリ絞り込みを管理する
- `ChangeReviewPanel`: API保存前のタスク・設定差分とフォーカス導線を表示する

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
- `DailyReportSidebar`: タスク実績への反映見込みとコメントを表示する
- `DailyReportMarkdownField`: Markdown編集とプレビューを提供する
- `dailyReports`: メンバー解決、権限判定、下書き生成、工数集計を純粋関数として提供する

repository呼び出しはController Hookだけが行い、編集コンポーネントはdraftと名前付き操作だけを受け取ります。
純粋モデルはrepository型に依存せず、必要最小限の構造型でテストできる状態を保ちます。

## 作業ログの責務境界

- `WorkLogPanel`: 一覧、詳細、編集画面の表示切り替えだけを行う
- `useWorkLogController`: 検索条件、選択ログ、編集draft、作成・更新・削除を管理する
- `WorkLogListView`: 集計、検索、フィルター、作業ログ表を表示する
- `WorkLogDetailPage`: Markdown本文、関連タスク・課題、添付を表示する
- `WorkLogEditorPage`: 基本情報、Markdown本文、関連先を編集する
- `workLogs`: 検索、集計、draft生成・正規化、表示形式を純粋関数として提供する

作業ログfeatureは親から受け取る更新操作だけを呼び出し、添付I/Oは共通`AttachmentPanel`へ委譲します。

## 週次進捗の責務境界

- `WeeklyProgressSummary`: 週次指標、週一覧、担当別タスク、期限課題の構成だけを行う
- `useWeeklyProgressSummary`: 選択週、3週間単位の表示範囲、共有View Modelを管理する
- `WeeklyProgressOverview`: 案件全体と今週時点の計画差を表示する
- `WeeklyProgressWeekTable`: 週移動と週別集計の選択操作を提供する
- `WeeklyProgressTaskDetail`: 選択週の作業を担当者単位で表示する
- `WeeklyProgressIssueList`: 選択週までに解消予定の課題と持ち越しを表示する
- `weeklyProgress`: 週集計、計画差、担当別グループ、課題優先順を純粋関数で提供する

1万件のタスク集計はDOMを使わない性能テストを維持し、表示件数の上限はモデル層で明示します。

## アプリケーションシェルの責務境界

- `AppWorkbench`: Jotai Storeを生成し、ControllerとViewを接続するComposition Root
- `useAppWorkbenchController`: feature Controllerを統合し、画面へ渡すView Modelと名前付き操作を公開する
- `AppWorkbenchView`: Sidebar、Topbar、MainViews、Overlaysの配置だけを担当する
- `WorkbenchNavigation`: 権限と現在地に応じたSidebar、Topbarの表示モデルを構築する
- `WorkbenchMainViews`: 管理画面、横断画面、案件内画面を同じSuspense境界へ配置する
- `WorkbenchConfigurationViews`: 管理設定、案件設定、ヘルプを描画する
- `WorkbenchOrganizationViews`: 案件一覧、要員計画、日報、個人分析を描画する
- `WorkbenchProjectViews`: Ganttと案件内の概要、分析、課題、作業ログなどを描画する
- `WorkbenchOverlays`: Inspector、取込、作成、確認ダイアログ、Toast、操作ツアーを描画する
- `useWorkbenchDraftModel`: 保存範囲、差分、未保存状態、同期表示を導出する
- `useWorkbenchGanttModel`: タイムライン、表示行、担当メンバー、Resource週列をメモ化して導出する
- `useWorkbenchGanttControls`: 案件別の折りたたみ状態と状態フィルターの更新規則を管理する
- `useWorkbenchProjectNavigation`: 案件の遅延読込、切替、作成、アーカイブ、お気に入りを管理する
- `useWorkbenchScreenNavigation`: タブ、設定、ヘルプ、操作ツアーの遷移を管理する
- `useDailyReportReminders`: 画面文脈に応じて日報リマインドを遅延取得する
- `useProjectAttachments`: 案件添付のメタデータ更新をスケジュール編集から分離する
- `useProjectImportActions`: ファイル読込と確認用データ生成を管理する
- `useProjectImportCommitActions`: 確認済みデータの案件・ワークスペース反映を管理する

案件I/Oを伴う操作と一時的な画面遷移を別Controllerに分け、表示モデルは副作用を持たないHookで導出します。

`AppWorkbenchController`は複数featureを接続するFacadeとしてのみ利用します。子画面はFacadeを更新せず、必要な値と操作を読み取ってfeatureコンポーネントへ渡します。業務規則やAPI呼び出しをViewコンポーネントへ戻さないことをレビュー基準にします。

## タスク表とツールバーの責務境界

- `TaskTableRow`: 行選択、Inspector表示、キーボード操作の境界を管理する
- `TaskTitleCell`: 階層操作、タスク名編集、コメント件数、依存警告を表示する
- `TaskMetadataCells`: 日付、担当、状態、進捗の表示・編集を管理する
- `GanttToolbar`: 子操作群へpropsを振り分ける
- `GanttSelectionActions`: タスク追加、日付移動、一括更新、選択解除、削除を表示する
- `GanttDisplayControls`: 表示モード、時間粒度、期間移動、表示幅、休日考慮を表示する
- `GanttFilterControls`: 列設定、担当者絞り込み、詳細フィルター、ショートカット導線を表示する

仮想化された行では、行全体に一時編集状態を集約しません。タスク名と進捗のdraftは、その入力を所有するセルコンポーネントへ閉じ込めます。

## 現在の技術的債務

| 優先度 | 債務                                            | 影響                               | 対応方針                                               |
| ------ | ----------------------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| P1     | `useAppWorkbenchController`が大きなFacadeである | feature追加時に戻り値が増えやすい  | 新規処理はfeature Hookへ置き、Facadeには接続だけを残す |
| P1     | `scheduleImportExport.ts`が複数形式を扱う       | CSV、JSON、Brabio変更が干渉する    | format別adapterと共通validationへ分割                  |
| P1     | `taskOperations.ts`に編集操作が集中する         | 単体テストと権限境界が不鮮明       | hierarchy、date、clipboard、dependencyへ分割           |
| P1     | API DTOと画面モデルの変換がrepositoryへ集中する | API変更がUIへ波及する              | mapperをAPI feature境界へ分離                          |
| P2     | 一部CSSがglobal CSSとVanilla Extractに分散する  | 上書き関係を追いにくい             | 新規画面からVanilla Extractへ統一                      |
| P2     | 一部feature Hookの引数と戻り値が多い            | 呼び出し側と操作境界が密結合になる | 入力、状態、操作のView Model型をfeature単位で定義する  |

## 分割の完了条件

- featureから`app`へのimportが0件
- `AppWorkbench`はルーティング、レイアウト、feature間調停を中心にする
- 状態変更は名前付きController Hookまたは純粋関数を経由する
- 取込や計算ロジックはDOMなしでテストできる
- Unit、Integration、E2E、Performanceを個別に実行できる
- 分割前後で型検査、Lint、ビルド、全テスト、ブラウザ確認が成功する
