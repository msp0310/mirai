import { formatShortDate } from "../../../../lib/schedule";
import type { Member, ProjectIssue } from "../../../../types/schedule";
import {
  formatIssueAssignees,
  formatWeekLabel,
  isIssueResolved,
  issuePriorityLabels,
  issueStatusLabels,
  maxVisibleWeeklyIssues,
  type WeeklyProgressRow,
} from "../../model/weeklyProgress";

type WeeklyProgressIssueListProps = {
  issues: ProjectIssue[];
  memberById: Map<string, Member>;
  onOpenIssues: () => void;
  selectedWeek: WeeklyProgressRow;
  unresolvedCount: number;
};

/** 選択週までに解消予定の課題と、前週からの持ち越しを表示します。 */
export function WeeklyProgressIssueList({
  issues,
  memberById,
  onOpenIssues,
  selectedWeek,
  unresolvedCount,
}: WeeklyProgressIssueListProps) {
  return (
    <div className="weekly-progress-issues">
      <div className="weekly-progress-issues-heading">
        <div>
          <h3>{formatWeekLabel(selectedWeek.start)}までに解消予定の課題</h3>
          <p>期限が{formatShortDate(selectedWeek.end)}以前の課題を、持ち越しも含めて表示します。</p>
        </div>
        <div className="weekly-progress-issues-summary">
          <span>
            未解消 <strong>{unresolvedCount}件</strong>
          </span>
          <span>解消済み {issues.length - unresolvedCount}件</span>
          <button onClick={onOpenIssues} type="button">
            課題一覧へ
          </button>
        </div>
      </div>
      <div className="weekly-progress-issue-list">
        {issues.slice(0, maxVisibleWeeklyIssues).map((issue) => (
          <WeeklyProgressIssue
            issue={issue}
            key={issue.id}
            memberById={memberById}
            selectedWeek={selectedWeek}
          />
        ))}
        {issues.length === 0 ? (
          <div className="weekly-progress-detail-empty">
            この週までに期限を迎える課題はありません。
          </div>
        ) : null}
      </div>
      {issues.length > maxVisibleWeeklyIssues ? (
        <small className="weekly-progress-detail-note">
          先頭{maxVisibleWeeklyIssues}件を表示しています。全{issues.length}
          件は課題一覧で確認できます。
        </small>
      ) : null}
    </div>
  );
}

function WeeklyProgressIssue({
  issue,
  memberById,
  selectedWeek,
}: {
  issue: ProjectIssue;
  memberById: Map<string, Member>;
  selectedWeek: WeeklyProgressRow;
}) {
  const resolved = isIssueResolved(issue);
  const carriedOver = !resolved && Boolean(issue.dueDate && issue.dueDate < selectedWeek.start);

  return (
    <div className={`weekly-progress-issue-row ${resolved ? "resolved" : "unresolved"}`}>
      <div className="weekly-progress-issue-badges">
        <span className={`priority ${issue.priority}`}>{issuePriorityLabels[issue.priority]}</span>
        <span className={`status ${issue.status}`}>{issueStatusLabels[issue.status]}</span>
        {carriedOver ? <span className="carry-over">持ち越し</span> : null}
      </div>
      <div className="weekly-progress-issue-copy">
        <strong>{issue.title}</strong>
        <small>
          {formatIssueAssignees(issue, memberById)} / 関連タスク {issue.taskIds.length}件
        </small>
      </div>
      <span className="weekly-progress-issue-due">
        期限 {formatShortDate(issue.dueDate ?? selectedWeek.end)}
      </span>
    </div>
  );
}
