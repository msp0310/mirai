export type TaskStatus = "notStarted" | "inProgress" | "done" | "delayed";
export type TaskType = "summary" | "phase" | "task" | "milestone";
export type ProjectStatus = "active" | "archived";
export type ProjectLifecycleStatus = "planning" | "inProgress" | "completed";
export type ProjectAssignmentStatus = "draft" | "confirmed";
export type StaffingDemandStatus = "open" | "filled";
export type ProjectIssuePriority = "critical" | "high" | "medium" | "low";
export type ProjectIssueStatus = "open" | "inProgress" | "blocked" | "resolved" | "closed";
export type ProjectIssueType = "bug" | "change" | "question" | "risk" | "task";
export type ProjectIssueGitHubState = "closed" | "open";
export type ProjectIssueSyncStatus = "error" | "linked" | "pending" | "synced" | "unlinked";
export type WorkLogCategory =
  | "improvement"
  | "incident"
  | "maintenance"
  | "meeting"
  | "other"
  | "support";
export type MemberStatus = "active" | "inactive";
export type MemberAvailabilityOverrideType = "unavailable";
export type UtilizationTone = "good" | "warning" | "danger";
export type AppViewTab =
  | "Gantt"
  | "Analysis"
  | "Status"
  | "Projects"
  | "DailyReports"
  | "PersonalAnalytics"
  | "Workload"
  | "Resource"
  | "Issues"
  | "WorkLogs"
  | "WeeklyReport"
  | "Calendar"
  | "Milestones"
  | "Activity";

export type CalendarHoliday = {
  date: string;
  name: string;
};

export type CalendarDefinition = {
  id: string;
  name: string;
  workWeek: number[];
  holidays: CalendarHoliday[];
};

export type Member = {
  id: string;
  name: string;
  initials: string;
  role: string;
  color: string;
  capacityHours: number;
  status?: MemberStatus;
  inactiveAt?: string;
  availabilityOverrides?: MemberAvailabilityOverride[];
  loginEmail?: string | null;
  permissionRole?: string | null;
  loginEnabled?: boolean;
  loginCreatedAt?: string | null;
  lastLoginAt?: string | null;
  passwordChangedAt?: string | null;
  passwordResetRequired?: boolean;
};

export type MemberAvailabilityOverride = {
  id: string;
  date: string;
  type: MemberAvailabilityOverrideType;
  label: string;
};

export type Team = {
  id: string;
  name: string;
  code: string;
  description: string;
  memberIds: string[];
};

export type Project = {
  id: string;
  teamId: string;
  name: string;
  workspace: string;
  version?: number;
  lifecycleStatus?: ProjectLifecycleStatus;
  memberIds?: string[];
  rangeStart: string;
  rangeEnd: string;
  nextMilestone: {
    title: string;
    date: string;
  };
  status?: ProjectStatus;
  archivedAt?: string;
  assignments?: ProjectAssignment[];
  staffingDemands?: StaffingDemand[];
};

export type ProjectAssignment = {
  allocationPercent: number;
  endDate: string;
  id: string;
  memberId: string;
  role: string;
  startDate: string;
  status: ProjectAssignmentStatus;
};

export type StaffingDemand = {
  allocationPercent: number;
  endDate: string;
  id: string;
  requiredCount: number;
  role: string;
  startDate: string;
  status: StaffingDemandStatus;
};

export type TaskChecklistItem = {
  done: boolean;
  id: string;
  label: string;
};

export type AttachmentOwnerType = "issue" | "issueReply" | "task" | "taskComment" | "workLog";

export type Attachment = {
  contentType: string;
  downloadUrl: string;
  fileName: string;
  id: string;
  ownerId: string;
  ownerType: AttachmentOwnerType;
  parentId?: string;
  sha256: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
};

export type TaskComment = {
  attachments?: Attachment[];
  author: string;
  body: string;
  createdAt: string;
  id: string;
};

export type TaskReferenceLink = {
  createdAt: string;
  id: string;
  label: string;
  url: string;
};

export type ProjectIssueGitHubLink = {
  issueNumber?: number;
  lastSyncedAt?: string;
  repository?: string;
  state?: ProjectIssueGitHubState;
  syncStatus?: ProjectIssueSyncStatus;
  url?: string;
};

export type ProjectIssueReply = {
  attachments?: Attachment[];
  authorId?: string;
  authorName: string;
  body: string;
  createdAt: string;
  id: string;
  updatedAt?: string;
};

export type ProjectIssue = {
  attachments?: Attachment[];
  assigneeIds: string[];
  body: string;
  closedAt?: string;
  createdAt: string;
  dueDate?: string;
  github?: ProjectIssueGitHubLink;
  id: string;
  priority: ProjectIssuePriority;
  replies?: ProjectIssueReply[];
  status: ProjectIssueStatus;
  taskIds: string[];
  title: string;
  type: ProjectIssueType;
  updatedAt: string;
};

