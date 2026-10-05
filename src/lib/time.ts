import { isNationalHoliday } from "./holidays";

const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

const DAY_SECONDS = 24 * 3600;

/** Jam masuk kerja tetap (ketentuan rekap: jam 8). */
export const WORK_START_SEC = 8 * 3600;
/** Batas lembur weekday (Sen–Jumat): 17.00 ke atas. */
export const WEEKDAY_OVERTIME_START_SEC = 17 * 3600;
/** Batas lembur Sabtu: 12.00 ke atas. */
export const SATURDAY_OVERTIME_START_SEC = 12 * 3600;

export type DayKind = "weekday" | "saturday" | "holiday";

/**
 * Kelas hari berdasarkan tanggal (YYYY-MM-DD):
 * - "holiday"  → Minggu ATAU tanggal merah (libur nasional) → full lembur
 * - "saturday" → Sabtu → kerja 08.00–12.00, lembur 12.00 ke atas
 * - "weekday"  → Senin–Jumat → kerja 08.00–17.00, lembur 17.00 ke atas
 */
export function getDayKind(date: string | null | undefined): DayKind {
  const d = (date || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "weekday";
  if (isNationalHoliday(d)) return "holiday";
  const dow = new Date(`${d}T00:00:00Z`).getUTCDay(); // 0=Min … 6=Sab
  if (dow === 0) return "holiday";
  if (dow === 6) return "saturday";
  return "weekday";
}

/**
 * Jam kerja tidak dihitung dari check-in/check-out (tetap sesuai ketentuan):
 * weekday 08.00–17.00 (9 jam), Sabtu 08.00–12.00 (4 jam), libur 0.
 */
export function workSecondsForDay(kind: DayKind): number {
  if (kind === "holiday") return 0;
  // 08.00 (jam masuk tetap) sampai batas lembur hari itu
  const end =
    kind === "saturday"
      ? SATURDAY_OVERTIME_START_SEC
      : WEEKDAY_OVERTIME_START_SEC;
  return end - WORK_START_SEC;
}

/**
 * Lembur dihitung dari check-in/check-out aktual:
 * - weekday  → dari max(check-in, 17.00) sampai check-out
 * - Sabtu    → dari max(check-in, 12.00) sampai check-out
 * - libur    → seluruh durasi check-in → check-out (full lembur)
 * Check-out belum ada → 0 (belum bisa dihitung).
 */
export function overtimeSecondsForDay(
  kind: DayKind,
  clockIn: string | null | undefined,
  clockOut: string | null | undefined
): number {
  const inSec = parseClockTime(clockIn);
  const outSec = parseClockTime(clockOut);
  if (inSec === null || outSec === null) return 0;
  let end = outSec;
  if (end < inSec) end += DAY_SECONDS; // lewat tengah malam
  if (kind === "holiday") return end - inSec;
  const threshold =
    kind === "saturday"
      ? SATURDAY_OVERTIME_START_SEC
      : WEEKDAY_OVERTIME_START_SEC;
  return Math.max(0, end - Math.max(inSec, threshold));
}

export type AttendanceSplit = {
  work_seconds: number;
  overtime_seconds: number;
  total_seconds: number;
};

/** Pemisahan 1 record kehadiran menjadi jam kerja + lembur. */
export function splitAttendanceSeconds(
  date: string | null | undefined,
  clockIn: string | null | undefined,
  clockOut: string | null | undefined
): AttendanceSplit {
  const kind = getDayKind(date);
  const work_seconds = workSecondsForDay(kind);
  const overtime_seconds = overtimeSecondsForDay(kind, clockIn, clockOut);
  return {
    work_seconds,
    overtime_seconds,
    total_seconds: work_seconds + overtime_seconds,
  };
}

export function parseClockTime(time: string | null | undefined): number | null {
  if (!time) return null;
  const m = TIME_RE.exec(time.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const s = Number(m[3] || 0);
  if (h > 23 || min > 59 || s > 59) return null;
  return h * 3600 + min * 60 + s;
}

export function normalizeTime(time: string | null | undefined): string {
  if (!time) return "";
  const t = time.trim();
  if (TIME_RE.test(t)) return t.length === 5 ? `${t}:00` : t;
  return t;
}

export function durationSeconds(
  clockIn: string | null,
  clockOut: string | null
): number {
  const inSec = parseClockTime(clockIn);
  const outSec = parseClockTime(clockOut);
  if (inSec === null || outSec === null) return 0;
  const diff = outSec - inSec + (outSec < inSec ? 24 * 3600 : 0);
  return diff > 0 && diff <= 24 * 3600 ? diff : 0;
}