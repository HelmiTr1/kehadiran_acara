import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Silakan login dulu" }, { status: 401 });
    }

    await initDB();
    const sql = getSql();
    const body = await req.json();
    const raw = String(body?.qr || body?.token || "").trim();

    let eventId: number | null = null;
    let token: string;

    if (/^\d+:\d{6}$/.test(raw)) {
      const [eid, tk] = raw.split(":");
      eventId = Number(eid);
      token = tk;
    } else if (/^\d{6}$/.test(raw)) {
      token = raw;
    } else {
      return NextResponse.json(
        { error: "Kode QR / token tidak dikenali" },
        { status: 400 }
      );
    }

    const params: string[] = [token];
    let query = `
      SELECT t.id AS token_id, t.event_id, t.expires_at,
             e.name AS event_name, e.event_date, e.location,
             d.name AS division_name
      FROM tokens t
      JOIN events e ON e.id = t.event_id
      LEFT JOIN divisions d ON d.id = e.division_id
      WHERE t.token = $1
    `;
    if (eventId) {
      params.push(String(eventId));
      query += ` AND t.event_id = $2`;
    }

    const result = await sql.query(query, params);
    if (result.length === 0) {
      return NextResponse.json(
        { error: "Token tidak valid" },
        { status: 404 }
      );
    }

    const row = result[0];
    const expiresAt = new Date(row.expires_at);
    if (new Date() > new Date(expiresAt.getTime() + 60000)) {
      return NextResponse.json(
        { error: "Token sudah kedaluwarsa, minta token baru ke PIC" },
        { status: 401 }
      );
    }

    await sql.query(
      `INSERT INTO user_events (user_id, event_id) VALUES ($1, $2)
       ON CONFLICT (user_id, event_id) DO NOTHING`,
      [session.userId, row.event_id]
    );

    const today = new Date().toLocaleDateString("sv-SE", {
      timeZone: "Asia/Jakarta",
    });
    const att = await sql.query(
      `SELECT id, clock_in, clock_out FROM attendance
       WHERE user_id = $1 AND event_id = $2 AND date = $3
       ORDER BY id DESC LIMIT 1`,
      [session.userId, row.event_id, today]
    );

    return NextResponse.json({
      success: true,
      event: {
        event_id: row.event_id,
        event_name: row.event_name,
        event_date: row.event_date,
        location: row.location,
        division: row.division_name || "",
      },
      token,
      attendance: att[0] || null,
    });
  } catch (error) {
    console.error("Scan error:", error);
    return NextResponse.json(
      { error: "Gagal memproses scan" },
      { status: 500 }
    );
  }
}