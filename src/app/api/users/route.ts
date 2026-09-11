import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json(
        { error: "Hanya admin yang bisa mengelola user" },
        { status: 403 }
      );
    }

    await initDB();
    const sql = getSql();

    const users = await sql.query(
      `SELECT u.id, u.username, u.employee_id, u.name, u.role, u.created_at,
              (SELECT COUNT(*)::int FROM events e WHERE e.user_id = u.id) AS total_events
       FROM users u
       ORDER BY u.created_at ASC`
    );

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json({ error: "Gagal mengambil data user" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json(
        { error: "Hanya admin yang bisa mengubah role user" },
        { status: 403 }
      );
    }

    await initDB();
    const sql = getSql();
    const { id, role } = await req.json();

    if (!id || !["admin", "pic", "user", "asisten"].includes(role)) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    if (Number(id) === session.userId && role !== "admin") {
      return NextResponse.json(
        { error: "Tidak bisa mengubah role diri sendiri" },
        { status: 400 }
      );
    }

    const target = await sql.query("SELECT id, role FROM users WHERE id = $1", [id]);
    if (target.length === 0) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    if (role === "asisten") {
      return NextResponse.json(
        { error: 'Gunakan menu Asisten di PIC untuk menetapkan asisten' },
        { status: 400 }
      );
    }

    await sql.query("UPDATE users SET role = $1 WHERE id = $2", [role, id]);

    return NextResponse.json({ success: true, message: "Role user diperbarui" });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Gagal memperbarui role user" }, { status: 500 });
  }
}