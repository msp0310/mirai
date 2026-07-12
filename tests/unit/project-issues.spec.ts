import { expect, test } from "@playwright/test";

import {
  createBlankIssueDraft,
  filterProjectIssues,
  getIssueStats,
  normalizeIssueDraft,
} from "../../frontend/src/features/issues/model/projectIssues";
import type { Member, ProjectIssue, ScheduleTask } from "../../frontend/src/types/schedule";

function issue(patch: Partial<ProjectIssue> = {}): ProjectIssue {
  return {
    assigneeIds: [],
    body: "APIの再試行条件を確認",
    createdAt: "2026-07-01T00:00:00.000Z",
    id: "issue-1",
    priority: "high",
    replies: [],
    status: "open",
    taskIds: ["task-1"],
    title: "連携エラー",
    type: "bug",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...patch,
  };
}

test("課題検索は担当者・関連タスク・返信も対象にする", () => {
  const members = new Map([["member-1", { id: "member-1", name: "山田 健太" } as Member]]);
  const tasks = new Map([["task-1", { id: "task-1", title: "API結合試験" } as ScheduleTask]]);
  const source = [
    issue({ assigneeIds: ["member-1"] }),
    issue({
      id: "issue-2",
      replies: [
        {
          authorId: "member-2",
          authorName: "佐藤",
          body: "ログを確認",
          createdAt: "2026-07-01T01:00:00.000Z",
          id: "reply-1",
        },
      ],
    }),
  ];

  expect(
    filterProjectIssues({
      issues: source,
      memberById: members,
      query: "山田",
      status: "all",
      taskById: tasks,
    }),
  ).toHaveLength(1);
  expect(
    filterProjectIssues({
      issues: source,
      memberById: members,
      query: "API結合",
      status: "all",
      taskById: tasks,
    }),
  ).toHaveLength(2);
  expect(
    filterProjectIssues({
      issues: source,
      memberById: members,
      query: "ログ",
      status: "all",
      taskById: tasks,
    }),
  ).toHaveLength(1);
});

test("未解決課題のサマリーは完了状態を除外する", () => {
  expect(
    getIssueStats([
      issue(),
      issue({ id: "blocked", status: "blocked" }),
      issue({ dueDate: "2026-07-31", id: "due", priority: "low" }),
      issue({ id: "closed", status: "closed" }),
    ]),
  ).toEqual({ blocked: 1, critical: 2, due: 1, open: 3 });
});

test("課題draftは保存前に文字列と配列を正規化する", () => {
  const draft = createBlankIssueDraft("2026-07-13T00:00:00.000Z");
  const normalized = normalizeIssueDraft({
    ...draft,
    assigneeIds: ["member-1"],
    body: "  本文  ",
    dueDate: "",
    title: "   ",
  });

  expect(normalized.title).toBe("新しい課題");
  expect(normalized.body).toBe("本文");
  expect(normalized.dueDate).toBeUndefined();
  expect(normalized.assigneeIds).not.toBe(draft.assigneeIds);
});
