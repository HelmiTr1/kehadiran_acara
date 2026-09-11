"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

const QrDisplay = dynamic(() => import("@/components/QrDisplay"), {
  ssr: false,
  loading: () => (
    <div className="w-[200px] h-[200px] bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-400">
      Memuat QR...
    </div>
  ),
});

interface Event {
  id: number;
  name: string;
  event_date: string;
  location: string;
  description: string;
  token: string | null;
  expires_at: string | null;
  pic_name: string;
}

interface Attendance {
  id: number;
  event_id: number;
  event_name: string;
  event_date: string;
  employee_id: string;
  employee_name: string;
  division: string;
  clock_in: string;
  clock_out: string | null;
  task: string;
  date: string;
  pic_name: string;
}

interface Asisten {
  id: number;
  employee_id: string | null;
  name: string;
  added_at: string;
}

interface Candidate {
  id: number;
  employee_id: string | null;
  name: string;
  role: string;
}

interface AdminUser {
  id: number;
  username: string;
  employee_id: string | null;
  name: string;
  role: string;
  total_events: number;
}

type Tab = "events" | "asisten" | "users";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{
    id: number;
    name: string;
    role: string;
    employee_id: string | null;
  } | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("events");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEvent, setNewEvent] = useState({
    name: "",
    event_date: "",
    location: "",
    description: "",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [genTokenLoading, setGenTokenLoading] = useState<number | null>(null);
  const [countdowns, setCountdowns] = useState<Record<number, number>>({});
  const autoRegenedFor = useRef<Record<number, string>>({});

  const [qrEvent, setQrEvent] = useState<Event | null>(null);

  const [assistans, setAssistans] = useState<Asisten[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roleDraft, setRoleDraft] = useState<Record<number, string>>({});
  const [roleSaving, setRoleSaving] = useState<number | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (!res.ok) {
        router.push("/login");
        return;
      }
      setUser(data.user);
    } catch {
      router.push("/login");
    }
  }, [router]);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      if (data.success) setEvents(data.data);
    } catch {
      /* noop */
    }
  }, []);

  const fetchRecords = useCallback(async (eventId?: number) => {
    try {
      const params = new URLSearchParams();
      if (eventId) params.set("event_id", String(eventId));
      const res = await fetch(`/api/records?${params.toString()}`);
      const data = await res.json();
      if (data.success) setRecords(data.data);
    } catch {
      /* noop */
    }
  }, []);

  const fetchAsisten = useCallback(async () => {
    try {
      const res = await fetch("/api/asisten");
      const data = await res.json();
      if (data.success) {
        setAssistans(data.assistans);
        setCandidates(data.candidates);
      }
    } catch {
      /* noop */
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.success) setUsers(data.data);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchUser(), fetchEvents()]).then(() => setLoading(false));
  }, [fetchUser, fetchEvents]);

  useEffect(() => {
    if (selectedEventId) fetchRecords(selectedEventId);
  }, [selectedEventId, fetchRecords]);

  useEffect(() => {
    if (activeTab === "asisten") fetchAsisten();
    if (activeTab === "users") fetchUsers();
  }, [activeTab, fetchAsisten, fetchUsers]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEvent),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewEvent({ name: "", event_date: "", location: "", description: "" });
      setShowCreateForm(false);
      await fetchEvents();
    } catch {
      /* noop */
    } finally {
      setCreateLoading(false);
    }
  };

  const handleGenerateToken = useCallback(
    async (eventId: number) => {
      setGenTokenLoading(eventId);
      try {
        await fetch("/api/tokens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_id: eventId }),
        });
        await fetchEvents();
      } finally {
        setGenTokenLoading(null);
      }
    },
    [fetchEvents]
  );

  useEffect(() => {
    if (events.length === 0) return;
    const tick = () => {
      const now = Date.now();
      const next: Record<number, number> = {};
      for (const ev of events) {
        if (!ev.expires_at) continue;
        const remaining = Math.max(
          0,
          Math.floor((new Date(ev.expires_at).getTime() - now) / 1000)
        );
        next[ev.id] = remaining;
        if (
          remaining <= 0 &&
          autoRegenedFor.current[ev.id] !== ev.expires_at
        ) {
          autoRegenedFor.current[ev.id] = ev.expires_at;
          handleGenerateToken(ev.id);
        }
      }
      setCountdowns(next);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [events, handleGenerateToken]);

  const handleAddAsisten = async (userId: number) => {
    try {
      await fetch("/api/asisten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistant_user_id: userId }),
      });
      await fetchAsisten();
    } catch {
      /* noop */
    }
  };

  const handleRemoveAsisten = async (userId: number) => {
    try {
      await fetch("/api/asisten", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistant_user_id: userId }),
      });
      await fetchAsisten();
    } catch {
      /* noop */
    }
  };

  const handleChangeRole = async (userId: number) => {
    const role = roleDraft[userId];
    if (!role) return;
    setRoleSaving(userId);
    try {
      await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, role }),
      });
      await fetchUsers();
    } catch {
      /* noop */
    } finally {
      setRoleSaving(null);
    }
  };

  const formatDuration = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return "-";
    const [inH, inM, inS] = clockIn.split(":").map(Number);
    const [outH, outM, outS] = clockOut.split(":").map(Number);
    const diff =
      outH * 3600 + outM * 60 + outS - (inH * 3600 + inM * 60 + inS);
    if (diff < 0) return "-";
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    return `${h}j ${m}m`;
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-gray-500">Memuat...</p>
        </div>
      </main>
    );
  }

  const stats = {
    total: records.length,
    clockedOut: records.filter((r) => r.clock_out).length,
    stillWorking: records.filter((r) => !r.clock_out).length,
  };

  const roleLabel: Record<string, string> = {
    admin: "ADMIN",
    pic: "PIC",
    asisten: "ASISTEN",
    user: "USER",
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold">Dashboard</h1>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    user?.role === "admin"
                      ? "bg-yellow-400 text-yellow-900"
                      : user?.role === "asisten"
                        ? "bg-purple-400 text-purple-900"
                        : "bg-white/20 text-white"
                  }`}
                >
                  {user ? roleLabel[user.role] : ""}
                </span>
              </div>
              <p className="text-blue-200 text-sm">
                {user?.name}
                {user?.employee_id ? ` (${user.employee_id})` : ""}
                {user?.role === "admin" && " — Semua event & record"}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
              >
                Clock In/Out
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500/80 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="flex gap-1 mt-4 border-t border-white/10 pt-3">
            <button
              onClick={() => setActiveTab("events")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "events"
                  ? "bg-white text-blue-700"
                  : "text-blue-100 hover:bg-white/10"
              }`}
            >
              Event & Token
            </button>
            {(user?.role === "pic" || user?.role === "admin") && (
              <button
                onClick={() => setActiveTab("asisten")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === "asisten"
                    ? "bg-white text-blue-700"
                    : "text-blue-100 hover:bg-white/10"
                }`}
              >
                Asisten
              </button>
            )}
            {user?.role === "admin" && (
              <button
                onClick={() => setActiveTab("users")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === "users"
                    ? "bg-white text-blue-700"
                    : "text-blue-100 hover:bg-white/10"
                }`}
              >
                Pengguna
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === "events" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Event</h2>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                + Buat Event
              </button>
            </div>

            {showCreateForm && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
                <h3 className="font-semibold text-gray-900 mb-4">Event Baru</h3>
                <form
                  onSubmit={handleCreateEvent}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nama Event
                    </label>
                    <input
                      type="text"
                      value={newEvent.name}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, name: e.target.value })
                      }
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tanggal
                    </label>
                    <input
                      type="date"
                      value={newEvent.event_date}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, event_date: e.target.value })
                      }
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lokasi
                    </label>
                    <input
                      type="text"
                      value={newEvent.location}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, location: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Deskripsi
                    </label>
                    <input
                      type="text"
                      value={newEvent.description}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, description: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                    />
                  </div>
                  <div className="sm:col-span-2 flex gap-2">
                    <button
                      type="submit"
                      disabled={createLoading}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                    >
                      {createLoading ? "Membuat..." : "Buat Event"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              </div>
            )}

            {events.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
                <p className="text-lg mb-1">Belum ada event</p>
                <p className="text-sm">Buat event baru untuk mulai</p>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {ev.name}
                          </h3>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {ev.event_date}
                            {ev.location ? ` — ${ev.location}` : ""}
                          </p>
                          {user?.role === "admin" && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              PIC: {ev.pic_name}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              ev.token ? setQrEvent(ev) : handleGenerateToken(ev.id)
                            }
                            disabled={genTokenLoading === ev.id}
                            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors disabled:opacity-50"
                            title="Tampilkan QR code"
                          >
                            <svg
                              className="w-4 h-4 text-gray-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6zm-4-4h4v4h-4v-4z"
                              />
                            </svg>
                          </button>
                          <div className="text-right">
                            <p className="text-xs text-gray-400 mb-1">Token</p>
                            {ev.token ? (
                              <>
                                <span className="text-lg font-mono font-bold text-gray-900 tracking-widest">
                                  {ev.token}
                                </span>
                                <p
                                  className={`text-[11px] mt-0.5 font-medium ${
                                    countdowns[ev.id] <= 30
                                      ? "text-red-500"
                                      : countdowns[ev.id] <= 90
                                        ? "text-orange-500"
                                        : "text-green-600"
                                  }`}
                                >
                                  {countdowns[ev.id] > 0
                                    ? `Berubah dalam ${formatCountdown(countdowns[ev.id])}`
                                    : "Memperbarui..."}
                                </p>
                              </>
                            ) : (
                              <span className="text-sm text-gray-400 italic">
                                belum dibuat
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleGenerateToken(ev.id)}
                            disabled={genTokenLoading === ev.id}
                            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors disabled:opacity-50"
                            title="Generate / regenerate token"
                          >
                            {genTokenLoading === ev.id ? (
                              <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
                            ) : (
                              <svg
                                className="w-4 h-4 text-gray-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
                      <button
                        onClick={() =>
                          setSelectedEventId(
                            selectedEventId === ev.id ? null : ev.id
                          )
                        }
                        className="text-sm text-blue-600 hover:underline font-medium"
                      >
                        {selectedEventId === ev.id
                          ? "Sembunyikan Kehadiran"
                          : "Lihat Kehadiran"}
                      </button>
                    </div>

                    {selectedEventId === ev.id && (
                      <div className="border-t border-gray-100">
                        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50">
                          <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                            <p className="text-xs text-gray-500">Total</p>
                            <p className="text-2xl font-bold text-gray-900">
                              {stats.total}
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                            <p className="text-xs text-gray-500">Selesai</p>
                            <p className="text-2xl font-bold text-green-600">
                              {stats.clockedOut}
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                            <p className="text-xs text-gray-500">Bekerja</p>
                            <p className="text-2xl font-bold text-orange-500">
                              {stats.stillWorking}
                            </p>
                          </div>
                        </div>

                        {records.length === 0 ? (
                          <div className="p-8 text-center text-gray-400 text-sm">
                            Belum ada kehadiran
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left px-4 py-2 font-semibold text-gray-600">
                                    #
                                  </th>
                                  <th className="text-left px-4 py-2 font-semibold text-gray-600">
                                    ID
                                  </th>
                                  <th className="text-left px-4 py-2 font-semibold text-gray-600">
                                    Nama
                                  </th>
                                  <th className="text-left px-4 py-2 font-semibold text-gray-600">
                                    Divisi
                                  </th>
                                  <th className="text-left px-4 py-2 font-semibold text-gray-600">
                                    Masuk
                                  </th>
                                  <th className="text-left px-4 py-2 font-semibold text-gray-600">
                                    Pulang
                                  </th>
                                  <th className="text-left px-4 py-2 font-semibold text-gray-600">
                                    Durasi
                                  </th>
                                  <th className="text-left px-4 py-2 font-semibold text-gray-600">
                                    Status
                                  </th>
                                  <th className="text-left px-4 py-2 font-semibold text-gray-600">
                                    Tugas
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {records.map((r, i) => (
                                  <tr
                                    key={r.id}
                                    className="hover:bg-gray-50 transition-colors"
                                  >
                                    <td className="px-4 py-2.5 text-gray-500">
                                      {i + 1}
                                    </td>
                                    <td className="px-4 py-2.5 font-mono font-medium text-gray-900">
                                      {r.employee_id}
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-900">
                                      {r.employee_name}
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        {r.division}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5 font-mono text-gray-900">
                                      {r.clock_in}
                                    </td>
                                    <td className="px-4 py-2.5 font-mono text-gray-900">
                                      {r.clock_out || "-"}
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-600">
                                      {formatDuration(r.clock_in, r.clock_out)}
                                    </td>
                                    <td className="px-4 py-2.5">
                                      {r.clock_out ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                          Selesai
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                          Bekerja
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-600 max-w-xs truncate">
                                      {r.task || "-"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "asisten" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Asisten Saya
              </h2>
              {assistans.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-8">
                  Belum ada asisten. Tambahkan dari daftar yang tersedia.
                </div>
              ) : (
                <div className="space-y-2">
                  {assistans.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {a.name}
                        </p>
                        <p className="text-xs text-gray-400 font-mono">
                          {a.employee_id}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveAsisten(a.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-4">
                Asisten dapat menampilkan QR, generate token, dan mengelola
                kehadiran event milik Anda.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Tambah Asisten
              </h2>
              {candidates.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-8">
                  Tidak ada kandidat. Semua user sudah menjadi asisten Anda.
                </div>
              ) : (
                <div className="space-y-2">
                  {candidates.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {c.name}
                        </p>
                        <p className="text-xs text-gray-400 font-mono">
                          {c.employee_id || c.role}
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddAsisten(c.id)}
                        className="text-xs text-blue-600 hover:underline font-medium"
                      >
                        Jadikan Asisten
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                Kelola Pengguna
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Ubah role pengguna. Role "asisten" dikelola melalui tab Asisten.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-6 py-3 font-semibold text-gray-600">
                      ID
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">
                      Nama
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">
                      Role
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">
                      Event
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 font-mono text-gray-900">
                        {u.employee_id || u.username}
                      </td>
                      <td className="px-4 py-3 text-gray-900">{u.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.role === "admin"
                              ? "bg-yellow-100 text-yellow-800"
                              : u.role === "pic"
                                ? "bg-blue-100 text-blue-800"
                                : u.role === "asisten"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{u.total_events}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            value={roleDraft[u.id] ?? u.role}
                            onChange={(e) =>
                              setRoleDraft((d) => ({
                                ...d,
                                [u.id]: e.target.value,
                              }))
                            }
                            disabled={u.id === user?.id}
                            className="px-2 py-1 border border-gray-300 rounded-lg text-xs text-gray-700 disabled:opacity-50"
                          >
                            {["admin", "pic", "user"].map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleChangeRole(u.id)}
                            disabled={
                              (roleDraft[u.id] ?? u.role) === u.role ||
                              roleSaving === u.id
                            }
                            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium disabled:opacity-40 transition-colors"
                          >
                            {roleSaving === u.id ? "Menyimpan..." : "Simpan"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {qrEvent && qrEvent.token && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">QR Code Event</h3>
              <button
                onClick={() => setQrEvent(null)}
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
            <div className="text-center mb-4">
              <p className="font-semibold text-gray-900">{qrEvent.name}</p>
              <p className="text-sm text-gray-500">
                {qrEvent.event_date}
                {qrEvent.location ? ` — ${qrEvent.location}` : ""}
              </p>
            </div>
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-4 flex items-center justify-center">
              <QrDisplay eventId={qrEvent.id} token={qrEvent.token} size={220} />
            </div>
            <div className="text-center mt-4">
              <p className="text-sm text-gray-500 mb-1">Token manual 6 digit:</p>
              <p className="text-3xl font-mono font-bold tracking-[0.4em] text-gray-900">
                {qrEvent.token}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Scan QR atau masukkan token untuk clock in / clock out. Token
                berlaku 5 menit.
              </p>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={async () => {
                  await handleGenerateToken(qrEvent.id);
                  setQrEvent(null);
                }}
                disabled={genTokenLoading === qrEvent.id}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {genTokenLoading === qrEvent.id ? "Membuat..." : "Generate Token Baru"}
              </button>
              <button
                onClick={() => setQrEvent(null)}
                className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}