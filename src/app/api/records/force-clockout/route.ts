import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await initDB();
    const sql = getSql();
    const { id, clock_out } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID kehadiran wajib diisi" },
        { status: 400 }
      );
    }

    const rows = await sql.query(
      `SELECT a.id, a.clock_out, a.event_id, e.user_id AS owner_id
       FROM attendance a
       JOIN events e ON e.id = a.event_id
       WHERE a.id = $1`,
      [id]
    );
    const record = rows[0];
    if (!record) {
      return NextResponse.json(
        { error: "Data kehadiran tidak ditemukan" },
        { status: 404 }
      );
    }
    if (record.clock_out) {
      return NextResponse.json(
        { error: "Kehadiran ini sudah clock out" },
        { status: 400 }
      );
    }

    let allowed = false;
    if (session.role === "admin") {
      allowed = true;
    } else if (session.role === "pic") {
      allowed = record.owner_id === session.userId;
    } else if (session.role === "asisten") {
      const asst = await sql.query(
        `SELECT 1 FROM pic_assistants
         WHERE assistant_user_id = $1 AND pic_user_id = $2`,
        [session.userId, record.owner_id]
      );
      allowed = asst.length > 0;
    }
    if (!allowed) {
      return NextResponse.json(
        { error: "Anda tidak berhak memaksa clock out data ini" },
        { status: 403 }
      );
    }

    let finalClockOut =
      typeof clock_out === "string" && clock_out.trim() !== ""
        ? clock_out
        : new Date().toTimeString().slice(0, 8);
    if (!TIME_RE.test(finalClockOut)) {
      return NextResponse.json(
        { error: "Format jam tidak valid (HH:mm atau HH:mm:ss)" },
        { status: 400 }
      );
    }

    await sql.query(
      "UPDATE attendance SET clock_out = $1 WHERE id = $2",
      [finalClockOut, id]
    );

    return NextResponse.json({
      success: true,
      message: "Berhasil clock out paksa",
      clock_out: finalClockOut,
    });
  } catch (error) {
    console.error("Force clock-out error:", error);
    return NextResponse.json(
      { error: "Gagal clock out paksa" },
      { status: 500 }
    );
  }
}