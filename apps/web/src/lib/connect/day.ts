import { isoInZone } from "@/lib/dates";

/** The zone's offset from UTC at a moment, in milliseconds, read from a wall-clock string like "2026-11-02T20:30:00+05:30". */
function offsetMs(date: Date, timeZone: string): number {
  const match = /([+-])(\d{2}):(\d{2})$/.exec(isoInZone(date, timeZone));
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3])) * 60_000;
}

/**
 * Midnight at the start of `now`'s calendar day in `timeZone`, as a moment.
 * Offsets can change during a day (clocks changing), so the offset is read at
 * the start of the day itself, not at `now`.
 */
export function startOfDay(now: Date, timeZone: string): Date {
  const day = isoInZone(now, timeZone).slice(0, 10);
  const wallMidnightAsUtc = Date.parse(`${day}T00:00:00Z`);
  // First guess with the offset now, then again with the offset at that guess.
  let start = wallMidnightAsUtc - offsetMs(now, timeZone);
  start = wallMidnightAsUtc - offsetMs(new Date(start), timeZone);
  return new Date(start);
}
