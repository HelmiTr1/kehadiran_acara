import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import getSql from "@/lib/db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "kehadiran-acara-secret-change-in-production"
);

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hashed: string) {
  return bcrypt.compare(password, hashed);
}

export type SessionPayload = {
  userId: number;
  username: string;
  name: string;
  role: "admin" | "pic" | "asisten" | "user";
};

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  try {
    const sql = getSql();
    const user = await sql.query(
      "SELECT id, username, name, role FROM users WHERE id = $1",
      [payload.userId]
    );
    if (user.length === 0) return null;
    return {
      userId: user[0].id,
      username: user[0].username,
      name: user[0].name,
      role: user[0].role,
    };
  } catch {
    return payload;
  }
}
