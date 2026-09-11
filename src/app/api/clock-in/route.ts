import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await initDB();
    const sql = getSql();
    const body = await req.json();
    const { employee_id, employee_name, division, clock_in, task, token, event_id } =
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

    if (!division || !token || !event_id) {
      return NextResponse.json(
        { error: "Field wajib diisi" },
        { status: 400 }
      );
    }

    const validToken = await sql.query(
      "SELECT id, expires_at FROM tokens WHERE token = $1 AND event_id = $2",
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

    const now = new Date();
    const date = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

    const existing = await sql.query(
      `SELECT id FROM attendance
       WHERE employee_id = $1 AND event_id = $2 AND date = $3 AND clock_out IS NULL`,
      [effEmployeeId, event_id, date]
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Sudah clock in hari ini untuk event ini" },
        { status: 409 }
      );
    }

    const result = await sql.query(
      `INSERT INTO attendance (event_id, user_id, employee_id, employee_name, division, clock_in, task, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [event_id, userId, effEmployeeId, effEmployeeName, division, clock_in, task || "", date]
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