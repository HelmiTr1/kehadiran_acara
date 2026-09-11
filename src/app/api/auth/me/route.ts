import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }
  return NextResponse.json({ success: true, user: session });
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await initDB();
  const sql = getSql();

  const user = await sql.query(
    "SELECT id, username, name, role FROM users WHERE id = $1",
    [session.userId]
  );
  if (user.length === 0) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({ success: true, user: user[0] });
}