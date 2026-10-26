const WEEKDAY = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;

export type WeekDay = {
  key: string;
  label: (typeof WEEKDAY)[number];
  date: number;
  iso: string;
  isToday: boolean;
};

/** Monday-start week in the device local timezone. */
export function startOfWeek(now: Date): Date {
  const day = now.getDay();
  const offset = day === 0 ? 6 : day - 1;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - offset);
  return start;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatWeekRange(start: Date): string {
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${pad(start.getDate())}/${pad(start.getMonth() + 1)}–${pad(end.getDate())}/${pad(end.getMonth() + 1)}`;
}

export function weekDays(now: Date): WeekDay[] {
  const start = startOfWeek(now);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return WEEKDAY.map((label, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    return {
      key: iso,
      label,
      date: date.getDate(),
      iso,
      isToday: date.getTime() === today.getTime(),
    };
  });
}

export function sameLocalDay(iso: string, dayKey: string): boolean {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return false;
  const [year, month, date] = dayKey.split("-").map(Number);
  return when.getFullYear() === year && when.getMonth() + 1 === month && when.getDate() === date;
}

export function isInWeek(iso: string, weekStart: Date): boolean {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return false;
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 7);
  return when >= weekStart && when < end;
}
