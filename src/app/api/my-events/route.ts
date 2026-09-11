import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await initDB();
    const sql = getSql();

    const rows = await sql.query(
      `SELECT e.id, e.name, e.event_date, e.location, e.description,
              d.name AS division_name,
              COALESCE(
                (SELECT json_agg(json_build_object(
                  'attendance_id', a.id,
                  'clock_in', a.clock_in,
                  'clock_out', a.clock_out,
                  'division', a.division,
                  'task', a.task,
                  'date', a.date
                ) ORDER BY a.id DESC)
                FROM attendance a
                WHERE a.event_id = e.id AND a.user_id = $1),
                '[]'::json
              ) AS sessions
       FROM user_events ue
       JOIN events e ON e.id = ue.event_id
       LEFT JOIN divisions d ON d.id = e.division_id
       WHERE ue.user_id = $1
       ORDER BY e.event_date DESC, e.created_at DESC`,
      [session.userId]
    );

    const data = rows.map((row) => {
      const sessions = (row.sessions as any[]) ?? [];
      const latest = sessions[0] ?? null;
      return {
        id: row.id,
        name: row.name,
        event_date: row.event_date,
        location: row.location,
        description: row.description,
        division_name: row.division_name,
        sessions,
        has_attendance: sessions.length > 0 ? 1 : 0,
        is_active:
          latest && !latest.clock_out ? 1 : 0,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("My events error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data" },
      { status: 500 }
    );
  }
}