import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";
import { getSession, createSessionToken, sessionCookieOptions, SESSION_COOKIE_NAME } from "@/lib/auth";

async function sessionResponse(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session) {
    return NextResponse.json(
      { error: "Belum login" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
  await initDB();
  const sql = getSql();
  const user = await sql.query(
    "SELECT id, username, employee_id, name, role FROM users WHERE id = $1",
    [session.userId]
  );
  if (user.length === 0) {
    return NextResponse.json(
      { error: "User tidak ditemukan" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }
  const response = NextResponse.json(
    { success: true, user: user[0] },
    { headers: { "Cache-Control": "no-store" } }
  );
  const token = await createSessionToken({
    userId: session.userId,
    username: session.username,
    name: session.name,
    role: session.role,
  });
  response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
  return response;
}

export async function GET() {
  return sessionResponse(await getSession());
}

export async function POST() {
  return sessionResponse(await getSession());
}