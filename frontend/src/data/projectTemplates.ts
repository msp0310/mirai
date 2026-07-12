import { addWorkingDays } from "../lib/schedule";
import type { CalendarDefinition, Member, Project, ScheduleTask } from "../types/schedule";
import type { ScheduleSnapshot } from "./scheduleRepository";

export type ProjectTemplateId = "empty" | "maintenance" | "standard-si";

export type ProjectTemplateSummary = {
  description: string;
  durationLabel: string;
  id: ProjectTemplateId;
  name: string;
  taskCount: number;
};

export type CreateProjectFromTemplateInput = {
  calendar: CalendarDefinition;
  includeCalendar: boolean;
  members: Member[];
  projectIndex: number;
  projectName: string;
  projectNo: string;
  startDate: string;
  teamId: string | null;
  templateId: ProjectTemplateId;
  workspace: string;
};

type TemplateStep = {
  assigneeIndex?: number;
  effortHours?: number;
  key: string;
  title: string;
  type?: "milestone" | "task";
  workDays: number;
};

type TemplatePhase = {
  key: string;
  steps: TemplateStep[];
  title: string;
};

type ProjectTemplateDefinition = ProjectTemplateSummary & {
  phases: TemplatePhase[];
};

const templateDefinitions: ProjectTemplateDefinition[] = [
  {
    id: "standard-si",
    name: "標準SI工程",
    description: "要件定義から本番移行まで",
    durationLabel: "約11週間",
    taskCount: 25,
    phases: [
      {
        key: "requirements",
        title: "1. 要件定義",
        steps: [
          {
            assigneeIndex: 1,
            effortHours: 24,
            key: "hearing",
            title: "1.1 現行業務ヒアリング",
            workDays: 3,
          },
          {
            assigneeIndex: 1,
            effortHours: 40,
            key: "requirement-list",
            title: "1.2 業務要件整理",
            workDays: 5,
          },
          {
            assigneeIndex: 0,
            effortHours: 24,
            key: "definition-doc",
            title: "1.3 要件定義書作成",
            workDays: 3,
          },
          {
            key: "requirements-approval",
            title: "要件定義承認",
            type: "milestone",
            workDays: 1,
          },
        ],
      },
      {
        key: "basic-design",
        title: "2. 基本設計",
        steps: [
          {
            assigneeIndex: 2,
            effortHours: 40,
            key: "screen-report",
            title: "2.1 画面・帳票設計",
            workDays: 5,
          },
          {
            assigneeIndex: 2,
            effortHours: 48,
            key: "db-if",
            title: "2.2 DB / IF設計",
            workDays: 6,
          },
          {
            assigneeIndex: 0,
            effortHours: 24,
            key: "basic-review",
            title: "2.3 基本設計レビュー",
            workDays: 3,
          },
          {
            key: "basic-approval",
            title: "基本設計承認",
            type: "milestone",
            workDays: 1,
          },
        ],
      },
      {
        key: "detail-dev",
        title: "3. 詳細設計・実装",
        steps: [
          {
            assigneeIndex: 2,
            effortHours: 40,
            key: "detail-design",
            title: "3.1 詳細設計",
            workDays: 5,
          },
          {
            assigneeIndex: 4,
            effortHours: 64,
            key: "backend-dev",
            title: "3.2 API / バッチ実装",
            workDays: 8,
          },
          {
            assigneeIndex: 3,
            effortHours: 64,
            key: "frontend-dev",
            title: "3.3 フロント実装",
            workDays: 8,
          },
          {
            assigneeIndex: 2,
            effortHours: 32,
            key: "code-review",
            title: "3.4 内部レビュー",
            workDays: 4,
          },
        ],
      },
      {
        key: "test",
        title: "4. テスト",
        steps: [
          {
            assigneeIndex: 5,
            effortHours: 32,
            key: "unit-test",
            title: "4.1 単体テスト",
            workDays: 4,
          },
          {
            assigneeIndex: 5,
            effortHours: 48,
            key: "integration-test",
            title: "4.2 結合テスト",
            workDays: 6,
          },
          {
            assigneeIndex: 0,
            effortHours: 40,
            key: "user-test",
            title: "4.3 受入テスト支援",
            workDays: 5,
          },
          {
            key: "test-complete",
            title: "テスト完了判定",
            type: "milestone",
            workDays: 1,
          },
        ],
      },
      {
        key: "release",
        title: "5. 移行・リリース",
        steps: [
          {
            assigneeIndex: 4,
            effortHours: 24,
            key: "migration-plan",
            title: "5.1 移行手順作成",
            workDays: 3,
          },
          {
            assigneeIndex: 4,
            effortHours: 24,
            key: "release-rehearsal",
            title: "5.2 リリースリハーサル",
            workDays: 3,
          },
          {
            key: "production-release",
            title: "本番リリース",
            type: "milestone",
            workDays: 1,
          },
        ],
      },
    ],
  },
  {
    id: "maintenance",
    name: "小規模改修",
    description: "調査からリリースまで",
    durationLabel: "約4週間",
    taskCount: 13,
    phases: [
      {
        key: "analysis",
        title: "1. 調査・見積",
        steps: [
          {
            assigneeIndex: 1,
            effortHours: 16,
            key: "request-review",
            title: "1.1 依頼内容確認",
            workDays: 2,
          },
          {
            assigneeIndex: 2,
            effortHours: 24,
            key: "impact-analysis",
            title: "1.2 影響調査",
            workDays: 3,
          },
          {
            key: "estimate-approval",
            title: "見積承認",
            type: "milestone",
            workDays: 1,
          },
        ],
      },
      {
        key: "implementation",
        title: "2. 設計・実装",
        steps: [
          {
            assigneeIndex: 2,
            effortHours: 24,
            key: "change-design",
            title: "2.1 変更設計",
            workDays: 3,
          },
          {
            assigneeIndex: 4,
            effortHours: 40,
            key: "change-dev",
            title: "2.2 実装",
            workDays: 5,
          },
          {
            assigneeIndex: 3,
            effortHours: 16,
            key: "frontend-adjust",
            title: "2.3 画面調整",
            workDays: 2,
          },
        ],
      },
      {
        key: "verification",
        title: "3. 検証・リリース",
        steps: [
          {
            assigneeIndex: 5,
            effortHours: 24,
            key: "regression-test",
            title: "3.1 回帰テスト",
            workDays: 3,
          },
          {
            assigneeIndex: 0,
            effortHours: 16,
            key: "customer-confirm",
            title: "3.2 顧客確認",
            workDays: 2,
          },
          {
            key: "release",
            title: "リリース",
            type: "milestone",
            workDays: 1,
          },
        ],
      },
    ],
  },
  {
    id: "empty",
    name: "空のプロジェクト",
    description: "ルート行のみ",
    durationLabel: "任意",
    taskCount: 1,
    phases: [],
  },
];

