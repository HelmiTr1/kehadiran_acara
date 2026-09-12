import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getClientIp } from "@/lib/ip";

export async function POST(req: Request) {
  try {
    await initDB();
    const sql = getSql();
    const body = await req.json();
    const { employee_id, employee_name, division, clock_in, task, token, event_id, date: clientDate } =
      body;

    const session = await getSession();
    let userId: number | null = null;
    let effEmployeeId = employee_id;
    let effEmployeeName = employee_name;

    if (session) {
      const me = await sql.query(
        "SELECT id, employee_id, name FROM users WHERE id = $1",
        [session.userId]
      );
      if (me.length > 0) {
        userId = me[0].id;
        effEmployeeId = me[0].employee_id || effEmployeeId;
        effEmployeeName = me[0].name || effEmployeeName;
      }
    }

    if (!token || !event_id) {
      return NextResponse.json(
        { error: "Field wajib diisi" },
        { status: 400 }
      );
    }

    const validToken = await sql.query(
      `SELECT t.id, t.expires_at, d.name AS division_name
       FROM tokens t
       JOIN events e ON e.id = t.event_id
       LEFT JOIN divisions d ON d.id = e.division_id
       WHERE t.token = $1 AND t.event_id = $2`,
      [token, event_id]
    );
    if (validToken.length === 0) {
      return NextResponse.json(
        { error: "Token tidak valid untuk event ini" },
        { status: 401 }
      );
    }
    if (new Date() > new Date(new Date(validToken[0].expires_at).getTime() + 60000)) {
      return NextResponse.json(
        { error: "Token sudah kedaluwarsa, minta token baru ke PIC" },
        { status: 401 }
      );
    }

    const effDivision = validToken[0].division_name || division || "";

    const dup = await sql.query(
      `SELECT id, clock_in, created_at FROM attendance
       WHERE employee_id = $1 AND event_id = $2
       ORDER BY id DESC LIMIT 1`,
      [effEmployeeId, event_id]
    );
    if (dup.length > 0) {
      const lastCreated = new Date(dup[0].created_at).getTime();
      const gapSec = (Date.now() - lastCreated) / 1000;
      if (gapSec >= 0 && gapSec < 60) {
        return NextResponse.json(
          {
            error: `Terdeteksi clock in ganda ${Math.max(0, Math.ceil(60 - gapSec))} detik lalu. Tolong tunggu sebentar jika ini bukan disengaja.`,
            duplicate_id: dup[0].id,
          },
          { status: 409 }
        );
      }
    }

    const now = new Date();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(clientDate || "")
      ? clientDate
      : now.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

    const result = await sql.query(
      `INSERT INTO attendance (event_id, user_id, employee_id, employee_name, division, clock_in, task, date, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [event_id, userId, effEmployeeId, effEmployeeName, effDivision, clock_in, task || "", date, getClientIp(req)]
    );

    if (userId) {
      await sql.query(
        `INSERT INTO user_events (user_id, event_id) VALUES ($1, $2)
         ON CONFLICT (user_id, event_id) DO NOTHING`,
        [userId, event_id]
      );
    }

    return NextResponse.json({
      success: true,
      message: "Berhasil clock in",
      id: result[0].id,
    });
  } catch (error) {
    console.error("Clock in error:", error);
    return NextResponse.json(
      { error: "Gagal clock in" },
      { status: 500 }
    );
  }
}