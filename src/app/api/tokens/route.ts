import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initDB();
  const sql = getSql();
  const { event_id } = await req.json();

  if (!event_id) {
    return NextResponse.json(
      { error: "event_id wajib diisi" },
      { status: 400 }
    );
  }

  let event;
  if (session.role === "admin") {
    event = await sql.query("SELECT id FROM events WHERE id = $1", [event_id]);
  } else {
    event = await sql.query(
      "SELECT id FROM events WHERE id = $1 AND user_id = $2",
      [event_id, session.userId]
    );
  }

  if (event.length === 0) {
    return NextResponse.json(
      { error: "Event tidak ditemukan" },
      { status: 404 }
    );
  }

  const token = String(Math.floor(100000 + Math.random() * 900000));

  await sql.query(
    `INSERT INTO tokens (event_id, token)
     VALUES ($1, $2)
     ON CONFLICT (event_id) DO UPDATE
       SET token = $2, created_at = CURRENT_TIMESTAMP`,
    [event_id, token]
  );

  return NextResponse.json({ success: true, token });
}