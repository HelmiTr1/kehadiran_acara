import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

function durationSeconds(clockIn: string, clockOut: string | null) {
  if (!clockOut) return 0;
  const [inH, inM, inS] = clockIn.split(":").map(Number);
  const [outH, outM, outS] = clockOut.split(":").map(Number);
  const clockedIn = inH * 3600 + inM * 60 + (inS || 0);
  const clockedOut = outH * 3600 + outM * 60 + (outS || 0);
  const crossed = clockedOut < clockedIn;
  const diff =
    clockedOut - clockedIn + (crossed ? 24 * 3600 : 0);
  return diff > 0 && diff <= 24 * 3600 ? diff : 0;
}

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
             a.clock_in, a.clock_out, e.name AS event_name, e.event_date
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

    const rows = await sql.query(query, args);

    const perUser = new Map<
      string,
      {
        employee_id: string;
        employee_name: string;
        division: string;
        events: Map<number, { event_id: number; event_name: string; event_date: string; clock_ins: number; clock_outs: number; seconds: number }>;
        total_seconds: number;
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
          total_seconds: 0,
          active_count: 0,
        });
      }
      const userAgg = perUser.get(key)!;
      if (r.division && !userAgg.division) userAgg.division = r.division;

      const seconds = durationSeconds(r.clock_in, r.clock_out);
      userAgg.total_seconds += seconds;
      if (!r.clock_out) userAgg.active_count += 1;

      if (!userAgg.events.has(r.event_id)) {
        userAgg.events.set(r.event_id, {
          event_id: r.event_id,
          event_name: r.event_name,
          event_date: r.event_date,
          clock_ins: 0,
          clock_outs: 0,
          seconds: 0,
        });
      }
      const evAgg = userAgg.events.get(r.event_id)!;
      evAgg.clock_ins += 1;
      if (r.clock_out) evAgg.clock_outs += 1;
      evAgg.seconds += seconds;
    }

    const data = Array.from(perUser.values()).map((u) => ({
      employee_id: u.employee_id,
      employee_name: u.employee_name,
      division: u.division,
      event_count: u.events.size,
      total_seconds: u.total_seconds,
      active_count: u.active_count,
      events: Array.from(u.events.values()).map((e) => ({
        event_id: e.event_id,
        event_name: e.event_name,
        event_date: e.event_date,
        clock_ins: e.clock_ins,
        clock_outs: e.clock_outs,
        seconds: e.seconds,
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