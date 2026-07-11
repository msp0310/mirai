import { CalendarDaysIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type { Member, ScheduleFilters, TaskStatus } from "../../../types/schedule";
import { isMemberActive } from "../../../lib/members";
import { statusLabels } from "../../../lib/schedule";

type FilterPanelProps = {
  filters: ScheduleFilters;
  members: Member[];
  onAssigneeChange: (assigneeId: string) => void;
  onClose: () => void;
  onReset: () => void;
  onStatusToggle: (status: TaskStatus) => void;
};

/** タスク一覧に適用する状態、担当者、期間の条件を編集します。 */
export function FilterPanel({
  filters,
  members,
  onAssigneeChange,
  onClose,
  onReset,
  onStatusToggle,
}: FilterPanelProps) {
  return (
    <aside className="filter-panel">
      <div className="panel-heading">
        <strong>フィルター</strong>
        <button onClick={onReset} type="button">
          リセット
        </button>
        <button className="close-button" onClick={onClose} aria-label="閉じる" type="button">
          <XMarkIcon />
        </button>
      </div>
      <div className="filter-section">
        <span>ステータス</span>
        {(Object.entries(statusLabels) as [TaskStatus, string][]).map(([status, label]) => (
          <label className="check-row" key={status}>
            <input
              checked={filters.statuses[status]}
              onChange={() => onStatusToggle(status)}
              type="checkbox"
            />
            {label}
          </label>
        ))}
      </div>
      <div className="filter-section">
        <span>担当者</span>
        <select
          onChange={(event) => onAssigneeChange(event.target.value)}
          value={filters.assigneeId}
        >
          <option value="all">すべての担当者</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
              {!isMemberActive(member) ? "（休止中）" : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="filter-section">
        <span>日付範囲</span>
        <label className="radio-row">
          <input defaultChecked name="date-filter" type="radio" />
          すべての期間
        </label>
        <label className="radio-row">
          <input name="date-filter" type="radio" />
          開始日ベース
        </label>
        <label className="radio-row">
          <input name="date-filter" type="radio" />
          期間を指定
        </label>
        <div className="date-range">
          <span>2025/04/28</span>
          <span>〜</span>
          <span>2025/06/22</span>
          <CalendarDaysIcon />
        </div>
      </div>
      <button className="apply-button" onClick={onClose} type="button">
        フィルターを適用
      </button>
    </aside>
  );
}
