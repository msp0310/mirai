import { expect, test } from "@playwright/test";

import { calendar, members, project, tasks, teams } from "../../frontend/src/data/mockSchedule";
import type {
  ScheduleSnapshot,
  ScheduleWorkspace,
} from "../../frontend/src/data/scheduleRepository";
import { createProjectExportFile } from "../../frontend/src/features/projects/lib/projectExportService";
import { prepareProjectImport } from "../../frontend/src/features/projects/lib/projectImportService";
import type { PendingProjectImport } from "../../frontend/src/features/projects/types/projectImport";

const schedule: ScheduleSnapshot = {
  calendar,
  members,
  project,
  tasks,
};

const workspace: ScheduleWorkspace = {
  schedules: [schedule],
  teams,
};

function createPendingImport(): PendingProjectImport {
  return {
    data: {
      ...schedule,
      team: teams[0],
    },
    fileName: "project.json",
    validation: { errors: [], warnings: [] },
  };
}

test("CSV出力で区切り文字と引用符を正しくエスケープする", () => {
  const exportFile = createProjectExportFile("csv", schedule, [
    {
      ...tasks[0],
      assigneeIds: [members[0].id],
      title: '確認, "引用"',
    },
  ]);

  expect(exportFile.fileName).toMatch(/\.csv$/);
  expect(exportFile.content).toContain('"確認, ""引用"""');
  expect(exportFile.content).toContain(members[0].name);
});

test("同じ案件IDを追加取込すると別案件として識別できる", () => {
  const prepared = prepareProjectImport(createPendingImport(), "add", workspace, teams[0].id);

  expect(prepared.replaceExisting).toBe(false);
  expect(prepared.projectIdChanged).toBe(true);
  expect(prepared.importedProjectId).toBe(`${project.id}-import`);
  expect(prepared.nextSchedule.project.name).toContain("インポート");
});

test("上書き取込では案件IDと表示名を維持する", () => {
  const prepared = prepareProjectImport(createPendingImport(), "replace", workspace, teams[0].id);

  expect(prepared.replaceExisting).toBe(true);
  expect(prepared.projectIdChanged).toBe(false);
  expect(prepared.importedProjectId).toBe(project.id);
  expect(prepared.nextSchedule.project.name).toBe(project.name);
});
