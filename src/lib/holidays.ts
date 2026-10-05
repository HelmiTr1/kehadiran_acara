/**
 * Daftar tanggal merah (Hari Libur Nasional Indonesia).
 *
 * Sumber resmi: Surat Keputusan Bersama (SKB) 3 Menteri
 * - 2025: SKB No. 1017/2/2 Tahun 2024 (14 Oktober 2024) — 17 hari libur nasional
 * - 2026: SKB Tahun 2025 (19 September 2025) — 17 hari libur nasional
 * - 2027: SKB No. 1205/3/2 Tahun 2026 (15 September 2026) — 18 hari libur nasional
 *
 * Format: "YYYY-MM-DD" (menyesuaikan kolom `attendance.date` dan `events.event_date`).
 * Tambahkan tanggal baru di sini bila pemerintah mengeluarkan SKB terbaru
 * (misal tanggal hijriah yang berubah), atau bila ingin memasukkan hari
 * cuti bersama — cukup tambahkan tanggalnya ke daftar di bawah.
 */
export const NATIONAL_HOLIDAYS = new Set<string>([
  // ── 2025 ──────────────────────────────────────────────
  "2025-01-01", // Tahun Baru 2025 Masehi
  "2025-01-27", // Isra Mikraj Nabi Muhammad S.A.W.
  "2025-01-29", // Tahun Baru Imlek 2576 Kongzili
  "2025-03-29", // Hari Suci Nyepi (Tahun Baru Saka 1947)
  "2025-03-31", // Idulfitri 1446 Hijriah
  "2025-04-01", // Idulfitri 1446 Hijriah
  "2025-04-18", // Wafat Yesus Kristus
  "2025-04-20", // Kebangkitan Yesus Kristus (Paskah)
  "2025-05-01", // Hari Buruh Internasional
  "2025-05-12", // Hari Raya Waisak 2569 BE
  "2025-05-29", // Kenaikan Yesus Kristus
  "2025-06-01", // Hari Lahir Pancasila
  "2025-06-06", // Iduladha 1446 Hijriah
  "2025-06-27", // 1 Muharam Tahun Baru Islam 1447 Hijriah
  "2025-08-17", // Proklamasi Kemerdekaan RI
  "2025-09-05", // Maulid Nabi Muhammad S.A.W.
  "2025-12-25", // Kelahiran Yesus Kristus (Natal)

  // ── 2026 ──────────────────────────────────────────────
  "2026-01-01", // Tahun Baru 2026 Masehi
  "2026-01-16", // Isra Mikraj Nabi Muhammad S.A.W.
  "2026-02-17", // Tahun Baru Imlek 2577 Kongzili
  "2026-03-19", // Hari Suci Nyepi (Tahun Baru Saka 1948)
  "2026-03-21", // Idulfitri 1447 Hijriah
  "2026-03-22", // Idulfitri 1447 Hijriah
  "2026-04-03", // Wafat Yesus Kristus
  "2026-04-05", // Kebangkitan Yesus Kristus (Paskah)
  "2026-05-01", // Hari Buruh Internasional
  "2026-05-14", // Kenaikan Yesus Kristus
  "2026-05-27", // Iduladha 1447 Hijriah
  "2026-05-31", // Hari Raya Waisak 2570 BE
  "2026-06-01", // Hari Lahir Pancasila
  "2026-06-16", // 1 Muharam Tahun Baru Islam 1448 Hijriah
  "2026-08-17", // Proklamasi Kemerdekaan RI
  "2026-08-25", // Maulid Nabi Muhammad S.A.W.
  "2026-12-25", // Kelahiran Yesus Kristus (Natal)

  // ── 2027 ──────────────────────────────────────────────
  "2027-01-01", // Tahun Baru 2027 Masehi
  "2027-01-05", // Isra Mikraj Nabi Muhammad S.A.W.
  "2027-02-06", // Tahun Baru Imlek 2578 Kongzili
  "2027-03-08", // Hari Suci Nyepi (Tahun Baru Saka 1949)
  "2027-03-10", // Idulfitri 1448 Hijriah
  "2027-03-11", // Idulfitri 1448 Hijriah
  "2027-03-26", // Wafat Yesus Kristus
  "2027-03-28", // Hari Kebangkitan Yesus Kristus (Paskah)
  "2027-05-01", // Hari Buruh Internasional
  "2027-05-06", // Kenaikan Yesus Kristus
  "2027-05-17", // Iduladha 1448 Hijriah
  "2027-05-20", // Hari Raya Waisak 2571 BE
  "2027-06-01", // Hari Lahir Pancasila
  "2027-06-06", // 1 Muharam Tahun Baru Islam 1449 Hijriah
  "2027-08-15", // Maulid Nabi Muhammad S.A.W.
  "2027-08-17", // Proklamasi Kemerdekaan RI
  "2027-12-25", // Kelahiran Yesus Kristus (Natal)
  "2027-12-26", // Isra Mikraj Nabi Muhammad S.A.W.
]);

export function isNationalHoliday(date: string | null | undefined): boolean {
  if (!date) return false;
  return NATIONAL_HOLIDAYS.has(date.trim().slice(0, 10));
}
