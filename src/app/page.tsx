"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { notifyAuthLogout, useOnAuthLogout } from "@/lib/auth-sync";
import { useToast } from "@/lib/useToast";
import ToastContainer from "@/components/Toast";

const QrScanner = dynamic(() => import("@/components/QrScanner"), {
  ssr: false,
  loading: () => (
    <div className="w-full rounded-xl bg-gray-100 min-h-[220px] flex items-center justify-center text-sm text-gray-400">
      Memuat kamera...
    </div>
  ),
});

type User = {
  id: number;
  username: string;
  employee_id: string | null;
  name: string;
  role: string;
};

type AttendanceSession = {
  attendance_id: number;
  clock_in: string;
  clock_out: string | null;
  division: string | null;
  task: string | null;
  date: string;
};

type MyEvent = {
  id: number;
  name: string;
  event_date: string;
  location: string;
  description: string;
  division_name: string | null;
  sessions: AttendanceSession[];
  has_attendance: number;
  is_active: number;
};

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [myEvents, setMyEvents] = useState<MyEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<"scan" | "token">("scan");
  const [tokenInput, setTokenInput] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanned, setScanned] = useState<{
    event: { event_id: number; event_name: string; event_date: string; location: string; division: string };
    attendance: { id: number; clock_in: string; clock_out: string | null } | null;
    token: string;
  } | null>(null);
  const [division, setDivision] = useState("");
  const [task, setTask] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const { toasts, success, error, dismiss } = useToast();

  useEffect(() => {
    const update = () =>
      setCurrentTime(
        new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (res.ok) setUser(data.user);
    } catch {
      /* noop */
    } finally {
      setLoadingUser(false);
    }
  }, []);

  const fetchMyEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const res = await fetch("/api/my-events");
      const data = await res.json();
      if (data.success) setMyEvents(data.data);
    } catch {
      /* noop */
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    fetchMe().then(() => fetchMyEvents());
  }, [fetchMe, fetchMyEvents]);

  useOnAuthLogout(() => {
    setUser(null);
    setMyEvents([]);
    setTokenInput("");
    setScanned(null);
    setModalOpen(false);
    router.push("/login");
  });

  const getTimeNow = () =>
    new Date().toLocaleTimeString("sv-SE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const getLocalDate = useCallback(
    () =>
      new Date().toLocaleDateString("sv-SE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    []
  );

  const openModal = () => {
    setModalOpen(true);
    setScanned(null);
    setTokenInput("");
    setEntryMode("scan");
  };

  const handleProcessScan = useCallback(
    async (value: string) => {
      const qr = value.trim();
      if (!qr) return;
      setScanLoading(true);
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qr, date: getLocalDate() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setScanned({ event: data.event, attendance: data.attendance, token: data.token || qr });
        setDivision(data.event.division || "");
        setTask("");
      } catch (err: unknown) {
        error(err instanceof Error ? err.message : "Gagal memproses");
      } finally {
        setScanLoading(false);
      }
    },
    [error, getLocalDate]
  );

  const handleScanError = useCallback(() => {
    error("Gagal mengakses kamera. Coba mode 'Masukkan Token'.");
  }, [error]);

  const handleSubmitToken = () => handleProcessScan(tokenInput);

  const handleClockIn = async () => {
    if (!scanned) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/clock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          division,
          clock_in: getTimeNow(),
          task,
          token: scanned.token,
          event_id: scanned.event.event_id,
          date: getLocalDate(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      success(`Clock in berhasil — ${scanned.event.event_name}`);
      setModalOpen(false);
      setScanned(null);
      await fetchMyEvents();
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!scanned) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/clock-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clock_out: getTimeNow(),
          task,
          token: scanned.token,
          event_id: scanned.event.event_id,
          date: getLocalDate(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      success(`Clock out berhasil — ${scanned.event.event_name}`);
      setModalOpen(false);
      setScanned(null);
      await fetchMyEvents();
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 pb-16">
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg">Kehadiran Acara</h1>
            {user && (
              <p className="text-blue-200 text-xs">
                {user.name}
                {user.employee_id ? ` (${user.employee_id})` : ""} —{" "}
                {user.role.toUpperCase()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {user && user.role !== "user" && (
              <Link
                href="/dashboard"
                className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-medium text-white transition-colors"
              >
                Dashboard
              </Link>
            )}
            {user ? (
              <button
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  notifyAuthLogout();
                  router.push("/login");
                }}
                className="px-3 py-1.5 bg-red-500/80 hover:bg-red-600 rounded-lg text-xs font-medium text-white transition-colors"
              >
                Logout
              </button>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-medium text-white transition-colors"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 mt-6 space-y-6">
        <div className="text-center">
          <p className="text-5xl font-mono text-white font-bold tracking-wider">
            {currentTime}
          </p>
          <p className="text-blue-200 text-xs mt-1">
            Clock In / Clock Out — scan QR atau masukkan token dari PIC
          </p>
        </div>

        {loadingUser ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="inline-block w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            <p className="text-blue-100 text-sm">Memuat...</p>
          </div>
        ) : !user && (
          <div className="bg-white rounded-2xl shadow-2xl p-6 text-center">
            <p className="text-gray-700 font-medium mb-1">Belum login?</p>
            <p className="text-sm text-gray-500 mb-4">
              Karyawan harus login dengan ID karyawan untuk bisa melihat daftar
              event dan clock in/out.
            </p>
            <Link
              href="/login"
              className="inline-block w-full py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all"
            >
              Login / Register
            </Link>
          </div>
        )}

        {user && (
          <>
            <button
              onClick={openModal}
              className="w-full bg-white rounded-2xl shadow-2xl p-8 text-center group hover:ring-2 hover:ring-blue-300 transition-all"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 group-hover:scale-105 transition-transform">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                  />
                </svg>
              </div>
              <p className="font-semibold text-gray-900 text-lg">
                Scan QR / Masukkan Token
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Ketuk untuk clock in / clock out pada event
              </p>
            </button>

            <section>
              <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
                <span>Event Saya</span>
                <button
                  onClick={fetchMyEvents}
                  className="text-xs text-blue-200 underline hover:text-white"
                >
                  muat ulang
                </button>
              </h2>
              {loadingEvents ? (
                <div className="bg-white/10 rounded-xl border border-white/10 px-5 py-8 text-center text-blue-100 text-sm">
                  <div className="inline-block w-5 h-5 border-2 border-blue-200 border-t-transparent rounded-full animate-spin mb-2"></div>
                  <p>Memuat event...</p>
                </div>
              ) : myEvents.length === 0 ? (
                <div className="bg-white/10 rounded-xl border border-white/10 px-5 py-8 text-center text-blue-100 text-sm">
                  Belum ada event. Scan QR di lokasi event untuk mulai.
                </div>
              ) : (
                <div className="space-y-3">
                  {myEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="bg-white rounded-xl shadow-md p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900">{ev.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {ev.event_date}
                            {ev.location ? ` — ${ev.location}` : ""}
                          </p>
                          {ev.division_name && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              {ev.division_name}
                            </span>
                          )}
                        </div>
                        {Boolean(ev.is_active) ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                            Bekerja
                          </span>
                        ) : ev.has_attendance ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            Selesai
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                            Belum clock in
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-3 border-t border-gray-100 pt-3">
                        {ev.sessions.length > 0 ? (
                          <div className="text-xs text-gray-500 space-y-0.5">
                            {ev.sessions.slice(0, 3).map((s) => (
                              <div key={s.attendance_id}>
                                <span className="font-mono">{s.date.split("-").slice(1).join("-")}</span>{" "}
                                <span>
                                  Masuk: <b className="font-mono">{s.clock_in}</b>
                                  {s.clock_out ? (
                                    <>
                                      {" "}Pulang: <b className="font-mono">{s.clock_out}</b>
                                    </>
                                  ) : (
                                    <span className="text-orange-600 font-medium"> (bekerja)</span>
                                  )}
                                </span>
                              </div>
                            ))}
                            {ev.sessions.length > 3 && (
                              <p className="text-gray-400">+{ev.sessions.length - 3} sesi lainnya</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">
                            Belum ada data
                          </span>
                        )}
                        {Boolean(ev.is_active) ? (
                          <button
                            onClick={openModal}
                            className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors shrink-0"
                          >
                            Clock Out
                          </button>
                        ) : (
                          <button
                            onClick={openModal}
                            className="px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-semibold transition-colors shrink-0"
                          >
                            Clock In
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {modalOpen && user && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            {!scanned ? (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">
                    Scan QR / Masukkan Token
                  </h3>
                  <button
                    onClick={() => setModalOpen(false)}
                    className="p-2 text-gray-400 hover:text-gray-600"
                    aria-label="Tutup"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="flex rounded-xl bg-gray-100 p-1 mb-4">
                  <button
                    onClick={() => setEntryMode("scan")}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      entryMode === "scan"
                        ? "bg-white shadow text-gray-900"
                        : "text-gray-500"
                    }`}
                  >
                    Scan QR
                  </button>
                  <button
                    onClick={() => setEntryMode("token")}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      entryMode === "token"
                        ? "bg-white shadow text-gray-900"
                        : "text-gray-500"
                    }`}
                  >
                    Masukkan Token
                  </button>
                </div>

                {entryMode === "scan" ? (
                  <div className="relative">
                    {scanLoading && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-xl bg-white/90">
                        <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm font-medium text-gray-700">
                          Memverifikasi QR...
                        </p>
                      </div>
                    )}
                    <QrScanner
                      onResult={handleProcessScan}
                      onError={handleScanError}
                    />
                    <p className="text-xs text-gray-400 text-center mt-2">
                      Arahkan kamera ke QR code yang ditampilkan PIC di lokasi
                      event.
                    </p>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={tokenInput}
                      onChange={(e) =>
                        setTokenInput(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="000000"
                      className="w-full text-center text-3xl font-mono tracking-[0.5em] px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900"
                    />
                    <p className="text-xs text-gray-400 text-center mt-2">
                      Token 6 digit dari PIC, berlaku 5 menit.
                    </p>
                  </div>
                )}

                {entryMode === "token" && (
                  <button
                    onClick={handleSubmitToken}
                    disabled={tokenInput.length !== 6 || scanLoading}
                    className="w-full mt-4 py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {scanLoading ? "Memverifikasi..." : "Verifikasi Token"}
                  </button>
                )}
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">Event Ditemukan</h3>
                  <button
                    onClick={() => {
                      setScanned(null);
                      setModalOpen(false);
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600"
                    aria-label="Tutup"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
                  <p className="font-semibold text-gray-900">
                    {scanned.event.event_name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {scanned.event.event_date}
                    {scanned.event.location ? ` — ${scanned.event.location}` : ""}
                  </p>
                </div>

                {scanned.attendance && !scanned.attendance.clock_out ? (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      Status:{" "}
                      <span className="text-orange-600 font-semibold">
                        Sudah clock in pada {scanned.attendance.clock_in}
                      </span>
                    </p>
                    <button
                      onClick={handleClockOut}
                      disabled={actionLoading}
                      className="w-full py-3 rounded-xl font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-all"
                    >
                      {actionLoading ? "Memproses..." : "Clock Out Sekarang"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Divisi
                      </label>
                      <div className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-sm">
                        {division || (
                          <span className="text-gray-400 italic">Tidak ada divisi</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tugas (opsional)
                      </label>
                      <textarea
                        value={task}
                        onChange={(e) => setTask(e.target.value)}
                        rows={2}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none text-gray-900"
                      />
                    </div>
                    <button
                      onClick={handleClockIn}
                      disabled={actionLoading}
                      className="w-full py-3 rounded-xl font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 transition-all"
                    >
                      {actionLoading ? "Memproses..." : "Clock In Sekarang"}
                    </button>
                  </div>
                )}

                <button
                  onClick={() => {
                    setScanned(null);
                    setTokenInput("");
                    setEntryMode("scan");
                  }}
                  className="w-full mt-3 text-sm text-blue-600 hover:underline"
                >
                  Scan / masukkan token lain
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </main>
  );
}