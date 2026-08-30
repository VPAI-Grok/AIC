/**
 * Validate the RFC 3339 date-time profile used by AIC artifacts.
 *
 * This deliberately validates calendar fields before relying on Date.parse,
 * which normalizes impossible values such as February 31 in some runtimes.
 * Leap seconds are excluded because JavaScript Date cannot represent them and
 * AIC compares these values as concrete instants.
 */
const AIC_RFC3339_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([Zz]|[+-](\d{2}):(\d{2}))$/;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isAICRfc3339DateTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = AIC_RFC3339_DATE_TIME.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[9] === undefined ? 0 : Number(match[9]);
  const offsetMinute = match[10] === undefined ? 0 : Number(match[10]);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;
  if (offsetHour > 23 || offsetMinute > 59) return false;

  return Number.isFinite(Date.parse(value));
}

export function parseAICRfc3339DateTime(value: unknown): number | undefined {
  return isAICRfc3339DateTime(value) ? Date.parse(value) : undefined;
}
