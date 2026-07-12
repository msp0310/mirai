import type { CalendarHoliday } from "../types/schedule";

export type PublicHolidayImportResult = {
  addedCount: number;
  holidays: CalendarHoliday[];
  importedCount: number;
};

type PublicHolidayDto = {
  date: string;
  name: string;
  source: string;
};

/** APIから日本の祝日を取得し、カレンダー表示用の形式へ正規化します。 */
export async function fetchJapanesePublicHolidays(
  from: string,
  to: string,
): Promise<CalendarHoliday[]> {
  const params = new URLSearchParams({ from, to });
  const response = await fetch(`/api/holidays/japan?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("祝日データを取得できませんでした。");
  }

  const holidays = (await response.json()) as PublicHolidayDto[];
  return holidays.map((holiday) => ({
    date: holiday.date,
    name: holiday.name,
  }));
}
export function mergeCalendarHolidays(
  current: CalendarHoliday[],
  imported: CalendarHoliday[],
): PublicHolidayImportResult {
  const byDate = new Map(current.map((holiday) => [holiday.date, holiday]));
  let addedCount = 0;

  imported.forEach((holiday) => {
    if (byDate.has(holiday.date)) {
      return;
    }
    byDate.set(holiday.date, holiday);
    addedCount += 1;
  });

  return {
    addedCount,
    holidays: [...byDate.values()].toSorted((a, b) => a.date.localeCompare(b.date)),
    importedCount: imported.length,
  };
}
