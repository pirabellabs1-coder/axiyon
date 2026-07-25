/**
 * Minimal 5-field cron evaluator (UTC).
 *
 *   minute hour day-of-month month day-of-week
 *
 * Supports `*`, `N`, `a,b,c`, `a-b`, `*&#47;n` and `a-b/n` in every field.
 * Day-of-week accepts 0-7 with both 0 and 7 meaning Sunday.
 *
 * Why hand-rolled rather than a dependency: the sweeper only needs "did an
 * occurrence fall in this window", the grammar above covers every schedule the
 * UI can produce, and this keeps a cold-start-sensitive cron route free of an
 * extra module.
 *
 * Deliberately no timezone support — everything is UTC. A DST-aware scheduler
 * has to decide what to do with wall-clock times that occur twice or not at
 * all, and getting that subtly wrong silently double-fires or skips a
 * customer's automation. UTC is predictable; per-org timezones can come later
 * as an explicit feature.
 */

const FIELD_RANGES: Array<{ min: number; max: number }> = [
  { min: 0, max: 59 }, // minute
  { min: 0, max: 23 }, // hour
  { min: 1, max: 31 }, // day of month
  { min: 1, max: 12 }, // month
  { min: 0, max: 7 }, // day of week (0 and 7 are both Sunday)
];

/** How far back the sweeper will look for a missed occurrence. */
export const MAX_CATCHUP_MS = 26 * 60 * 60 * 1000;

export class InvalidCronError extends Error {}

/**
 * Expands one cron field into the exact set of values it matches.
 * Throws InvalidCronError on anything the grammar above doesn't cover.
 */
function expandField(raw: string, index: number): Set<number> {
  const { min, max } = FIELD_RANGES[index];
  const out = new Set<number>();

  for (const part of raw.split(",")) {
    if (part === "") throw new InvalidCronError(`Empty value in field ${index + 1}`);

    const [spec, stepRaw, ...rest] = part.split("/");
    if (rest.length) throw new InvalidCronError(`Multiple steps in "${part}"`);

    let step = 1;
    if (stepRaw !== undefined) {
      step = Number(stepRaw);
      if (!Number.isInteger(step) || step < 1) {
        throw new InvalidCronError(`Invalid step "${stepRaw}" in "${part}"`);
      }
    }

    let lo: number;
    let hi: number;
    if (spec === "*") {
      lo = min;
      hi = max;
    } else if (spec.includes("-")) {
      const [a, b, ...extra] = spec.split("-");
      if (extra.length) throw new InvalidCronError(`Invalid range "${spec}"`);
      lo = Number(a);
      hi = Number(b);
      if (!Number.isInteger(lo) || !Number.isInteger(hi)) {
        throw new InvalidCronError(`Non-numeric range "${spec}"`);
      }
      if (lo > hi) throw new InvalidCronError(`Descending range "${spec}"`);
    } else {
      lo = Number(spec);
      hi = lo;
      if (!Number.isInteger(lo)) throw new InvalidCronError(`Non-numeric value "${spec}"`);
    }

    if (lo < min || hi > max) {
      throw new InvalidCronError(`"${spec}" out of range ${min}-${max} in field ${index + 1}`);
    }

    for (let v = lo; v <= hi; v += step) out.add(v);
  }

  // Normalise Sunday so a schedule written as 7 matches Date#getUTCDay()'s 0.
  if (index === 4 && out.has(7)) out.add(0);
  return out;
}

export interface ParsedCron {
  minute: Set<number>;
  hour: Set<number>;
  dayOfMonth: Set<number>;
  month: Set<number>;
  dayOfWeek: Set<number>;
  /** True when the field was a bare `*`, which changes day matching (see matchesAt). */
  domRestricted: boolean;
  dowRestricted: boolean;
}

