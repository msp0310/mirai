import { getMemberStatusLabel, isMemberActive } from "../../lib/members";
import type { Member } from "../../types/schedule";

type MemberChecklistProps = {
  disabled?: boolean;
  focusTarget?: string;
  members: Member[];
  onToggle: (memberId: string) => void;
  selectedIds: string[];
  title: string;
};

/** 複数メンバーを選択するためのチェックリストを表示します。 */
export function MemberChecklist({
  disabled = false,
  focusTarget,
  members,
  onToggle,
  selectedIds,
  title,
}: MemberChecklistProps) {
  return (
    <div
      className="check-list member-checklist"
      data-task-focus-target={focusTarget}
      tabIndex={focusTarget ? -1 : undefined}
    >
      <span>{title}</span>
      {members.map((member) => (
        <label className={isMemberActive(member) ? "" : "inactive"} key={member.id}>
          <input
            aria-label={`${title}: ${member.name}`}
            checked={selectedIds.includes(member.id)}
            disabled={disabled}
            onChange={() => onToggle(member.id)}
            type="checkbox"
          />
          {member.initials} {member.name}
          {!isMemberActive(member) ? <small>{getMemberStatusLabel(member)}</small> : null}
        </label>
      ))}
    </div>
  );
}
