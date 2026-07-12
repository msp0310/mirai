import type { CSSProperties } from "react";

import { getTaskAssigneeAllocationMap } from "../../../lib/schedule";
import type { Member, ScheduleTask } from "../../../types/schedule";

/** 複数担当者の作業配分を合計100%で編集します。 */
type AssigneeAllocationEditorProps = {
  disabled: boolean;
  members: Member[];
  onChange: (memberId: string, percent: number) => void;
  task: ScheduleTask;
};

export function AssigneeAllocationEditor({
  disabled,
  members,
  onChange,
  task,
}: AssigneeAllocationEditorProps) {
  if (members.length <= 1) {
    return null;
  }
  const allocationMap = getTaskAssigneeAllocationMap(task);
  const total = Math.round(
    members.reduce((sum, member) => sum + (allocationMap.get(member.id) ?? 0), 0),
  );

  return (
    <section
      className="assignee-allocation-editor"
      data-task-focus-target="allocations"
      tabIndex={-1}
    >
      <div className="task-detail-heading">
        <span>担当配分</span>
        <small>{total}%</small>
      </div>
      {members.map((member) => {
        const percent = Math.round(allocationMap.get(member.id) ?? 0);
        const handlePercentChange = (value: string) => {
          onChange(member.id, Number(value) || 0);
        };
        return (
          <label key={member.id}>
            <span>
              <b style={{ "--avatar-color": member.color } as CSSProperties}>{member.initials}</b>
              {member.name}
            </span>
            <input
              disabled={disabled}
              max="100"
              min="0"
              onChange={(event) => handlePercentChange(event.target.value)}
              onInput={(event) => handlePercentChange(event.currentTarget.value)}
              type="range"
              value={percent}
            />
            <span className="allocation-percent-input">
              <input
                aria-label={`${member.name} 配分`}
                disabled={disabled}
                max="100"
                min="0"
                onChange={(event) => handlePercentChange(event.currentTarget.value)}
                onInput={(event) => handlePercentChange(event.currentTarget.value)}
                step="1"
                type="number"
                value={percent}
              />
              <small>%</small>
            </span>
          </label>
        );
      })}
    </section>
  );
}
