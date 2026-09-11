"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Event {
  id: number;
  name: string;
  event_date: string;
  location: string;
  description: string;
  token: string | null;
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

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<{
    name: string;
    role: string;
  } | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEvent, setNewEvent] = useState({
    name: "",
    event_date: "",
    location: "",
    description: "",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [genTokenLoading, setGenTokenLoading] = useState<number | null>(null);

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

  useEffect(() => {
    Promise.all([fetchUser(), fetchEvents()]).then(() => setLoading(false));
  }, [fetchUser, fetchEvents]);

  useEffect(() => {
    if (selectedEventId) fetchRecords(selectedEventId);
  }, [selectedEventId, fetchRecords]);

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

  const handleGenerateToken = async (eventId: number) => {
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

  const filteredRecords = selectedEventId
    ? records
    : records;
  const stats = {
    total: filteredRecords.length,
    clockedOut: filteredRecords.filter((r) => r.clock_out).length,
    stillWorking: filteredRecords.filter((r) => !r.clock_out).length,
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
                      : "bg-white/20 text-white"
                  }`}
                >
                  {user?.role === "admin" ? "ADMIN" : "PIC"}
                </span>
              </div>
              <p className="text-blue-200 text-sm">
                {user?.name}
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
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
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
                      <div className="text-right">
                        <p className="text-xs text-gray-400 mb-1">Token</p>
                        {ev.token ? (
                          <span className="text-lg font-mono font-bold text-gray-900 tracking-widest">
                            {ev.token}
                          </span>
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
      </div>
    </main>
  );
}
