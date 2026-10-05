import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { splitSessionByDay, workSecondsForDate } from "@/lib/time";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role === "asisten") {
      return NextResponse.json(
        { error: "Hanya PIC dan Admin yang bisa melihat rekap" },
        { status: 403 }
      );
    }

    await initDB();
    const sql = getSql();
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("event_id");

    let query = `
      SELECT a.employee_id, a.employee_name, a.division, a.event_id,
             a.clock_in, a.clock_out, a.date AS att_date,
             e.name AS event_name, e.event_date
      FROM attendance a
      JOIN events e ON e.id = a.event_id
      WHERE 1=1
    `;
    const args: string[] = [];

    if (session.role !== "admin") {
      args.push(String(session.userId));
      query += ` AND e.user_id = $${args.length}`;
    }
    if (eventId) {
      args.push(eventId);
      query += ` AND a.event_id = $${args.length}`;
    }

    // Urutkan per id agar penentuan “sesi pertama tanggal” deterministik
    query += ` ORDER BY a.id ASC`;

    const rows = await sql.query(query, args);

    const perUser = new Map<
      string,
      {
        employee_id: string;
        employee_name: string;
        division: string;
        events: Map<number, { event_id: number; event_name: string; event_date: string; clock_ins: number; clock_outs: number; work_seconds: number; overtime_seconds: number }>;
        work_seconds: number;
        overtime_seconds: number;
        /** Tanggal → jam kerja yang sudah terpakai (dibatasi window hari). */
        work_dates: Map<string, number>;
        active_count: number;
      }
    >();

    for (const r of rows) {
      const key = r.employee_id || r.employee_name;
      if (!key) continue;
      if (!perUser.has(key)) {
        perUser.set(key, {
          employee_id: r.employee_id,
          employee_name: r.employee_name,
          division: r.division || "",
          events: new Map(),
          work_seconds: 0,
          overtime_seconds: 0,
          work_dates: new Map<string, number>(),
          active_count: 0,
        });
      }
      const userAgg = perUser.get(key)!;
      if (r.division && !userAgg.division) userAgg.division = r.division;

      const dateKey = String(r.att_date || r.event_date || "");
      // Sesi dipecah per tanggal: jam di dalam window kerja (Sen–Jumat
      // 08.00–17.00, Sabtu 08.00–12.00) dihitung kerja, sisanya lembur.
      // Sesi lewat tengah malam memakai aturan tanggal masing-masing.
      const parts = splitSessionByDay(dateKey, r.clock_in, r.clock_out);
      if (!r.clock_out) userAgg.active_count += 1;

      if (!userAgg.events.has(r.event_id)) {
        userAgg.events.set(r.event_id, {
          event_id: r.event_id,
          event_name: r.event_name,
          event_date: r.event_date,
          clock_ins: 0,
          clock_outs: 0,
          work_seconds: 0,
          overtime_seconds: 0,
        });
      }
      const evAgg = userAgg.events.get(r.event_id)!;
      evAgg.clock_ins += 1;
      if (r.clock_out) evAgg.clock_outs += 1;

      for (const part of parts) {
        // Lembur selalu utuh per tanggal — boleh menumpuk antar sesi.
        userAgg.overtime_seconds += part.overtime_seconds;
        evAgg.overtime_seconds += part.overtime_seconds;

        // Jam kerja dibatasi 1× window kerja per tanggal per karyawan.
        // Kalau 1 hari ada 2 sesi (atau 2 event), jam kerja yang tidak
        // termuat dalam window hari itu otomatis jatuh ke lembur.
        const used = userAgg.work_dates.get(part.date) ?? 0;
        const room = workSecondsForDate(part.date) - used;
        const work = Math.min(part.work_seconds, Math.max(0, room));
        if (work > 0) {
          userAgg.work_dates.set(part.date, used + work);
          userAgg.work_seconds += work;
          evAgg.work_seconds += work;
        }
      }
    }

    const data = Array.from(perUser.values()).map((u) => ({
      employee_id: u.employee_id,
      employee_name: u.employee_name,
      division: u.division,
      event_count: u.events.size,
      total_seconds: u.work_seconds + u.overtime_seconds,
      work_seconds: u.work_seconds,
      overtime_seconds: u.overtime_seconds,
      active_count: u.active_count,
      events: Array.from(u.events.values()).map((e) => ({
        event_id: e.event_id,
        event_name: e.event_name,
        event_date: e.event_date,
        clock_ins: e.clock_ins,
        clock_outs: e.clock_outs,
        seconds: e.work_seconds + e.overtime_seconds,
        work_seconds: e.work_seconds,
        overtime_seconds: e.overtime_seconds,
      })),
    }));

    data.sort(
      (a, b) => b.total_seconds - a.total_seconds || a.employee_name.localeCompare(b.employee_name)
    );

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Summary error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil rekap" },
      { status: 500 }
    );
  }
}