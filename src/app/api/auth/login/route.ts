import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";
import { verifyPassword, createSessionToken, sessionCookieOptions, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await initDB();
    const sql = getSql();
    const { identifier, password } = await req.json();

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "ID Karyawan dan password wajib diisi" },
        { status: 400 }
      );
    }

    const result = await sql.query(
      "SELECT id, username, employee_id, password, name, role FROM users WHERE username = $1 OR employee_id = $1",
      [identifier]
    );
    if (result.length === 0) {
      return NextResponse.json(
        { error: "Username atau password salah" },
        { status: 401 }
      );
    }

    const user = result[0];
    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Username atau password salah" },
        { status: 401 }
      );
    }

    const token = await createSessionToken({
      userId: Number(user.id),
      username: user.employee_id || user.username,
      name: user.name,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      message: "Login berhasil",
      name: user.name,
      role: user.role,
      employee_id: user.employee_id || user.username,
    });
    response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Gagal login" }, { status: 500 });
  }
}