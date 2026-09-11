import { Pool } from "pg";

type Row = Record<string, any>;

export type Sql = {
  query(queryWithPlaceholders: string, params?: any[]): Promise<Row[]>;
};

let pool: Pool | null = null;
let sql: Sql | null = null;

function getSql(): Sql {
  if (sql) return sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL belum di-set. Tambahkan di .env.local (dev) atau Vercel Environment Variables."
    );
  }
  const isRemote = !/localhost|127\.0\.0\.1|::1/.test(url);
  pool = new Pool({
    connectionString: url,
    ssl: isRemote ? { rejectUnauthorized: false } : undefined,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });
  const wrapped: Sql = {
    query: async (q, p) => {
      const res = await pool!.query(q, p);
      return res.rows;
    },
  };
  sql = wrapped;
  return wrapped;
}

export async function initDB() {
  const sql = getSql();
  await sql.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'pic',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await sql.query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      event_date TEXT NOT NULL,
      location TEXT DEFAULT '',
      description TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await sql.query(`
    CREATE TABLE IF NOT EXISTS tokens (
      id SERIAL PRIMARY KEY,
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(event_id)
    )
  `);
  await sql.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      division TEXT NOT NULL,
      clock_in TEXT NOT NULL,
      clock_out TEXT,
      task TEXT,
      date TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export default getSql;