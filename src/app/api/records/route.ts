import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await initDB();
    const sql = getSql();
    const { searchParams } = new URL(req.url);
    const event_id = searchParams.get("event_id");
    const employee_id = searchParams.get("employee_id");

    let query = `
      SELECT a.*, e.name AS event_name, e.event_date, u.name AS pic_name
      FROM attendance a
      JOIN events e ON e.id = a.event_id
      JOIN users u ON u.id = e.user_id
      WHERE 1=1
    `;
    const args: string[] = [];

    if (session.role !== "admin") {
      if (session.role === "asisten") {
        args.push(String(session.userId));
        query += ` AND (
          e.user_id = $${args.length}
          OR e.user_id IN (
            SELECT pic_user_id FROM pic_assistants WHERE assistant_user_id = $${args.length}
          )
        )`;
      } else if (session.role === "pic") {
        args.push(String(session.userId));
        query += ` AND e.user_id = $${args.length}`;
      } else {
        args.push(session.username);
        query += ` AND a.employee_id = $${args.length}`;
      }
    }

    if (event_id) {
      args.push(event_id);
      query += ` AND a.event_id = $${args.length}`;
    }
    if (employee_id) {
      args.push(employee_id);
      query += ` AND a.employee_id = $${args.length}`;
    }

    query += " ORDER BY a.id DESC";

    const result = await sql.query(query, args);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Get records error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data" },
      { status: 500 }
    );
  }
}