import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

const MANAGER_ROLES = ["admin", "pic"];

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await initDB();
    const sql = getSql();

    const assistans = await sql.query(
      `SELECT u.id, u.employee_id, u.name, pa.created_at AS added_at
       FROM pic_assistants pa
       JOIN users u ON u.id = pa.assistant_user_id
       WHERE pa.pic_user_id = $1
       ORDER BY pa.created_at DESC`,
      [session.userId]
    );

    const candidates = await sql.query(
      `SELECT id, employee_id, name, role FROM users
       WHERE role IN ('user', 'asisten')
         AND id NOT IN (
           SELECT assistant_user_id FROM pic_assistants
         )
       ORDER BY name`,
      []
    );

    return NextResponse.json({ success: true, assistans, candidates });
  } catch (error) {
    console.error("Get asisten error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data asisten" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!MANAGER_ROLES.includes(session.role)) {
      return NextResponse.json(
        { error: "Hanya PIC / Admin yang bisa menambah asisten" },
        { status: 403 }
      );
    }

    await initDB();
    const sql = getSql();
    const { assistant_user_id } = await req.json();

    if (!assistant_user_id) {
      return NextResponse.json(
        { error: "User wajib dipilih" },
        { status: 400 }
      );
    }

    const target = await sql.query(
      "SELECT id, role FROM users WHERE id = $1",
      [assistant_user_id]
    );
    if (target.length === 0) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    const existing = await sql.query(
      "SELECT pic_user_id FROM pic_assistants WHERE assistant_user_id = $1",
      [assistant_user_id]
    );
    if (existing.length > 0 && existing[0].pic_user_id !== session.userId) {
      return NextResponse.json(
        {
          error:
            "User sudah terdaftar sebagai asisten PIC lain dan tidak bisa diambil lagi",
        },
        { status: 409 }
      );
    }
    if (existing.length > 0 && existing[0].pic_user_id === session.userId) {
      return NextResponse.json({
        success: true,
        message: "User sudah menjadi asisten Anda",
      });
    }

    await sql.query(
      `INSERT INTO pic_assistants (pic_user_id, assistant_user_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [session.userId, assistant_user_id]
    );

    if (target[0].role === "user") {
      await sql.query("UPDATE users SET role = 'asisten' WHERE id = $1", [
        assistant_user_id,
      ]);
    }

    return NextResponse.json({
      success: true,
      message: "Berhasil menambahkan asisten",
    });
  } catch (error) {
    console.error("Add asisten error:", error);
    return NextResponse.json(
      { error: "Gagal menambahkan asisten" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!MANAGER_ROLES.includes(session.role)) {
      return NextResponse.json(
        { error: "Hanya PIC / Admin yang bisa menghapus asisten" },
        { status: 403 }
      );
    }

    await initDB();
    const sql = getSql();
    const body = await req.json();
    const { assistant_user_id } = body;

    if (!assistant_user_id) {
      return NextResponse.json(
        { error: "User wajib dipilih" },
        { status: 400 }
      );
    }

    await sql.query(
      `DELETE FROM pic_assistants
       WHERE pic_user_id = $1 AND assistant_user_id = $2`,
      [session.userId, assistant_user_id]
    );

    const stillAsisten = await sql.query(
      "SELECT id FROM pic_assistants WHERE assistant_user_id = $1",
      [assistant_user_id]
    );
    if (stillAsisten.length === 0) {
      await sql.query("UPDATE users SET role = 'user' WHERE id = $1", [
        assistant_user_id,
      ]);
    }

    return NextResponse.json({ success: true, message: "Asisten dihapus" });
  } catch (error) {
    console.error("Delete asisten error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus asisten" },
      { status: 500 }
    );
  }
}