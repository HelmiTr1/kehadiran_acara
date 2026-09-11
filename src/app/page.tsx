"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const DIVISI_LIST = [
  "Acara",
  "Logistik",
  "Dokumentasi",
  "Keamanan",
  "Kebersihan",
  "Konsumsi",
  "Humas",
  "Perlengkapan",
  "Sponsorship",
  "IT",
];

export default function Home() {
  const [mode, setMode] = useState<"clockin" | "clockout">("clockin");
  const [token, setToken] = useState("");
  const [eventInfo, setEventInfo] = useState<{
    event_id: number;
    event_name: string;
    event_date: string;
    location: string;
  } | null>(null);
  const [tokenError, setTokenError] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [division, setDivision] = useState("");
  const [task, setTask] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("id-ID", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const getTimeNow = () =>
    new Date().toLocaleTimeString("sv-SE", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const handleValidateToken = async () => {
    if (token.length !== 6) return;
    setTokenLoading(true);
    setTokenError("");
    setEventInfo(null);
    try {
      const res = await fetch("/api/tokens/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEventInfo(data.event);
    } catch (err: unknown) {
      setTokenError(
        err instanceof Error ? err.message : "Token tidak valid"
      );
    } finally {
      setTokenLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventInfo) return;
    setLoading(true);
    setMessage(null);

    try {
      if (mode === "clockin") {
        const res = await fetch("/api/clock-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: employeeId,
            employee_name: employeeName,
            division,
            clock_in: getTimeNow(),
            task,
            token,
            event_id: eventInfo.event_id,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setMessage({
          type: "success",
          text: `Clock in berhasil — ${eventInfo.event_name}`,
        });
      } else {
        const res = await fetch("/api/clock-out", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: employeeId,
            clock_out: getTimeNow(),
            task,
            token,
            event_id: eventInfo.event_id,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setMessage({
          type: "success",
          text: `Clock out berhasil — ${eventInfo.event_name}`,
        });
      }
      setEmployeeId("");
      setEmployeeName("");
      setDivision("");
      setTask("");
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Terjadi kesalahan";
      setMessage({ type: "error", text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-full mb-4">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">
            Daftar Hadir Panitia
          </h1>
          <p className="text-blue-200 text-sm">Clock In / Clock Out</p>
          <p className="text-4xl font-mono text-white mt-4 tracking-wider">
            {currentTime}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {!eventInfo ? (
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Masukkan Token 6 Digit dari PIC
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={token}
                onChange={(e) =>
                  setToken(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                className="w-full text-center text-3xl font-mono tracking-[0.5em] px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900"
              />
              {tokenError && (
                <p className="text-red-500 text-sm mt-2 text-center">
                  {tokenError}
                </p>
              )}
              <button
                onClick={handleValidateToken}
                disabled={token.length !== 6 || tokenLoading}
                className="w-full mt-4 py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {tokenLoading ? "Memverifikasi..." : "Masukkan Token"}
              </button>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 border-b border-blue-100 px-6 py-4">
                <p className="text-xs text-blue-500 uppercase tracking-wider mb-1">
                  Event Aktif
                </p>
                <p className="font-semibold text-gray-900">
                  {eventInfo.event_name}
                </p>
                <p className="text-sm text-gray-500">
                  {eventInfo.event_date}
                  {eventInfo.location ? ` — ${eventInfo.location}` : ""}
                </p>
                <button
                  onClick={() => {
                    setEventInfo(null);
                    setToken("");
                    setTokenError("");
                    setMessage(null);
                  }}
                  className="text-xs text-blue-600 hover:underline mt-1"
                >
                  Ganti token
                </button>
              </div>

              <div className="flex">
                <button
                  onClick={() => setMode("clockin")}
                  className={`flex-1 py-3 font-semibold text-sm transition-all ${
                    mode === "clockin"
                      ? "bg-green-500 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  CLOCK IN
                </button>
                <button
                  onClick={() => setMode("clockout")}
                  className={`flex-1 py-3 font-semibold text-sm transition-all ${
                    mode === "clockout"
                      ? "bg-red-500 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  CLOCK OUT
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID Karyawan
                  </label>
                  <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="Masukkan ID karyawan"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900"
                  />
                </div>

                {mode === "clockin" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nama Karyawan
                      </label>
                      <input
                        type="text"
                        value={employeeName}
                        onChange={(e) => setEmployeeName(e.target.value)}
                        placeholder="Masukkan nama lengkap"
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Divisi
                      </label>
                      <select
                        value={division}
                        onChange={(e) => setDivision(e.target.value)}
                        required
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900 bg-white"
                      >
                        <option value="">Pilih divisi</option>
                        {DIVISI_LIST.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {mode === "clockin" ? "Tugas Hari Ini" : "Update Tugas"}
                    <span className="text-gray-400 font-normal ml-1">
                      (opsional)
                    </span>
                  </label>
                  <textarea
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                    placeholder="Apa yang sedang/sudah dikerjakan?"
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none text-gray-900"
                  />
                </div>

                {message && (
                  <div
                    className={`px-4 py-3 rounded-lg text-sm font-medium ${
                      message.type === "success"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 rounded-lg font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    mode === "clockin"
                      ? "bg-green-500 hover:bg-green-600 active:bg-green-700"
                      : "bg-red-500 hover:bg-red-600 active:bg-red-700"
                  }`}
                >
                  {loading
                    ? "Memproses..."
                    : mode === "clockin"
                      ? "Clock In Sekarang"
                      : "Clock Out Sekarang"}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="text-center mt-6">
          <Link
            href="/login"
            className="text-blue-200 hover:text-white text-sm transition-colors"
          >
            Login sebagai PIC / Admin &rarr;
          </Link>
        </div>
      </div>
    </main>
  );
}
