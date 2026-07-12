import { expect, test } from "@playwright/test";

import { isDailyReportRequired } from "../../frontend/src/features/dailyReports/utils/dailyReportSubmission";

const calendar = {
  holidays: [{ date: "2026-07-20", name: "海の日" }],
  id: "team-calendar",
  name: "標準カレンダー",
  workWeek: [1, 2, 3, 4, 5],
};

test("休日と個人休暇は日報の提出対象外になる", () => {
  expect(isDailyReportRequired({}, "2026-07-12", [{ calendar }])).toBe(false);
  expect(isDailyReportRequired({}, "2026-07-20", [{ calendar }])).toBe(false);
  expect(
    isDailyReportRequired(
      {
        availabilityOverrides: [
          { date: "2026-07-21", id: "leave-1", label: "休暇", type: "unavailable" },
        ],
      },
      "2026-07-21",
      [{ calendar }],
    ),
  ).toBe(false);
});

test("通常の稼働日は日報の提出対象になる", () => {
  expect(isDailyReportRequired({}, "2026-07-21", [{ calendar }])).toBe(true);
});
