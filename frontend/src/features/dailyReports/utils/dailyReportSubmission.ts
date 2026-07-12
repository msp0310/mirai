import { isWorkingDay, parseDate } from "../../../lib/schedule";
import type { CalendarDefinition, Member } from "../../../types/schedule";

/** チームカレンダーと個人休暇を合わせ、日報の提出対象か判定します。 */
export function isDailyReportRequired(
  member: Pick<Member, "availabilityOverrides">,
  date: string,
  schedules: { calendar: CalendarDefinition }[],
) {
  if (member.availabilityOverrides?.some((override) => override.date === date)) {
    return false;
  }
  const parsed = parseDate(date);
  if (schedules.length === 0) {
    return parsed.getDay() !== 0 && parsed.getDay() !== 6;
  }
  return schedules.some((schedule) => isWorkingDay(parsed, schedule.calendar, true));
}
