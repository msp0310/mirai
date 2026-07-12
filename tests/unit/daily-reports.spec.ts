import { expect, test } from "@playwright/test";

import {
  canManageTeamReports,
  createDailyReportDraft,
  getDailyReportProjectActuals,
  sumDailyReportHours,
  type DailyReportSchedule,
} from "../../frontend/src/features/dailyReports/model/dailyReports";
import type { Member, Project, ScheduleTask, Team } from "../../frontend/src/types/schedule";

const member: Member = {
  capacityHours: 40,
  color: "#2563eb",
  id: "member-1",
  initials: "YK",
  name: "山田 健太",
  role: "PM",
};
const project: Project = {
  id: "project-1",
  name: "SI案件",
  nextMilestone: { date: "2026-08-01", title: "リリース" },
  rangeEnd: "2026-08-31",
  rangeStart: "2026-07-01",
  teamId: "team-1",
  workspace: "販売管理システム刷新",
};
const task: ScheduleTask = {
  assigneeIds: [member.id],
  color: "#2563eb",
  effortHours: 4,
  end: "2026-07-13",
  id: "task-1",
  parentId: null,
  progress: 0,
  start: "2026-07-13",
  status: "inProgress",
  title: "API実装",
  type: "task",
};
const schedule: DailyReportSchedule = {
  calendar: { holidays: [], id: "calendar-1", name: "標準", workWeek: [1, 2, 3, 4, 5] },
  members: [member],
  project,
  tasks: [task],
};

test("新規日報は指定日の下書きと最初の作業明細を作る", () => {
  const report = createDailyReportDraft(
    member.id,
    "2026-07-13",
    project.id,
    "2026-07-13T00:00:00.000Z",
  );

  expect(report).toMatchObject({
    date: "2026-07-13",
    memberId: member.id,
    status: "draft",
    version: 0,
  });
  expect(report.entries[0]).toMatchObject({ hours: 1, projectId: project.id });
});

test("案件実績サマリーは作業時間と予定工数超過を算出する", () => {
  const entries = [
    {
      category: "maintenance" as const,
      hours: 5,
      id: "entry-1",
      projectId: project.id,
      summary: "API実装",
      taskId: task.id,
    },
  ];
  const actuals = getDailyReportProjectActuals(entries, [schedule]);

  expect(sumDailyReportHours(entries)).toBe(5);
  expect(actuals.totals.get(project.id)).toBe(5);
  expect(actuals.plans.get(project.id)).toBe(4);
  expect(actuals.exceeded).toBe(true);
});

test("チーム管理者と全体管理者はチーム日報を管理できる", () => {
  const team: Team = {
    code: "業",
    description: "業務システム開発",
    id: "team-1",
    memberIds: [member.id],
    memberships: [{ memberId: member.id, role: "manager" }],
    name: "業務システム事業部",
  };

  expect(canManageTeamReports(team, { memberId: member.id, name: member.name, role: "user" })).toBe(
    true,
  );
  expect(canManageTeamReports(team, { memberId: "other", name: "管理者", role: "admin" })).toBe(
    true,
  );
  expect(canManageTeamReports(team, { memberId: "other", name: "一般", role: "user" })).toBe(false);
});