export type ProjectWorkLog = {
  attachments?: Attachment[];
  billable: boolean;
  category: WorkLogCategory;
  createdAt: string;
  createdBy: string;
  date: string;
  dailyReportEntryId?: string;
  dailyReportId?: string;
  hours: number;
  id: string;
  issueId?: string;
  memberId: string;
  note?: string;
  summary: string;
  taskId?: string;
  updatedAt: string;
};

export type DailyReportEntry = {
  id: string;
  projectId: string;
  taskId?: string;
  hours: number;
  category: WorkLogCategory;
  summary: string;
  note?: string;
  workLogId?: string;
};

export type DailyReportComment = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type DailyReport = {
  id: string;
  memberId: string;
  date: string;
  status: "draft" | "submitted";
  summary: string;
  blockers?: string;
  nextPlan?: string;
  entries: DailyReportEntry[];
  comments: DailyReportComment[];
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
  unreadCommentCount?: number;
  version: number;
};

export type DailyReportReminder = {
  id: string;
  teamId: string;
  date: string;
  recipientMemberId: string;
  senderName: string;
  createdAt: string;
  readAt?: string;
};

export type TaskAssigneeAllocation = {
  memberId: string;
  percent: number;
};

export type ScheduleTask = {
  id: string;
  parentId: string | null;
  title: string;
  type: TaskType;
  status: TaskStatus;
  start: string;
  end: string;
  progress: number;
  assigneeIds: string[];
  assigneeAllocations?: TaskAssigneeAllocation[];
  color: string;
  expanded?: boolean;
  dependencies?: string[];
  description?: string;
  effortHours?: number;
  baselineStart?: string;
  baselineEnd?: string;
  baselineCapturedAt?: string;
  checklist?: TaskChecklistItem[];
  comments?: TaskComment[];
  links?: TaskReferenceLink[];
};

export type CreateTaskInput = {
  title: string;
  parentId: string | null;
  start: string;
  end: string;
  assigneeIds: string[];
  effortHours?: number;
};

export type CreateMilestoneInput = {
  title: string;
  parentId: string | null;
  date: string;
  assigneeIds: string[];
};

export type TaskDateChange = {
  end: string;
  start: string;
};

export type ScheduleChangeLog = {
  afterValue?: string;
  beforeValue?: string;
  changedAt: string;
  changedBy: string;
  deltaDays?: number;
  field: string;
  id: string;
  projectId: string;
  reason?: string;
  taskId: string;
};

export type TaskInspectorFocusTarget =
  | "assignees"
  | "allocations"
  | "baseline"
  | "comments"
  | "dependencies"
  | "description"
  | "effort"
  | "end"
  | "progress"
  | "start"
  | "status"
  | "title";

export type GanttScale = "compact" | "normal" | "comfortable";
export type GanttTimeUnit = "day" | "week" | "month";
export type ResourceScope = "project" | "team";
export type ResourceDisplaySettings = {
  compact: boolean;
  showHours: boolean;
  showPercent: boolean;
  warningThreshold: number;
};
export type LocalDraftChangeSummary = {
  count: number;
  detail: string;
  labels: string[];
};
export type GanttColumnKey = "assignee" | "status" | "progress";
export type GanttColumnVisibility = Record<GanttColumnKey, boolean>;

export type TaskRow = ScheduleTask & {
  depth: number;
  hasChildren: boolean;
};

export type TaskMoveTarget = Pick<ScheduleTask, "id" | "title" | "type"> & {
  depth: number;
};

export type TimelineDay = {
  key: string;
  start: string;
  end: string;
  date: Date;
  index: number;
  spanDays: number;
  label: string;
  subLabel?: string;
  day: number;
  weekday: number;
  month: number;
  isWeekend: boolean;
  holiday?: CalendarHoliday;
  isNonWorking: boolean;
};

export type TimelineColumn = {
  key: string;
  label: string;
  startIndex: number;
  span: number;
  start?: string;
};

export type ScheduleFilters = {
  query: string;
  assigneeId: string;
  statuses: Record<TaskStatus, boolean>;
};

export type ProgressStats = {
  delayed: number;
  completed: number;
  total: number;
  progress: number;
};

export type ResourceCell = {
  week: string;
  hours: number;
  capacityHours: number;
  percent: number;
  tone: UtilizationTone;
  unavailableDays: number;
  contributions: ResourceTaskContribution[];
};

export type ResourceTaskContribution = {
  allocationPercent: number;
  assigneeCount: number;
  end: string;
  hours: number;
  progress: number;
  projectId?: string;
  projectName?: string;
  start: string;
  status: TaskStatus;
  taskId: string;
  title: string;
};

export type ResourceRowModel = {
  member: Member;
  utilization: number;
  cells: ResourceCell[];
};

export type ActivityCategory =
  | "calendar"
  | "import"
  | "issue"
  | "project"
  | "sync"
  | "task"
  | "team"
  | "workLog";

export type ActivityTone = "danger" | "info" | "success" | "warning";

export type ActivityLogEntry = {
  actor: string;
  category: ActivityCategory;
  detail: string;
  happenedAt: string;
  id: string;
  projectId: string;
  taskId?: string;
  title: string;
  tone: ActivityTone;
};
