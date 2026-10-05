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
 * Lama maksimum window kerja hari itu (detik):
 * weekday 08.00–17.00 (9 jam), Sabtu 08.00–12.00 (4 jam), libur 0.
 */
export function workSecondsForDay(kind: DayKind): number {
  if (kind === "holiday") return 0;
  const end =
    kind === "saturday"
      ? SATURDAY_OVERTIME_START_SEC
      : WEEKDAY_OVERTIME_START_SEC;
  return end - WORK_START_SEC;
}

/** Awal window kerja (detik dari tengah malam) untuk jenis hari. */
function workWindowStartSec(kind: DayKind): number {
  return kind === "holiday" ? 0 : WORK_START_SEC;
}

/** Panjang maksimum window kerja (detik) pada tanggal tertentu. */
export function workSecondsForDate(date: string | null | undefined): number {
  return workSecondsForDay(getDayKind(date));
}

function normalizeDate(date: string | null | undefined): string {
  const d = (date || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
}

function addDays(date: string, days: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms)) return date;
  return new Date(ms + days * DAY_SECONDS * 1000).toISOString().slice(0, 10);
}

/** Batas tengah malam berikutnya dari posisi absolut `cursor` (detik). */
function nextMidnight(cursor: number): number {
  return (Math.floor(cursor / DAY_SECONDS) + 1) * DAY_SECONDS;
}

/** Bagian satu sesi yang jatuh pada satu tanggal kalender. */
export type DaySplit = {
  date: string;
  work_seconds: number;
  overtime_seconds: number;
};

/**
 * Pecah 1 sesi check-in → check-out menjadi jam kerja + lembur per tanggal.
 *
 * Sesi dipecah pada setiap pergantian tanggal, lalu tiap bagian dibandingkan
 * dengan window kerja hari itu:
 * - weekday 08.00–17.00 → jam di dalam window = kerja, sisanya = lembur
 * - Sabtu    08.00–12.00 → jam di dalam window = kerja, sisanya = lembur
 * - libur / Minggu      → seluruh durasi = lembur
 *
 * Jadi 1 hari dengan 2 sesi (mis. 08.00–12.00 dan 13.00–19.00) dijumlahkan
 * penuh: 8 jam kerja + 2 jam lembur. Sesi yang lewat tengah malam memakai
 * aturan tanggal masing-masing, bukan aturan tanggal check-in.
 * Check-out belum ada → array kosong (belum bisa dihitung).
 */
export function splitSessionByDay(
  date: string | null | undefined,
  clockIn: string | null | undefined,
  clockOut: string | null | undefined
): DaySplit[] {
  const inSec = parseClockTime(clockIn);
  const outSec = parseClockTime(clockOut);
  if (inSec === null || outSec === null) return [];
  const end = outSec < inSec ? outSec + DAY_SECONDS : outSec;
  const duration = end - inSec;
  if (duration <= 0 || duration > DAY_SECONDS) return [];

  const base = normalizeDate(date);
  const result: DaySplit[] = [];
  let cursor = inSec;
  let day = base;

  // Durasi dibatasi 24 jam → paling banyak dua iterasi.
  for (let i = 0; i < 3 && cursor < end; i++) {
    const kind = getDayKind(day);
    const segEnd = Math.min(end, nextMidnight(cursor));
    const segSeconds = segEnd - cursor;

    const winStart = workWindowStartSec(kind);
    const winEnd = winStart + workSecondsForDay(kind);
    const work = Math.max(
      0,
      Math.min(segEnd, winEnd) - Math.max(cursor, winStart)
    );

    result.push({
      date: day,
      work_seconds: work,
      overtime_seconds: segSeconds - work,
    });

    cursor = segEnd;
    day = addDays(day, 1);
  }
  return result;
}

export type AttendanceSplit = {
  work_seconds: number;
  overtime_seconds: number;
  total_seconds: number;
};

/** Pemisahan 1 record kehadiran menjadi jam kerja + lembur (semua tanggal). */
export function splitAttendanceSeconds(
  date: string | null | undefined,
  clockIn: string | null | undefined,
  clockOut: string | null | undefined
): AttendanceSplit {
  const parts = splitSessionByDay(date, clockIn, clockOut);
  const work_seconds = parts.reduce((sum, p) => sum + p.work_seconds, 0);
  const overtime_seconds = parts.reduce((sum, p) => sum + p.overtime_seconds, 0);
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