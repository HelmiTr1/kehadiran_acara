import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";

export async function POST(req: Request) {
  try {
    await initDB();
    const sql = getSql();
    const body = await req.json();
    const { employee_id, clock_out, task, token, event_id } = body;

    if (!employee_id || !clock_out || !token || !event_id) {
      return NextResponse.json(
        { error: "Field wajib diisi" },
        { status: 400 }
      );
    }

    const validToken = await sql.query(
      "SELECT id FROM tokens WHERE token = $1 AND event_id = $2",
      [token, event_id]
    );
    if (validToken.length === 0) {
      return NextResponse.json(
        { error: "Token tidak valid" },
        { status: 401 }
      );
    }

    const now = new Date();
    const date = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

    const existing = await sql.query(
      `SELECT id, task AS existing_task FROM attendance
       WHERE employee_id = $1 AND event_id = $2 AND date = $3 AND clock_out IS NULL`,
      [employee_id, event_id, date]
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