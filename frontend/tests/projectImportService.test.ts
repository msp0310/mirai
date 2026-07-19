import assert from "node:assert/strict";
import test from "node:test";

import type { TaskCsvImportDraft } from "../src/data/scheduleImportExport.ts";
import { resolveTaskImportMembers } from "../src/features/projects/lib/projectImportMembers.ts";
import type { Member } from "../src/types/schedule.ts";

function member(id: string, name: string): Member {
  return {
    capacityHours: 8,
    color: "#2563eb",
    id,
    initials: name.slice(0, 1),
    name,
    role: "SE",
  };
}

test("Brabio要員は同名の既存要員へ割り当て、新しい要員だけを追加する", () => {
  const draft: TaskCsvImportDraft = {
    headers: ["ID", "種別", "タイトル", "開始日", "終了日", "担当者"],
    mapping: { assignees: 5, end: 4, id: 0, start: 3, title: 2, type: 1 },
    rows: [
      [
        "task-1",
        "task",
        "設計",
        "2026-07-01",
        "2026-07-02",
        "brabio-yoshiura\nbrabio-momono",
      ],
    ],
    sourceRows: 1,
  };

  const resolved = resolveTaskImportMembers(
    [member("pjmgt-yoshiura", "吉浦 淳也")],
    [
      member("brabio-yoshiura", "吉浦淳也"),
      member("brabio-momono", "百野 早貴"),
    ],
    draft,
  );

  assert.deepEqual(
    resolved.membersToCreate.map((item) => item.id),
    ["brabio-momono"],
  );
  assert.equal(resolved.draft.rows[0][5], "pjmgt-yoshiura\nbrabio-momono");
});
