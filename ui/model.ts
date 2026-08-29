export const HABIT_TYPE_KEY = "habit.item";
export const COLORS = ["sun", "leaf", "sky", "berry", "violet", "stone"] as const;
export type HabitColor = typeof COLORS[number];
export type HabitData = {
  title: string;
  note: string;
  color: HabitColor;
  schedule: string;
  completions: string;
  createdAt: string;
  updatedAt: string;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export const cleanText = (value: unknown, max: number) => String(value ?? "").replace(/[<>]/g, "").trim().slice(0, max);
export const todayKey = (now = new Date()) => {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
export const addDays = (date: string, offset: number) => {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + offset);
  return todayKey(value);
};
export const weekday = (date: string) => new Date(`${date}T12:00:00`).getDay();

export function parseSchedule(value: unknown): number[] {
  try {
    const parsed = JSON.parse(String(value));
    if (!Array.isArray(parsed)) return [0, 1, 2, 3, 4, 5, 6];
    const unique = [...new Set(parsed.filter((item) => Number.isInteger(item) && item >= 0 && item <= 6))].sort();
    return unique.length ? unique : [0, 1, 2, 3, 4, 5, 6];
  } catch { return [0, 1, 2, 3, 4, 5, 6]; }
}

export function parseCompletions(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value));
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((item) => typeof item === "string" && datePattern.test(item)))].sort();
  } catch { return []; }
}

export function createHabit(input: { title: string; note: string; color: HabitColor; schedule: number[] }, now = new Date()): HabitData {
  const timestamp = now.toISOString();
  return {
    title: cleanText(input.title, 120) || "Untitled habit",
    note: cleanText(input.note, 2000),
    color: COLORS.includes(input.color) ? input.color : "sun",
    schedule: JSON.stringify([...new Set(input.schedule)].sort()),
    completions: "[]",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function sanitizeHabit(value: unknown): HabitData {
  const source = (value && typeof value === "object" ? value : {}) as Partial<HabitData>;
  const createdAt = Number.isFinite(Date.parse(String(source.createdAt))) ? String(source.createdAt) : new Date().toISOString();
  return {
    title: cleanText(source.title, 120) || "Untitled habit",
    note: cleanText(source.note, 2000),
    color: COLORS.includes(source.color as HabitColor) ? source.color as HabitColor : "sun",
    schedule: JSON.stringify(parseSchedule(source.schedule)),
    completions: JSON.stringify(parseCompletions(source.completions).slice(-3000)),
    createdAt,
    updatedAt: Number.isFinite(Date.parse(String(source.updatedAt))) ? String(source.updatedAt) : createdAt,
  };
}

export function toggleCompletion(habit: HabitData, date: string): HabitData {
  if (!datePattern.test(date)) return habit;
  const dates = new Set(parseCompletions(habit.completions));
  if (dates.has(date)) dates.delete(date); else dates.add(date);
  return { ...habit, completions: JSON.stringify([...dates].sort().slice(-3000)), updatedAt: new Date().toISOString() };
}

export function isScheduled(habit: HabitData, date: string) {
  return parseSchedule(habit.schedule).includes(weekday(date));
}

export function streaks(habit: HabitData, today = todayKey()) {
  const completed = new Set(parseCompletions(habit.completions));
  let current = 0;
  let cursor = today;
  if (isScheduled(habit, cursor) && !completed.has(cursor)) cursor = addDays(cursor, -1);
  for (let guard = 0; guard < 3660; guard += 1) {
    if (!isScheduled(habit, cursor)) { cursor = addDays(cursor, -1); continue; }
    if (!completed.has(cursor)) break;
    current += 1;
    cursor = addDays(cursor, -1);
  }
  let best = 0;
  let run = 0;
  const dates = [...completed].sort();
  for (let index = 0; index < dates.length; index += 1) {
    const date = dates[index]!;
    if (!isScheduled(habit, date)) continue;
    if (!run) run = 1;
    else {
      let expected = addDays(dates[index - 1]!, 1);
      while (!isScheduled(habit, expected) && expected < date) expected = addDays(expected, 1);
      run = expected === date ? run + 1 : 1;
    }
    best = Math.max(best, run);
  }
  return { current, best };
}

export function recentDates(days: number, today = todayKey()) {
  return Array.from({ length: days }, (_, index) => addDays(today, index - days + 1));
}
