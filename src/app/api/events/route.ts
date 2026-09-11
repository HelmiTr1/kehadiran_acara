import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initDB();
  const sql = getSql();

  let rows;
  if (session.role === "admin") {
    rows = await sql.query(`
      SELECT e.*, t.token, u.name AS pic_name
      FROM events e
      LEFT JOIN tokens t ON t.event_id = e.id
      LEFT JOIN users u ON u.id = e.user_id
      ORDER BY e.created_at DESC
    `);
  } else {
    rows = await sql.query(
      `SELECT e.*, t.token, u.name AS pic_name
       FROM events e
       LEFT JOIN tokens t ON t.event_id = e.id
       LEFT JOIN users u ON u.id = e.user_id
       WHERE e.user_id = $1
       ORDER BY e.created_at DESC`,
      [session.userId]
    );
  }

  return NextResponse.json({ success: true, data: rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initDB();
  const sql = getSql();
  const { name, event_date, location, description } = await req.json();

  if (!name || !event_date) {
    return NextResponse.json(
      { error: "Nama dan tanggal wajib diisi" },
      { status: 400 }
    );
  }

  const result = await sql.query(
    `INSERT INTO events (user_id, name, event_date, location, description)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [session.userId, name, event_date, location || "", description || ""]
  );

  return NextResponse.json({ success: true, id: result[0].id });
}