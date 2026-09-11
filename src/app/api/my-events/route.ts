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
    const today = new Date().toLocaleDateString("sv-SE", {
      timeZone: "Asia/Jakarta",
    });

    const rows = await sql.query(
      `SELECT e.id, e.name, e.event_date, e.location, e.description,
              a.id AS attendance_id, a.clock_in, a.clock_out, a.division, a.task,
              CASE WHEN a.id IS NULL THEN 0 ELSE 1 END AS has_attendance,
              CASE WHEN a.clock_out IS NULL AND a.id IS NOT NULL THEN 1 ELSE 0 END AS is_active
       FROM user_events ue
       JOIN events e ON e.id = ue.event_id
       LEFT JOIN attendance a
         ON a.event_id = e.id AND a.user_id = $1 AND a.date = $2
       WHERE ue.user_id = $1
       ORDER BY e.event_date DESC, e.created_at DESC`,
      [session.userId, today]
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("My events error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data" },
      { status: 500 }
    );
  }
}