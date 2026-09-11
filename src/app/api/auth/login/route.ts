import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";
import { verifyPassword, createSessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await initDB();
    const sql = getSql();
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username dan password wajib diisi" },
        { status: 400 }
      );
    }

    const result = await sql.query(
      "SELECT id, username, password, name, role FROM users WHERE username = $1",
      [username]
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
      username: user.username,
      name: user.name,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      message: "Login berhasil",
      name: user.name,
      role: user.role,
    });
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 86400,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Gagal login" }, { status: 500 });
  }
}