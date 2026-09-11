import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await initDB();
    const sql = getSql();
    const body = await req.json();
    const { employee_id, clock_out, task, token, event_id } = body;

    const session = await getSession();
    let effEmployeeId = employee_id;

    if (session) {
      const me = await sql.query(
        "SELECT employee_id FROM users WHERE id = $1",
        [session.userId]
      );
      if (me.length > 0) {
        effEmployeeId = me[0].employee_id || effEmployeeId;
      }
    }

    if (!effEmployeeId || !clock_out || !token || !event_id) {
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
        { error: "Token tidak valid" },
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
      `SELECT id, task AS existing_task FROM attendance
       WHERE employee_id = $1 AND event_id = $2 AND date = $3 AND clock_out IS NULL
       ORDER BY id DESC LIMIT 1`,
      [effEmployeeId, event_id, date]
    );
    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada data clock in aktif" },
        { status: 404 }
      );
    }

    const row = existing[0];
    const updateTask = task || row.existing_task;

    await sql.query(
      "UPDATE attendance SET clock_out = $1, task = $2 WHERE id = $3",
      [clock_out, updateTask, row.id]
    );

    return NextResponse.json({
      success: true,
      message: "Berhasil clock out",
    });
  } catch (error) {
    console.error("Clock out error:", error);
    return NextResponse.json(
      { error: "Gagal clock out" },
      { status: 500 }
    );
  }
}