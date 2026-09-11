import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";

export async function POST(req: Request) {
  try {
    await initDB();
    const sql = getSql();
    const { token } = await req.json();

    if (!token || String(token).length !== 6) {
      return NextResponse.json(
        { error: "Token harus 6 digit" },
        { status: 400 }
      );
    }

    const result = await sql.query(
      `SELECT t.id AS token_id, t.event_id, t.expires_at,
              e.name AS event_name, e.event_date, e.location
       FROM tokens t
       JOIN events e ON e.id = t.event_id
       WHERE t.token = $1`,
      [token]
    );

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Token tidak valid" },
        { status: 404 }
      );
    }

    const expiresAt = new Date(result[0].expires_at);
    const now = new Date();
    if (now > new Date(expiresAt.getTime() + 60000)) {
      return NextResponse.json(
        { error: "Token sudah kedaluwarsa, minta token baru ke PIC" },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true, event: result[0] });
  } catch (error) {
    console.error("Validate token error:", error);
    return NextResponse.json(
      { error: "Gagal validasi token" },
      { status: 500 }
    );
  }
}