const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

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