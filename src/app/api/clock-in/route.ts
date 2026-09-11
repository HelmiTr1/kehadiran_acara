import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";

export async function POST(req: Request) {
  try {
    await initDB();
    const sql = getSql();
    const body = await req.json();
    const { employee_id, employee_name, division, clock_in, task, token, event_id } =
      body;

    if (!employee_id || !employee_name || !division || !clock_in || !token || !event_id) {
      return NextResponse.json(
        { error: "Semua field wajib diisi" },
        { status: 400 }
      );
    }

    const validToken = await sql.query(
      "SELECT id FROM tokens WHERE token = $1 AND event_id = $2",
      [token, event_id]
    );
    if (validToken.length === 0) {
      return NextResponse.json(
        { error: "Token tidak valid untuk event ini" },
        { status: 401 }
      );
    }

    const now = new Date();
    const date = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

    const existing = await sql.query(
      `SELECT id FROM attendance
       WHERE employee_id = $1 AND event_id = $2 AND date = $3 AND clock_out IS NULL`,
      [employee_id, event_id, date]
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Sudah clock in hari ini untuk event ini" },
        { status: 409 }
      );
    }

    const result = await sql.query(
      `INSERT INTO attendance (event_id, employee_id, employee_name, division, clock_in, task, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [event_id, employee_id, employee_name, division, clock_in, task || "", date]
    );

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