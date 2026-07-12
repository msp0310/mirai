import type { ProjectIssueStatus } from "../../../types/schedule";
import { issueStatusLabels } from "../model/projectIssues";

export function IssueStatusBadge({ status }: { status: ProjectIssueStatus }) {
  return <span className={`issue-status-badge ${status}`}>{issueStatusLabels[status]}</span>;
}
