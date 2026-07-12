import { PlusIcon } from "@heroicons/react/24/outline";

import * as styles from "./DailyReportPage.css";

type DailyReportPageHeaderProps = {
  onCreate: () => void;
  onViewModeChange: (mode: "mine" | "team") => void;
  viewMode: "mine" | "team";
};

/** 日報画面の表示切替と新規作成導線を表示します。 */
export function DailyReportPageHeader({
  onCreate,
  onViewModeChange,
  viewMode,
}: DailyReportPageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <h2 className={styles.heading}>日報</h2>
        <span className={styles.description}>一日の作業をまとめ、案件・タスク別の実績へ反映</span>
      </div>
      <div className={styles.pageActions}>
        <div className={styles.viewSwitch} aria-label="日報表示">
          <button
            className={viewMode === "mine" ? styles.viewSwitchActive : ""}
            onClick={() => onViewModeChange("mine")}
            type="button"
          >
            自分の日報
          </button>
          <button
            className={viewMode === "team" ? styles.viewSwitchActive : ""}
            onClick={() => onViewModeChange("team")}
            type="button"
          >
            みんなの日報
          </button>
        </div>
        {viewMode === "mine" ? (
          <button className={styles.primaryButton} onClick={onCreate} type="button">
            <PlusIcon className={styles.buttonIcon} />
            日報を作成
          </button>
        ) : null}
      </div>
    </header>
  );
}