export const projectTemplates: ProjectTemplateSummary[] = templateDefinitions.map(
  ({ description, durationLabel, id, name, taskCount }) => ({
    description,
    durationLabel,
    id,
    name,
    taskCount,
  }),
);
export function createProjectFromTemplate({
  calendar,
  includeCalendar,
  members,
  projectIndex,
  projectName,
  projectNo,
  startDate,
  teamId,
  templateId,
  workspace,
}: CreateProjectFromTemplateInput): ScheduleSnapshot {
  const template =
    templateDefinitions.find((item) => item.id === templateId) ?? templateDefinitions[0];
  const stamp = Date.now().toString(36);
  const projectId = `project-${stamp}`;
  const safeWorkspace = workspace.trim() || `新規プロジェクト ${projectIndex}`;
  const safeProjectName = projectName.trim() || safeWorkspace;
  const rootId = `${projectId}-root`;
  const rootAssignee = members[0]?.id ?? "yk";
  const tasks: ScheduleTask[] = [
    {
      assigneeIds: [rootAssignee],
      color: "#5865e8",
      end: startDate,
      expanded: true,
      id: rootId,
      parentId: null,
      progress: 0,
      start: startDate,
      status: "notStarted",
      title: `${safeWorkspace}（全体）`,
      type: "summary",
    },
  ];
  let cursor = startDate;
  let previousLeafId: string | null = null;
  let nextMilestone = {
    date: startDate,
    title: template.id === "empty" ? "キックオフ" : "次のマイルストーン",
  };

  template.phases.forEach((phase, phaseIndex) => {
    const phaseId = `${projectId}-${phase.key}`;
    tasks.push({
      assigneeIds: [rootAssignee],
      color: phaseColors[phaseIndex % phaseColors.length],
      end: cursor,
      expanded: true,
      id: phaseId,
      parentId: rootId,
      progress: 0,
      start: cursor,
      status: "notStarted",
      title: phase.title,
      type: "phase",
    });

    phase.steps.forEach((step) => {
      const id = `${projectId}-${step.key}`;
      const isMilestone = step.type === "milestone";
      const start = cursor;
      const end = isMilestone
        ? start
        : addWorkingDays(start, step.workDays, calendar, includeCalendar);
      const assigneeId = members[step.assigneeIndex ?? 0]?.id ?? members[0]?.id ?? "yk";
      tasks.push({
        assigneeIds: [assigneeId],
        color: isMilestone ? "#0f69c9" : taskColors[phaseIndex % taskColors.length],
        dependencies: previousLeafId ? [previousLeafId] : [],
        effortHours: isMilestone ? undefined : (step.effortHours ?? step.workDays * 8),
        end,
        id,
        parentId: phaseId,
        progress: 0,
        start,
        status: "notStarted",
        title: step.title,
        type: isMilestone ? "milestone" : "task",
      });
      if (isMilestone && nextMilestone.title === "次のマイルストーン") {
        nextMilestone = { date: start, title: step.title };
      }
      previousLeafId = id;
      cursor = nextWorkingDate(end, calendar, includeCalendar);
    });
  });

  const normalizedTasks = normalizeGeneratedSummaryTasks(tasks);
  const projectEnd =
    normalizedTasks.find((task) => task.id === rootId)?.end ??
    addWorkingDays(startDate, 10, calendar, includeCalendar);
  const project: Project = {
    id: projectId,
    lifecycleStatus: "planning",
    memberIds: members.map((member) => member.id),
    name: safeProjectName,
    projectNo: projectNo.trim() || null,
    nextMilestone,
    rangeEnd: addWorkingDays(projectEnd, 5, calendar, includeCalendar),
    rangeStart: startDate,
    teamId,
    workspace: safeWorkspace,
  };

  return {
    calendar,
    issues: [],
    members,
    project,
    tasks: normalizedTasks,
    workLogs: [],
  };
}

function nextWorkingDate(dateKey: string, calendar: CalendarDefinition, includeCalendar: boolean) {
  return addWorkingDays(dateKey, 2, calendar, includeCalendar);
}

function normalizeGeneratedSummaryTasks(tasks: ScheduleTask[]) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  [...tasks]
    .toReversed()
    .filter((task) => task.type === "summary" || task.type === "phase")
    .forEach((parent) => {
      const children = tasks.filter((task) => task.parentId === parent.id);
      if (children.length === 0) {
        return;
      }
      const start = children.reduce(
        (min, task) => (task.start < min ? task.start : min),
        children[0].start,
      );
      const end = children.reduce(
        (max, task) => (task.end > max ? task.end : max),
        children[0].end,
      );
      taskById.set(parent.id, {
        ...parent,
        end,
        start,
      });
    });
  return tasks.map((task) => taskById.get(task.id) ?? task);
}

const phaseColors = ["#2f73e0", "#13a17d", "#7c4dff", "#df8b1d", "#0f69c9"];
const taskColors = ["#8bd4d2", "#89b7ff", "#c7d2fe", "#ffc184", "#9addb8"];
