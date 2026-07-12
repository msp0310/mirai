export type TourId = "basic" | "gantt" | "member" | "planner" | "admin";

export type TourStep = {
  body: string;
  selector: string;
  title: string;
};

export type TourScenario = {
  description: string;
  id: TourId;
  steps: TourStep[];
  title: string;
};

export const tourScenarios: Record<TourId, TourScenario> = {
  basic: {
    description: "チームと案件を選び、案件内の作業画面へ移動するまでを案内します。",
    id: "basic",
    steps: [
      {
        body: "所属チームや確認対象のチームを切り替えます。未所属案件もここから選択できます。",
        selector: '[aria-label="チーム"]',
        title: "チームを選ぶ",
      },
      {
        body: "プロジェクトNo.、案件名、マイルストーンから目的の案件を絞り込めます。初期表示は進行中案件です。",
        selector: '[data-tour="portfolio-search"]',
        title: "案件を探す",
      },
      {
        body: "カードをクリックすると選択、ダブルクリックするとガントを開きます。",
        selector: '[data-tour="portfolio-projects"]',
        title: "案件を開く",
      },
      {
        body: "案件を開くと、ガント、課題、作業時間、週次報告などの案件内メニューが表示されます。",
        selector: '[aria-label="メインナビゲーション"]',
        title: "画面を切り替える",
      },
      {
        body: "操作方法を確認したいときは、ここからヘルプと各操作ツアーをいつでも開けます。",
        selector: '[data-tour="help"]',
        title: "ヘルプへ戻る",
      },
    ],
    title: "基本操作",
  },
  gantt: {
    description: "タスクの追加、選択、日程変更、絞り込み、保存を案内します。",
    id: "gantt",
    steps: [
      {
        body: "タスク追加、表示単位、表示幅、休日考慮など、日常的な操作をまとめています。",
        selector: '[data-tour="gantt-toolbar"]',
        title: "ガントの操作を選ぶ",
      },
      {
        body: "バーを選ぶと開始日へ移動します。ドラッグで日程移動、端のドラッグで期間変更、ダブルクリックで詳細を開きます。",
        selector: '[data-tour="gantt-grid"]',
        title: "ガントバーを操作する",
      },
      {
        body: "行をクリックして選択します。Shift+上下で範囲選択し、Nで選択行の下へタスクを追加できます。",
        selector: '[data-tour="gantt-task-table"]',
        title: "タスク行を選択する",
      },
      {
        body: "担当者を選ぶと、その人のタスクだけに絞り込めます。自分の作業確認にも使えます。",
        selector: '[aria-label="担当者フィルター"]',
        title: "担当者で絞り込む",
      },
      {
        body: "変更内容と保存範囲を確認して、このガントの内容をAPIへ保存します。",
        selector: 'button[title^="このガントを保存"]',
        title: "変更を保存する",
      },
    ],
    title: "ガント操作",
  },
  member: {
    description: "担当タスクの実績、コメント、作業時間、日報の流れを案内します。",
    id: "member",
    steps: [
      {
        body: "まず自分を選択し、担当タスクだけに絞り込みます。",
        selector: '[aria-label="担当者フィルター"]',
        title: "自分のタスクを表示する",
      },
      {
        body: "担当タスクでは状態、進捗、実績開始日・終了日を更新できます。計画日は変更できません。",
        selector: '[data-tour="gantt-task-table"]',
        title: "実績を入力する",
      },
      {
        body: "タスクをダブルクリックして詳細を開き、進捗メモ、コメント、添付ファイルを残します。",
        selector: '[data-tour="gantt-grid"]',
        title: "タスクへ記録を残す",
      },
      {
        body: "案件に対して実施した作業時間と内容を記録します。",
        selector: '[data-tour="nav-WorkLogs"]',
        title: "作業時間を記録する",
      },
      {
        body: "その日の作業実績をまとめ、案件実績と連携して日報を提出します。",
        selector: '[data-tour="nav-DailyReports"]',
        title: "日報を提出する",
      },
    ],
    title: "メンバー向け",
  },
  planner: {
    description: "計画編集、担当割当、週次確認、分析の流れを案内します。",
    id: "planner",
    steps: [
      {
        body: "タスク追加や階層変更を使い、WBSを組み立てます。矢印キーでも階層を変更できます。",
        selector: '[data-tour="gantt-toolbar"]',
        title: "計画を組み立てる",
      },
      {
        body: "日程と担当者を設定し、非稼働日を考慮した計画を作成します。",
        selector: '[data-tour="gantt-grid"]',
        title: "日程と担当を調整する",
      },
      {
        body: "節目となるレビュー、テスト開始、リリース判定をマイルストーンとして管理します。",
        selector: '[data-tour="nav-Milestones"]',
        title: "節目を管理する",
      },
      {
        body: "週ごとの計画対実績、担当者別の作業、完了件数、未解消課題を確認します。",
        selector: '[data-tour="nav-WeeklyReport"]',
        title: "週次状況を確認する",
      },
      {
        body: "プロジェクト分析、個人分析、チーム分析から遅延や負荷、計画変更を確認します。",
        selector: '[data-tour="nav-analysis"]',
        title: "分析へ進む",
      },
    ],
    title: "PM・PL向け",
  },
  admin: {
    description: "チーム、メンバー、カレンダー、監査ログの管理を案内します。",
    id: "admin",
    steps: [
      {
        body: "管理設定では、案件とは別にワークスペース全体のマスタを管理します。",
        selector: '[data-tour="master-settings"]',
        title: "管理設定を開く",
      },
      {
        body: "チームの所属メンバーと、チーム管理者・メンバーの権限を設定します。",
        selector: '[data-tour="settings-teams"]',
        title: "チームを管理する",
      },
      {
        body: "メンバー、メールアドレス、ログイン、システム管理者権限、仮パスワードを管理します。",
        selector: '[data-tour="settings-members"]',
        title: "メンバーを管理する",
      },
      {
        body: "標準稼働日と祝日・会社休日を登録し、ガントの工数計算へ反映します。",
        selector: '[data-tour="settings-calendar"]',
        title: "カレンダーを管理する",
      },
      {
        body: "ログイン、計画保存、実績更新、添付操作などの履歴を確認します。",
        selector: '[data-tour="settings-audit"]',
        title: "監査ログを確認する",
      },
    ],
    title: "管理者向け",
  },
};

export function getTourCompletionKey(email: string, tourId: TourId) {
  return `mirai:onboarding:${email.toLowerCase()}:${tourId}:v1`;
}
