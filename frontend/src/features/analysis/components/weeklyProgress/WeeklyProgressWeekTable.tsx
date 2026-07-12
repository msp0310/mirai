import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

import {
  formatWeekLabel,
  visibleWeekCount,
  type WeeklyProgressRow,
} from "../../model/weeklyProgress";

type WeeklyProgressWeekTableProps = {
  activeWeekWindowStart: number;
  maxWeekWindowStart: number;
  onMoveToCurrentWeek: () => void;
  onMoveWeekWindow: (direction: -1 | 1) => void;
  onSelectWeek: (weekKey: string) => void;
  selectedWeekKey?: string;
  totalWeeks: number;
  visibleRows: WeeklyProgressRow[];
};

/** 3週間単位の移動と、週別集計の選択操作を提供します。 */
export function WeeklyProgressWeekTable({
  activeWeekWindowStart,
  maxWeekWindowStart,
  onMoveToCurrentWeek,
  onMoveWeekWindow,
  onSelectWeek,
  selectedWeekKey,
  totalWeeks,
  visibleRows,
}: WeeklyProgressWeekTableProps) {
  return (
    <>
      <div className="weekly-progress-navigation" aria-label="表示する週の切り替え">
        <div>
          <span>表示中</span>
          <strong>
            {activeWeekWindowStart + 1} -{" "}
            {Math.min(activeWeekWindowStart + visibleWeekCount, totalWeeks)}週目
          </strong>
        </div>
        <div className="weekly-progress-navigation-actions">
          <button
            aria-label="前の3週を表示"
            disabled={activeWeekWindowStart === 0}
            onClick={() => onMoveWeekWindow(-1)}
            title="前の3週"
            type="button"
          >
            <ChevronLeftIcon />
          </button>
          <button
            className="weekly-progress-current-week"
            onClick={onMoveToCurrentWeek}
            type="button"
          >
            今週へ
          </button>
          <button
            aria-label="次の3週を表示"
            disabled={activeWeekWindowStart >= maxWeekWindowStart}
            onClick={() => onMoveWeekWindow(1)}
            title="次の3週"
            type="button"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      <div className="weekly-progress-table-wrap">
        <table className="weekly-progress-table">
          <thead>
            <tr>
              <th scope="col">週</th>
              <th scope="col">対象タスク</th>
              <th scope="col">完了</th>
              <th scope="col">進行中</th>
              <th scope="col">終了予定</th>
              <th scope="col">遅延</th>
              <th scope="col">現在進捗</th>
              <th scope="col">詳細</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const completionRate =
                row.planned > 0 ? Math.round((row.completed / row.planned) * 100) : 0;
              const isSelected = row.weekKey === selectedWeekKey;
              return (
                <tr
                  className={[row.delayed > 0 ? "has-delay" : "", isSelected ? "selected" : ""]
                    .filter(Boolean)
                    .join(" ")}
                  key={row.start}
                >
                  <th scope="row">
                    <strong>{formatWeekLabel(row.start)}</strong>
                    <small>
                      {row.start.slice(5).replace("-", "/")} - {row.end.slice(5).replace("-", "/")}
                    </small>
                  </th>
                  <td>{row.targetCount}件</td>
                  <td className="weekly-progress-completed">{row.completed}件</td>
                  <td>{row.inProgress}件</td>
                  <td>{row.planned}件</td>
                  <td className={row.delayed > 0 ? "weekly-progress-delayed" : undefined}>
                    {row.delayed}件
                  </td>
                  <td>
                    <div className="weekly-progress-cell">
                      <span>{completionRate}%</span>
                      <span className="weekly-progress-meter">
                        <span style={{ width: `${completionRate}%` }} />
                      </span>
                      <small>対象 {row.currentProgress}%</small>
                    </div>
                  </td>
                  <td>
                    <button
                      aria-label={`${formatWeekLabel(row.start)}の担当別タスクを表示`}
                      aria-pressed={isSelected}
                      className="weekly-progress-detail-button"
                      onClick={() => onSelectWeek(row.weekKey)}
                      type="button"
                    >
                      表示
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
