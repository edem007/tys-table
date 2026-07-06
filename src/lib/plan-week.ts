/** Monday (week start, Dallas calendar date) of the week containing `date`. */
export function mondayOfWeek(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = parseInt(get("year"), 10);
  const m = parseInt(get("month"), 10);
  const d = parseInt(get("day"), 10);
  const dow = weekdayMap[get("weekday")] ?? 1;

  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const base = Date.UTC(y, m - 1, d);
  const monday = new Date(base + diffToMonday * 86400000);
  return monday.toISOString().slice(0, 10);
}

export function currentWeekStart(): string {
  return mondayOfWeek(new Date());
}

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
