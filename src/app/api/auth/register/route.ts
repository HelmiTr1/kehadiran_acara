import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";
import { hashPassword, createSessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await initDB();
    const sql = getSql();
    const { username, password, name } = await req.json();

    if (!username || !password || !name) {
      return NextResponse.json(
        { error: "Semua field wajib diisi" },
        { status: 400 }
      );
    }

    const existing = await sql.query(
      "SELECT id FROM users WHERE username = $1",
      [username]
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Username sudah digunakan" },
        { status: 409 }
      );
    }

    const count = await sql.query("SELECT COUNT(*)::int AS count FROM users");
    const isFirst = Number(count[0].count) === 0;

    const hashed = await hashPassword(password);
    const role = isFirst ? "admin" : "pic";

    const result = await sql.query(
      `INSERT INTO users (username, password, name, role)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [username, hashed, name, role]
    );

    const token = await createSessionToken({
      userId: Number(result[0].id),
      username,
      name,
      role,
    });

    const response = NextResponse.json({
      success: true,
      message: "Registrasi berhasil",
      role,
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
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Gagal registrasi" },
      { status: 500 }
    );
  }
}