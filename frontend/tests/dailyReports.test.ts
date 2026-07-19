import assert from "node:assert/strict";
import test from "node:test";

import { getActiveTeamMembers } from "../src/lib/members.ts";
import type { Member } from "../src/types/schedule.ts";

test("日報のチームメンバーには退職者を含めない", () => {
  const members = [
    member("active", "active"),
    member("retired", "inactive"),
    member("other", "active"),
  ];

  assert.deepEqual(
    getActiveTeamMembers(members, ["active", "retired"]).map((item) => item.id),
    ["active"],
  );
});

function member(id: string, status: Member["status"]): Member {
  return {
    capacityHours: 8,
    color: "#2563eb",
    id,
    initials: id.slice(0, 2),
    name: id,
    role: "SE",
    status,
  };
}
