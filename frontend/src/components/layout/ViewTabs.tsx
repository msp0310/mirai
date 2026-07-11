import type { AppViewTab } from "../../types/schedule";

export type ViewTab = AppViewTab;

export const viewTabs: ViewTab[] = [
  "Gantt",
  "Status",
  "Analysis",
  "Issues",
  "WorkLogs",
  "Resource",
  "Calendar",
  "Milestones",
  "Activity",
];

const viewTabLabels: Record<ViewTab, string> = {
  Analysis: "分析",
  DailyReports: "日報",
  Activity: "履歴",
  Calendar: "カレンダー",
  Gantt: "ガント",
  Issues: "課題",
  Milestones: "マイルストーン",
  PersonalAnalytics: "マイ分析",
  Projects: "案件一覧",
  Resource: "リソース",
  Status: "概要",
  WorkLogs: "作業時間",
  Workload: "稼働・要員計画",
  WeeklyReport: "週次報告",
};

type ViewTabsProps = {
  activeTab: ViewTab;
  onChange: (tab: ViewTab) => void;
};

/** プロジェクト内の主要ビューを切り替えるタブバーです。 */
export function ViewTabs({ activeTab, onChange }: ViewTabsProps) {
  return (
    <nav className="tabs project-view-tabs" aria-label="プロジェクト内ビュー切り替え">
      {viewTabs.map((tab, index) => {
        const label = viewTabLabels[tab];
        const active =
          tab === "Analysis"
            ? activeTab === "Analysis" || activeTab === "WeeklyReport"
            : tab === activeTab;
        return (
          <button
            className={active ? "tab active" : "tab"}
            key={tab}
            onClick={() => onChange(tab)}
            title={`${label} (Alt+${index + 1})`}
            type="button"
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}
