import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json(
        { error: "Hanya admin yang bisa mereset password" },
        { status: 403 }
      );
    }

    await initDB();
    const sql = getSql();
    const { user_id, new_password } = await req.json();

    if (!user_id || !new_password) {
      return NextResponse.json(
        { error: "User dan password baru wajib diisi" },
        { status: 400 }
      );
    }
    if (String(new_password).length < 6) {
      return NextResponse.json(
        { error: "Password minimal 6 karakter" },
        { status: 400 }
      );
    }

    const target = await sql.query("SELECT id FROM users WHERE id = $1", [
      user_id,
    ]);
    if (target.length === 0) {
      return NextResponse.json(
        { error: "User tidak ditemukan" },
        { status: 404 }
      );
    }

    const hashed = await hashPassword(new_password);
    await sql.query("UPDATE users SET password = $1 WHERE id = $2", [
      hashed,
      user_id,
    ]);

    return NextResponse.json({
      success: true,
      message: "Password berhasil direset",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Gagal mereset password" },
      { status: 500 }
    );
  }
}