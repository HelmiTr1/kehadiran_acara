import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

function isAdmin(session: { role: string }) {
  return session.role === "admin";
}

async function getRecordForAdmin(sql: ReturnType<typeof getSql>, id: number) {
  const rows = await sql.query(
    `SELECT a.id, a.event_id, a.clock_in, a.clock_out, e.user_id AS owner_id
     FROM attendance a
     JOIN events e ON e.id = a.event_id
     WHERE a.id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await initDB();
    const sql = getSql();
    const { searchParams } = new URL(req.url);
    const event_id = searchParams.get("event_id");
    const employee_id = searchParams.get("employee_id");

    let query = `
      SELECT a.*, e.name AS event_name, e.event_date, u.name AS pic_name
      FROM attendance a
      JOIN events e ON e.id = a.event_id
      JOIN users u ON u.id = e.user_id
      WHERE 1=1
    `;
    const args: string[] = [];

    if (session.role !== "admin") {
      if (session.role === "asisten") {
        args.push(String(session.userId));
        query += ` AND (
          e.user_id = $${args.length}
          OR e.user_id IN (
            SELECT pic_user_id FROM pic_assistants WHERE assistant_user_id = $${args.length}
          )
        )`;
      } else if (session.role === "pic") {
        args.push(String(session.userId));
        query += ` AND e.user_id = $${args.length}`;
      } else {
        args.push(session.username);
        query += ` AND a.employee_id = $${args.length}`;
      }
    }

    if (event_id) {
      args.push(event_id);
      query += ` AND a.event_id = $${args.length}`;
    }
    if (employee_id) {
      args.push(employee_id);
      query += ` AND a.employee_id = $${args.length}`;
    }

    query += " ORDER BY a.id DESC";

    const result = await sql.query(query, args);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Get records error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdmin(session)) {
      return NextResponse.json(
        { error: "Hanya admin yang bisa mengubah jam kehadiran" },
        { status: 403 }
      );
    }

    await initDB();
    const sql = getSql();
    const { id, clock_in, clock_out } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID kehadiran wajib diisi" },
        { status: 400 }
      );
    }

    const record = await getRecordForAdmin(sql, id);
    if (!record) {
      return NextResponse.json(
        { error: "Data kehadiran tidak ditemukan" },
        { status: 404 }
      );
    }

    const newClockIn =
      typeof clock_in === "string" && clock_in.trim() !== "" ? clock_in : null;
    const newClockOut =
      typeof clock_out === "string" && clock_out.trim() !== "" ? clock_out : null;

    if (newClockIn !== null && !TIME_RE.test(newClockIn)) {
      return NextResponse.json(
        { error: "Format jam masuk tidak valid (HH:mm atau HH:mm:ss)" },
        { status: 400 }
      );
    }
    if (newClockOut !== null && !TIME_RE.test(newClockOut)) {
      return NextResponse.json(
        { error: "Format jam pulang tidak valid (HH:mm atau HH:mm:ss)" },
        { status: 400 }
      );
    }

    const finalIn =
      newClockIn !== null ? newClockIn : record.clock_in;
    const finalOut =
      newClockOut !== null
        ? newClockOut
        : record.clock_out || null;

    if (finalOut !== null) {
      const [inH, inM, inS] = finalIn.split(":").map(Number);
      const [outH, outM, outS] = finalOut.split(":").map(Number);
      const clockedIn = inH * 3600 + inM * 60 + (inS || 0);
      const clockedOut = outH * 3600 + outM * 60 + (outS || 0);
      const diff = clockedOut - clockedIn + (clockedOut < clockedIn ? 24 * 3600 : 0);
      if (diff <= 0 || diff > 24 * 3600) {
        return NextResponse.json(
          { error: "Rentang jam pulang - jam masuk tidak valid (maks 24 jam)" },
          { status: 400 }
        );
      }
    }

    await sql.query(
      "UPDATE attendance SET clock_in = $1, clock_out = $2 WHERE id = $3",
      [finalIn, finalOut, id]
    );

    return NextResponse.json({
      success: true,
      message: "Jam kehadiran berhasil diperbarui",
    });
  } catch (error) {
    console.error("Update record error:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui data" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdmin(session)) {
      return NextResponse.json(
        { error: "Hanya admin yang bisa menghapus data kehadiran" },
        { status: 403 }
      );
    }

    await initDB();
    const sql = getSql();
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID kehadiran wajib diisi" },
        { status: 400 }
      );
    }

    const record = await getRecordForAdmin(sql, id);
    if (!record) {
      return NextResponse.json(
        { error: "Data kehadiran tidak ditemukan" },
        { status: 404 }
      );
    }

    await sql.query("DELETE FROM attendance WHERE id = $1", [id]);

    return NextResponse.json({
      success: true,
      message: "Data kehadiran berhasil dihapus",
    });
  } catch (error) {
    console.error("Delete record error:", error);
    return NextResponse.json(
      { error: "Gagal menghapus data" },
      { status: 500 }
    );
  }
}