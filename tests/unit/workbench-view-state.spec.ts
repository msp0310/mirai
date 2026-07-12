import { expect, test } from "@playwright/test";

import {
  type WorkbenchViewInitialState,
  createWorkbenchViewStore,
  workbenchViewAtoms,
} from "../../frontend/src/app/workbenchViewState";

function createInitialState(projectId: string): WorkbenchViewInitialState {
  return {
    activeProjectId: projectId,
    activeTeamId: "team-1",
    calendarAware: true,
    collapsedIdsByProject: {},
    columnVisibility: { assignee: false, progress: false, status: true },
    filterOpen: false,
    filters: {
      assigneeId: "all",
      query: "",
      statuses: { delayed: true, done: true, inProgress: true, notStarted: true },
    },
    resourceDisplaySettings: {
      compact: false,
      showHours: true,
      showPercent: true,
      warningThreshold: 100,
    },
    resourceScope: "project",
    scale: "normal",
    timeUnit: "day",
  };
}

test("ワークベンチごとに画面状態を分離する", () => {
  const firstStore = createWorkbenchViewStore(createInitialState("project-1"));
  const secondStore = createWorkbenchViewStore(createInitialState("project-2"));

  firstStore.set(workbenchViewAtoms.activeTeamId, "team-2");

  expect(firstStore.get(workbenchViewAtoms.activeProjectId)).toBe("project-1");
  expect(secondStore.get(workbenchViewAtoms.activeProjectId)).toBe("project-2");
  expect(secondStore.get(workbenchViewAtoms.activeTeamId)).toBe("team-1");
});
