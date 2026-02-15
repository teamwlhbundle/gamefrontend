/**
 * Backend se aaya hua time (24h "HH:mm" ya Date) ko frontend pe AM/PM (12-hour) me dikhane ke liye.
 */

const HH_MM_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/**
 * "HH:mm" (24h) ko "h:mm AM/PM" me convert karta hai.
 * @param timeStr - "19:30" ya "07:00"
 * @returns "7:30 PM" ya "7:00 AM"
 */
export function formatTimeToAMPM(timeStr: string): string {
  if (!timeStr || typeof timeStr !== "string") return "";
  const trimmed = timeStr.trim();
  if (!HH_MM_REGEX.test(trimmed)) return timeStr;
  const [hStr, mStr] = trimmed.split(":");
  const h = parseInt(hStr!, 10);
  const m = parseInt(mStr!, 10);
  if (h === 0) return `12:${String(m).padStart(2, "0")} AM`;
  if (h === 12) return `12:${String(m).padStart(2, "0")} PM`;
  if (h < 12) return `${h}:${String(m).padStart(2, "0")} AM`;
  return `${h - 12}:${String(m).padStart(2, "0")} PM`;
}

/**
 * Date object ko "h:mm AM/PM" me format karta hai (local timezone).
 */
export function formatDateToAMPM(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const h = date.getHours();
  const m = date.getMinutes();
  if (h === 0) return `12:${String(m).padStart(2, "0")} AM`;
  if (h === 12) return `12:${String(m).padStart(2, "0")} PM`;
  if (h < 12) return `${h}:${String(m).padStart(2, "0")} AM`;
  return `${h - 12}:${String(m).padStart(2, "0")} PM`;
}