export function parseCron(expr: string): ParsedCron {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new InvalidCronError(
      `Expected 5 fields (minute hour day-of-month month day-of-week), got ${fields.length}`,
    );
  }
  return {
    minute: expandField(fields[0], 0),
    hour: expandField(fields[1], 1),
    dayOfMonth: expandField(fields[2], 2),
    month: expandField(fields[3], 3),
    dayOfWeek: expandField(fields[4], 4),
    domRestricted: fields[2] !== "*",
    dowRestricted: fields[4] !== "*",
  };
}

/** True when `expr` is a schedule this evaluator can run. */
export function isValidCron(expr: string): boolean {
  try {
    parseCron(expr);
    return true;
  } catch {
    return false;
  }
}

/**
 * Does the schedule fire at this exact minute (UTC)?
 *
 * Follows the POSIX quirk for the two day fields: when BOTH day-of-month and
 * day-of-week are restricted the match is a UNION, not an intersection. So
 * `0 0 1 * 1` means "the 1st of the month OR any Monday" — not "Mondays that
 * fall on the 1st". Treating it as an intersection is the classic bug here and
 * makes such schedules almost never fire.
 */
export function matchesAt(cron: ParsedCron, date: Date): boolean {
  if (!cron.minute.has(date.getUTCMinutes())) return false;
  if (!cron.hour.has(date.getUTCHours())) return false;
  if (!cron.month.has(date.getUTCMonth() + 1)) return false;

  const domHit = cron.dayOfMonth.has(date.getUTCDate());
  const dowHit = cron.dayOfWeek.has(date.getUTCDay());

  if (cron.domRestricted && cron.dowRestricted) return domHit || dowHit;
  if (cron.domRestricted) return domHit;
  if (cron.dowRestricted) return dowHit;
  return true;
}

/**
 * Did an occurrence fall in the window (since, now]?
 *
 * The sweeper cannot rely on being invoked on the exact scheduled minute — it
 * runs on Vercel's cron cadence, which is coarser than most schedules and
 * jittered. Matching only "is it due right now" would therefore miss almost
 * every occurrence. Scanning the window since the last successful run instead
 * makes firing independent of sweeper cadence, and recovers a schedule missed
 * because a deploy or outage skipped a tick.
 *
 * `since` is exclusive so an occurrence never fires twice; `now` is inclusive
 * so one landing exactly on this minute is not deferred. Returns the most
 * recent matching occurrence, or null.
 */
export function lastOccurrenceSince(
  expr: string,
  since: Date | null,
  now: Date = new Date(),
): Date | null {
  const cron = parseCron(expr);

  // Truncate to the minute: cron has no sub-minute resolution, and comparing
  // with seconds attached would let an occurrence match twice within a minute.
  const cursor = new Date(now);
  cursor.setUTCSeconds(0, 0);

  const floor = new Date(Math.max(since?.getTime() ?? 0, now.getTime() - MAX_CATCHUP_MS));

  let latest: Date | null = null;
  while (cursor.getTime() > floor.getTime()) {
    if (matchesAt(cron, cursor)) {
      latest = new Date(cursor);
      break;
    }
    cursor.setUTCMinutes(cursor.getUTCMinutes() - 1);
  }
  return latest;
}

/** Human-readable summary for the UI. Falls back to the raw expression. */
export function describeCron(expr: string): string {
  const known: Record<string, string> = {
    "* * * * *": "chaque minute",
    "*/5 * * * *": "toutes les 5 minutes",
    "*/15 * * * *": "tous les quarts d'heure",
    "*/30 * * * *": "toutes les 30 minutes",
    "0 * * * *": "chaque heure",
    "0 0 * * *": "chaque jour à minuit (UTC)",
    "0 6 * * *": "chaque jour à 6 h (UTC)",
    "0 8 * * *": "chaque jour à 8 h (UTC)",
    "0 8 * * 1-5": "du lundi au vendredi à 8 h (UTC)",
    "0 9 * * 1": "chaque lundi à 9 h (UTC)",
    "0 0 1 * *": "le 1er de chaque mois",
  };
  return known[expr.trim()] ?? expr.trim();
}
