import { NextResponse } from "next/server";
import getSql, { initDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await initDB();
    const sql = getSql();
    const rows = await sql.query(
      `SELECT d.*, COUNT(e.id)::int AS total_events
       FROM divisions d
       LEFT JOIN events e ON e.division_id = d.id
       GROUP BY d.id
       ORDER BY d.id ASC`
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("Get divisions error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data divisi" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json(
        { error: "Hanya admin yang bisa menambah divisi" },
        { status: 403 }
      );
    }

    await initDB();
    const sql = getSql();
    const { name } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Nama divisi wajib diisi" }, { status: 400 });
    }

    const existing = await sql.query("SELECT id FROM divisions WHERE name = $1", [name.trim()]);
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Divisi dengan nama tersebut sudah ada" },
        { status: 400 }
      );
    }

    const result = await sql.query(
      "INSERT INTO divisions (name) VALUES ($1) RETURNING id",
      [name.trim()]
    );

    return NextResponse.json({ success: true, message: "Divisi berhasil ditambahkan", id: result[0].id });
  } catch (error) {
    console.error("Create division error:", error);
    return NextResponse.json({ error: "Gagal menambahkan divisi" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json(
        { error: "Hanya admin yang bisa mengubah divisi" },
        { status: 403 }
      );
    }

    await initDB();
    const sql = getSql();
    const { id, name } = await req.json();

    if (!id || !name || !name.trim()) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    const existing = await sql.query(
      "SELECT id FROM divisions WHERE name = $1 AND id != $2",
      [name.trim(), id]
    );
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Divisi dengan nama tersebut sudah ada" },
        { status: 400 }
      );
    }

    await sql.query("UPDATE divisions SET name = $1 WHERE id = $2", [name.trim(), id]);

    return NextResponse.json({ success: true, message: "Divisi berhasil diperbarui" });
  } catch (error) {
    console.error("Update division error:", error);
    return NextResponse.json({ error: "Gagal memperbarui divisi" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json(
        { error: "Hanya admin yang bisa menghapus divisi" },
        { status: 403 }
      );
    }

    await initDB();
    const sql = getSql();
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "ID divisi wajib diisi" }, { status: 400 });
    }

    const used = await sql.query(
      "SELECT COUNT(*)::int AS count FROM events WHERE division_id = $1",
      [id]
    );
    if (used[0].count > 0) {
      return NextResponse.json(
        { error: "Divisi masih digunakan oleh event, tidak bisa dihapus" },
        { status: 400 }
      );
    }

    await sql.query("DELETE FROM divisions WHERE id = $1", [id]);

    return NextResponse.json({ success: true, message: "Divisi berhasil dihapus" });
  } catch (error) {
    console.error("Delete division error:", error);
    return NextResponse.json({ error: "Gagal menghapus divisi" }, { status: 500 });
  }
}