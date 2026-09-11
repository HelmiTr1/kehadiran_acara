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
      SELECT e.*, t.token, t.expires_at, u.name AS pic_name, u.employee_id AS pic_employee_id,
             d.name AS division_name, d.id AS division_id
      FROM events e
      LEFT JOIN tokens t ON t.event_id = e.id
      LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN divisions d ON d.id = e.division_id
      ORDER BY e.created_at DESC
    `);
  } else if (session.role === "asisten") {
    rows = await sql.query(
      `SELECT e.*, t.token, t.expires_at, u.name AS pic_name, u.employee_id AS pic_employee_id,
              d.name AS division_name, d.id AS division_id
       FROM events e
       LEFT JOIN tokens t ON t.event_id = e.id
       LEFT JOIN users u ON u.id = e.user_id
       LEFT JOIN divisions d ON d.id = e.division_id
       WHERE e.user_id = $1
          OR e.user_id IN (
            SELECT pic_user_id FROM pic_assistants WHERE assistant_user_id = $1
          )
       ORDER BY e.created_at DESC`,
      [session.userId]
    );
  } else {
    rows = await sql.query(
      `SELECT e.*, t.token, t.expires_at, u.name AS pic_name, u.employee_id AS pic_employee_id,
              d.name AS division_name, d.id AS division_id
       FROM events e
       LEFT JOIN tokens t ON t.event_id = e.id
       LEFT JOIN users u ON u.id = e.user_id
       LEFT JOIN divisions d ON d.id = e.division_id
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
  if (session.role === "user") {
    return NextResponse.json(
      { error: "Hanya PIC / Asisten / Admin yang bisa membuat event" },
      { status: 403 }
    );
  }

  await initDB();
  const sql = getSql();
  const { name, event_date, location, description, division_id } = await req.json();

  if (!name || !event_date) {
    return NextResponse.json(
      { error: "Nama dan tanggal wajib diisi" },
      { status: 400 }
    );
  }

  let effDivisionId = division_id;
  if (!effDivisionId) {
    const def = await sql.query(
      "SELECT id FROM divisions ORDER BY id LIMIT 1"
    );
    effDivisionId = def.length > 0 ? def[0].id : null;
  }

  const result = await sql.query(
    `INSERT INTO events (user_id, name, event_date, location, description, division_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [session.userId, name, event_date, location || "", description || "", effDivisionId]
  );

  return NextResponse.json({ success: true, id: result[0].id });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initDB();
  const sql = getSql();
  const { id, name, event_date, location, description, division_id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "ID event wajib diisi" }, { status: 400 });
  }

  const target = await sql.query("SELECT user_id FROM events WHERE id = $1", [id]);
  if (target.length === 0) {
    return NextResponse.json({ error: "Event tidak ditemukan" }, { status: 404 });
  }

  const isAdmin = session.role === "admin";
  const isOwner = Number(target[0].user_id) === session.userId;
  if (!isAdmin && !isOwner) {
    return NextResponse.json(
      { error: "Tidak ada akses untuk mengubah event ini" },
      { status: 403 }
    );
  }

  const nameVal = name ?? target[0].name;
  if (!nameVal) {
    return NextResponse.json({ error: "Nama event wajib diisi" }, { status: 400 });
  }

  await sql.query(
    `UPDATE events SET name = $1, event_date = $2, location = $3, description = $4, division_id = $5
     WHERE id = $6`,
    [
      nameVal,
      event_date ?? target[0].event_date,
      location ?? target[0].location,
      description ?? target[0].description,
      division_id ?? null,
      id,
    ]
  );

  return NextResponse.json({ success: true, message: "Event berhasil diperbarui" });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initDB();
  const sql = getSql();
  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "ID event wajib diisi" }, { status: 400 });
  }

  const target = await sql.query("SELECT user_id FROM events WHERE id = $1", [id]);
  if (target.length === 0) {
    return NextResponse.json({ error: "Event tidak ditemukan" }, { status: 404 });
  }

  const isAdmin = session.role === "admin";
  const isOwner = Number(target[0].user_id) === session.userId;
  if (!isAdmin && !isOwner) {
    return NextResponse.json(
      { error: "Tidak ada akses untuk menghapus event ini" },
      { status: 403 }
    );
  }

  await sql.query("DELETE FROM events WHERE id = $1", [id]);

  return NextResponse.json({ success: true, message: "Event berhasil dihapus" });
}