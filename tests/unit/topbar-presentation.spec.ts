import { expect, test } from "@playwright/test";

import {
  filterAndOrderProjects,
  getTopbarContextPresentation,
} from "../../frontend/src/components/layout/topbar/topbarPresentation";
import type { Project, Team } from "../../frontend/src/types/schedule";

function project(id: string, patch: Partial<Project> = {}): Project {
  return {
    id,
    name: `${id}案件`,
    nextMilestone: { date: "2026-08-01", title: "リリース" },
    rangeEnd: "2026-08-31",
    rangeStart: "2026-07-01",
    teamId: "team-1",
    workspace: `${id}プロジェクト`,
    ...patch,
  };
}

const teams: Team[] = [
  {
    code: "業",
    description: "業務システム開発",
    id: "team-1",
    memberIds: [],
    name: "業務システム事業部",
  },
];

test("Topbarの文脈表示は案件画面と管理画面で操作範囲を分ける", () => {
  const target = project("project-1", { workspace: "販売管理システム刷新" });

  expect(getTopbarContextPresentation("project", target)).toMatchObject({
    pageTitle: "販売管理システム刷新",
    projectContext: true,
    projectSearchAvailable: true,
    syncActionsVisible: true,
  });
  expect(getTopbarContextPresentation("admin", target)).toMatchObject({
    pageTitle: "管理設定",
    projectContext: false,
    projectSearchAvailable: false,
  });
});

test("案件検索はお気に入りを先頭、アーカイブを末尾へ並べる", () => {
  const ordered = filterAndOrderProjects(
    [
      project("regular"),
      project("archived", { status: "archived" }),
      project("favorite", { projectNo: "PJ-001" }),
    ],
    teams,
    new Set(["favorite"]),
    "",
  );

  expect(ordered.map((item) => item.id)).toEqual(["favorite", "regular", "archived"]);
  expect(filterAndOrderProjects(ordered, teams, new Set(), "PJ-001")).toHaveLength(1);
  expect(filterAndOrderProjects(ordered, teams, new Set(), "業務システム")).toHaveLength(3);
});
