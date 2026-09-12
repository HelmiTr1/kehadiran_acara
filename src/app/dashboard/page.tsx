"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import * as XLSX from "xlsx";
import { notifyAuthLogout, useOnAuthLogout } from "@/lib/auth-sync";
import { useToast } from "@/lib/useToast";
import ToastContainer from "@/components/Toast";
import ConfirmModal from "@/components/ConfirmModal";

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
  user_id: number;
  division_name: string | null;
  division_id: number | null;
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
  ip: string;
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

interface Division {
  id: number;
  name: string;
  total_events: number;
}

type Tab = "events" | "asisten" | "users" | "divisi" | "rekap";

interface SummaryUser {
  employee_id: string;
  employee_name: string;
  division: string;
  event_count: number;
  total_seconds: number;
  active_count: number;
  events: {
    event_id: number;
    event_name: string;
    event_date: string;
    clock_ins: number;
    clock_outs: number;
    seconds: number;
  }[];
}

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
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("events");
  const [usersLoading, setUsersLoading] = useState(false);
  const [asistenLoading, setAsistenLoading] = useState(false);
  const [divisionsLoading, setDivisionsLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<SummaryUser[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEvent, setNewEvent] = useState({
    name: "",
    event_date: "",
    location: "",
    description: "",
    division_id: "" as string,
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [genTokenLoading, setGenTokenLoading] = useState<number | null>(null);
  const [countdowns, setCountdowns] = useState<Record<number, number>>({});
  const autoRegenedFor = useRef<Record<number, string>>({});

  const [qrEvent, setQrEvent] = useState<Event | null>(null);

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [newDivName, setNewDivName] = useState("");
  const [editDiv, setEditDiv] = useState<{ id: number; name: string } | null>(null);
  const [editDivName, setEditDivName] = useState("");
  const [divLoading, setDivLoading] = useState(false);

  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [editEventData, setEditEventData] = useState({
    name: "",
    event_date: "",
    location: "",
    description: "",
    division_id: "" as string,
    pic_id: "" as string,
  });
  const [editEventLoading, setEditEventLoading] = useState(false);

  const [assistans, setAssistans] = useState<Asisten[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pics, setPics] = useState<AdminUser[]>([]);
  const [roleDraft, setRoleDraft] = useState<Record<number, string>>({});
  const [roleSaving, setRoleSaving] = useState<number | null>(null);
  const [deletingUser, setDeletingUser] = useState<number | null>(null);
  const [resetTarget, setResetTarget] = useState<{
    id: number;
    name: string;
    employee_id: string | null;
  } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: React.ReactNode;
    confirmLabel: string;
    action: () => void;
  } | null>(null);
  const [editRecord, setEditRecord] = useState<Attendance | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [recordSaving, setRecordSaving] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<number | null>(null);
  const { toasts, success, error, dismiss } = useToast();

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (!res.ok) {
        router.push("/login");
        return;
      }
      if (data.user?.role === "user") {
        router.replace("/");
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
    setRecordsLoading(true);
    try {
      const params = new URLSearchParams();
      if (eventId) params.set("event_id", String(eventId));
      const res = await fetch(`/api/records?${params.toString()}`);
      const data = await res.json();
      if (data.success) setRecords(data.data);
    } catch {
      /* noop */
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  const fetchAsisten = useCallback(async () => {
    setAsistenLoading(true);
    try {
      const res = await fetch("/api/asisten");
      const data = await res.json();
      if (data.success) {
        setAssistans(data.assistans);
        setCandidates(data.candidates);
      }
    } catch {
      /* noop */
    } finally {
      setAsistenLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.success) setUsers(data.data);
    } catch {
      /* noop */
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const fetchPics = useCallback(async () => {
    try {
      const res = await fetch("/api/users?role=pic");
      const data = await res.json();
      if (data.success) setPics(data.data);
    } catch {
      /* noop */
    }
  }, []);

  const fetchDivisions = useCallback(async () => {
    setDivisionsLoading(true);
    try {
      const res = await fetch("/api/divisions");
      const data = await res.json();
      if (data.success) setDivisions(data.data);
    } catch {
      /* noop */
    } finally {
      setDivisionsLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/summary");
      const data = await res.json();
      if (data.success) setSummaryData(data.data);
    } catch {
      /* noop */
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchUser(), fetchEvents()]).then(() => setLoading(false));
    fetchDivisions();
  }, [fetchUser, fetchEvents, fetchDivisions]);

  useEffect(() => {
    if (user?.role === "admin") fetchPics();
  }, [user, fetchPics]);

  useEffect(() => {
    if (selectedEventId && user?.role !== "asisten") fetchRecords(selectedEventId);
  }, [selectedEventId, user?.role, fetchRecords]);

  useEffect(() => {
    if (activeTab === "asisten") fetchAsisten();
    if (activeTab === "users") fetchUsers();
    if (activeTab === "divisi") fetchDivisions();
    if (activeTab === "rekap") fetchSummary();
  }, [activeTab, fetchAsisten, fetchUsers, fetchDivisions, fetchSummary]);

  useOnAuthLogout(() => {
    setUser(null);
    router.push("/login");
  });

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    notifyAuthLogout();
    router.push("/login");
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newEvent.name,
          event_date: newEvent.event_date,
          location: newEvent.location,
          description: newEvent.description,
          division_id: newEvent.division_id ? Number(newEvent.division_id) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      success("Event berhasil dibuat");
      setNewEvent({ name: "", event_date: "", location: "", description: "", division_id: "" });
      setShowCreateForm(false);
      await fetchEvents();
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Gagal membuat event");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleGenerateToken = useCallback(
    async (eventId: number) => {
      setGenTokenLoading(eventId);
      try {
        const res = await fetch("/api/tokens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_id: eventId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        await fetchEvents();
      } catch (err: unknown) {
        error(err instanceof Error ? err.message : "Gagal membuat token");
      } finally {
        setGenTokenLoading(null);
      }
    },
    [fetchEvents, error]
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

  useEffect(() => {
    if (!qrEvent) return;
    const fresh = events.find((e) => e.id === qrEvent.id);
    if (fresh && fresh.token !== qrEvent.token) {
      setQrEvent(fresh);
    }
  }, [events, qrEvent]);

  const handleAddAsisten = async (userId: number) => {
    try {
      const res = await fetch("/api/asisten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistant_user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      success("Asisten berhasil ditambahkan");
      await fetchAsisten();
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Gagal menambahkan asisten");
    }
  };

  const handleRemoveAsisten = async (userId: number) => {
    try {
      const res = await fetch("/api/asisten", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistant_user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      success("Asisten berhasil dihapus");
      await fetchAsisten();
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Gagal menghapus asisten");
    }
  };

  const handleChangeRole = async (userId: number) => {
    const role = roleDraft[userId];
    if (!role) return;
    setRoleSaving(userId);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      success(`Role user diubah menjadi ${role}`);
      await fetchUsers();
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Gagal mengubah role");
    } finally {
      setRoleSaving(null);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setResetLoading(true);
    try {
      const res = await fetch("/api/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: resetTarget.id,
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResetTarget(null);
      setNewPassword("");
      success(`Password ${resetTarget.name} berhasil direset`);
    } catch (err: unknown) {
      error(
        err instanceof Error ? err.message : "Gagal mereset password"
      );
    } finally {
      setResetLoading(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    setDeletingUser(userId);
    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      success("User berhasil dihapus");
      await fetchUsers();
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Gagal menghapus user");
    } finally {
      setDeletingUser(null);
    }
  };

  const handleAddDivision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDivName.trim()) return;
    setDivLoading(true);
    try {
      const res = await fetch("/api/divisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDivName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      success("Divisi berhasil ditambahkan");
      setNewDivName("");
      await fetchDivisions();
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Gagal menambahkan divisi");
    } finally {
      setDivLoading(false);
    }
  };

  const handleEditDivision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDiv || !editDivName.trim()) return;
    setDivLoading(true);
    try {
      const res = await fetch("/api/divisions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editDiv.id, name: editDivName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      success("Divisi berhasil diperbarui");
      setEditDiv(null);
      setEditDivName("");
      await fetchDivisions();
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Gagal memperbarui divisi");
    } finally {
      setDivLoading(false);
    }
  };

  const handleDeleteDivision = async (id: number) => {
    try {
      const res = await fetch("/api/divisions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      success("Divisi berhasil dihapus");
      await fetchDivisions();
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Gagal menghapus divisi");
    }
  };

  const handleEditEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEvent) return;
    setEditEventLoading(true);
    try {
      const res = await fetch("/api/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editEvent.id,
          name: editEventData.name,
          event_date: editEventData.event_date,
          location: editEventData.location,
          description: editEventData.description,
          division_id: editEventData.division_id
            ? Number(editEventData.division_id)
            : null,
          user_id: user?.role === "admin" && editEventData.pic_id
            ? Number(editEventData.pic_id)
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      success("Event berhasil diperbarui");
      setEditEvent(null);
      await fetchEvents();
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Gagal memperbarui event");
    } finally {
      setEditEventLoading(false);
    }
  };

  const openEditEvent = (ev: Event) => {
    setEditEvent(ev);
    setEditEventData({
      name: ev.name,
      event_date: ev.event_date,
      location: ev.location,
      description: ev.description,
      division_id: ev.division_id ? String(ev.division_id) : "",
      pic_id: ev.user_id ? String(ev.user_id) : "",
    });
  };

  const handleDeleteEvent = async (ev: Event) => {
    try {
      const res = await fetch("/api/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ev.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      success("Event berhasil dihapus");
      if (selectedEventId === ev.id) setSelectedEventId(null);
      await fetchEvents();
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Gagal menghapus event");
    }
  };

  const openEditRecord = (r: Attendance) => {
    setEditRecord(r);
    setEditClockIn(r.clock_in);
    setEditClockOut(r.clock_out || "");
  };

  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRecord) return;
    setRecordSaving(true);
    try {
      const res = await fetch("/api/records", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editRecord.id,
          clock_in: editClockIn,
          clock_out: editClockOut,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      success("Jam kehadiran berhasil diperbarui");
      setEditRecord(null);
      if (selectedEventId) await fetchRecords(selectedEventId);
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Gagal memperbarui jam");
    } finally {
      setRecordSaving(false);
    }
  };

  const handleDeleteRecord = async (r: Attendance) => {
    setDeletingRecord(r.id);
    try {
      const res = await fetch("/api/records", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      success("Data kehadiran berhasil dihapus");
      if (selectedEventId) await fetchRecords(selectedEventId);
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : "Gagal menghapus data");
    } finally {
      setDeletingRecord(null);
    }
  };

  const askDeleteRecord = (r: Attendance) => {
    setConfirmState({
      title: "Hapus Data Kehadiran",
      message: (
        <>
          Yakin ingin menghapus kehadiran{" "}
          <span className="font-semibold">{r.employee_name}</span> (ID{" "}
          {r.employee_id}) pada {r.date}? Data ini akan hilang permanen.
        </>
      ),
      confirmLabel: "Hapus",
      action: () => handleDeleteRecord(r),
    });
  };

  const formatDuration = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return "-";
    const [inH, inM, inS] = clockIn.split(":").map(Number);
    const [outH, outM, outS] = clockOut.split(":").map(Number);
    const crossed =
      outH * 3600 + outM * 60 + outS < inH * 3600 + inM * 60 + inS;
    const diff =
      outH * 3600 + outM * 60 + outS -
      (inH * 3600 + inM * 60 + inS) +
      (crossed ? 24 * 3600 : 0);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    return `${h}j ${m}m${crossed ? " (+1hr)" : ""}`;
  };

  const formatHours = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    if (h === 0 && m === 0) return `${s}dtk`;
    if (h === 0) return `${m}m ${s}dtk`;
    return `${h}j ${m}m`;
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const handleExportExcel = (eventId: number) => {
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;
    const data = records.map((r, i) => ({
      "No.": i + 1,
      "ID Karyawan": r.employee_id,
      Nama: r.employee_name,
      Divisi: r.division,
      Tanggal: r.date,
      "Jam Masuk": r.clock_in,
      "Jam Pulang": r.clock_out || "",
      Durasi: formatDuration(r.clock_in, r.clock_out),
      Status: r.clock_out ? "Selesai" : "Bekerja",
      IP: r.ip || "",
      Tugas: r.task || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 5 },
      { wch: 15 },
      { wch: 20 },
      { wch: 14 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 15 },
      { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kehadiran");
    XLSX.writeFile(wb, `Kehadiran_${ev.name.replace(/\s+/g, "_")}_${ev.event_date}.xlsx`);
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
            {(user?.role === "pic" || user?.role === "admin") && (
              <button
                onClick={() => setActiveTab("rekap")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === "rekap"
                    ? "bg-white text-blue-700"
                    : "text-blue-100 hover:bg-white/10"
                }`}
              >
                Rekap Jam
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
            {user?.role === "admin" && (
              <button
                onClick={() => setActiveTab("divisi")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === "divisi"
                    ? "bg-white text-blue-700"
                    : "text-blue-100 hover:bg-white/10"
                }`}
              >
                Divisi
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Divisi
                    </label>
                    <select
                      value={newEvent.division_id}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, division_id: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                    >
                      <option value="">Pilih Divisi</option>
                      {divisions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
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
                          {ev.division_name && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              {ev.division_name}
                            </span>
                          )}
                          {user?.role === "admin" && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              PIC: {ev.pic_name}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {(user?.role === "admin" ||
                            user?.id === ev.user_id) && (
                            <>
                              <button
                                onClick={() => openEditEvent(ev)}
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                                title="Edit event"
                              >
                                <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() =>
                                  setConfirmState({
                                    title: "Hapus Event",
                                    message: (
                                      <>
                                        Yakin ingin menghapus event{" "}
                                        <span className="font-semibold">
                                          "{ev.name}"
                                        </span>
                                        ? Semua kehadiran terkait akan ikut
                                        terhapus.
                                      </>
                                    ),
                                    confirmLabel: "Hapus",
                                    action: () => handleDeleteEvent(ev),
                                  })
                                }
                                className="p-2 bg-red-50 hover:bg-red-100 rounded-lg text-sm transition-colors"
                                title="Hapus event"
                              >
                                <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
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

                    <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 flex items-center justify-between">
                      {user?.role !== "asisten" && (
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
                    )}
                    {selectedEventId === ev.id && records.length > 0 && user?.role !== "asisten" && (
                        <button
                          onClick={() => handleExportExcel(ev.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-medium rounded-lg transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Export Excel
                        </button>
                      )}
                    </div>

                    {selectedEventId === ev.id && user?.role !== "asisten" && (
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

                        {recordsLoading ? (
                        <div className="p-8 text-center text-gray-400 text-sm">
                          <div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mb-2"></div>
                          <p>Memuat kehadiran...</p>
                        </div>
                      ) : records.length === 0 ? (
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
                                    Tanggal
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
                                    IP
                                  </th>
                                  <th className="text-left px-4 py-2 font-semibold text-gray-600">
                                    Tugas
                                  </th>
                                  {user?.role === "admin" && (
                                    <th className="text-left px-4 py-2 font-semibold text-gray-600">
                                      Aksi
                                    </th>
                                  )}
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
                                    <td className="px-4 py-2.5 font-mono text-gray-500">
                                      {r.date}
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
                                    <td className="px-4 py-2.5 font-mono text-gray-500">
                                      {r.ip || "-"}
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-600 max-w-xs truncate">
                                      {r.task || "-"}
                                    </td>
                                    {user?.role === "admin" && (
                                      <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            onClick={() => openEditRecord(r)}
                                            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium transition-colors"
                                            title="Ubah jam kehadiran"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={() => askDeleteRecord(r)}
                                            disabled={deletingRecord === r.id}
                                            className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium transition-colors disabled:opacity-40"
                                            title="Hapus data kehadiran"
                                          >
                                            {deletingRecord === r.id
                                              ? "Menghapus..."
                                              : "Hapus"}
                                          </button>
                                        </div>
                                      </td>
                                    )}
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

        {activeTab === "rekap" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Total Jam Kerja per User
              </h2>
              <p className="text-xs text-gray-400">
                Durasi dijumlah otomatis lintas semua event (termasuk lintas
                tengah malam).
              </p>
            </div>
            {summaryLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm">Menghitung rekap...</p>
                </div>
              </div>
            ) : summaryData.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-8">
                Belum ada data kehadiran.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left px-4 py-2 font-semibold text-gray-600">#</th>
                      <th className="text-left px-4 py-2 font-semibold text-gray-600">ID Karyawan</th>
                      <th className="text-left px-4 py-2 font-semibold text-gray-600">Nama</th>
                      <th className="text-left px-4 py-2 font-semibold text-gray-600">Divisi</th>
                      <th className="text-left px-4 py-2 font-semibold text-gray-600">Event</th>
                      <th className="text-left px-4 py-2 font-semibold text-gray-600">Total Jam</th>
                      {user?.role === "admin" && (
                        <th className="text-left px-4 py-2 font-semibold text-gray-600">Rincian</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {summaryData.map((u, i) => (
                      <Fragment key={u.employee_id}>
                        <tr key={u.employee_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5 text-gray-500">{i + 1}</td>
                          <td className="px-4 py-2.5 font-mono font-medium text-gray-900">
                            {u.employee_id}
                          </td>
                          <td className="px-4 py-2.5 text-gray-900">
                            {u.employee_name}
                            {u.active_count > 0 && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                {u.active_count} bekerja
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {u.division || "-"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-600">
                            {u.event_count} event
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-gray-900">
                            {formatHours(u.total_seconds)}
                          </td>
                          {user?.role === "admin" && (
                            <td className="px-4 py-2.5">
                              <button
                                onClick={() =>
                                  setExpandedUser(
                                    expandedUser === u.employee_id
                                      ? null
                                      : u.employee_id
                                  )
                                }
                                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium transition-colors"
                              >
                                {expandedUser === u.employee_id ? "Tutup" : "Detail"}
                              </button>
                            </td>
                          )}
                        </tr>
                        {expandedUser === u.employee_id && user?.role === "admin" && (
                          <tr key={`${u.employee_id}-detail`} className="bg-gray-50">
                            <td colSpan={7} className="px-4 py-3">
                              <div className="space-y-1.5">
                                {u.events.map((e) => (
                                  <div
                                    key={e.event_id}
                                    className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-xs"
                                  >
                                    <div>
                                      <span className="font-medium text-gray-800">
                                        {e.event_name}
                                      </span>
                                      <span className="text-gray-400 ml-2">
                                        {e.event_date}
                                      </span>
                                    </div>
                                    <div className="text-gray-600">
                                      {e.clock_ins}x ({e.clock_outs} selesai) —{" "}
                                      <b className="text-gray-900">
                                        {formatHours(e.seconds)}
                                      </b>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "asisten" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Asisten Saya
              </h2>
              {asistenLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm">Memuat asisten...</p>
                  </div>
                </div>
              ) : assistans.length === 0 ? (
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
              {asistenLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm">Memuat kandidat...</p>
                  </div>
                </div>
              ) : candidates.length === 0 ? (
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
              {usersLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm">Memuat pengguna...</p>
                  </div>
                </div>
              ) : (
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
                          <button
                            onClick={() => {
                              setResetTarget({
                                id: u.id,
                                name: u.name,
                                employee_id: u.employee_id,
                              });
                              setNewPassword("");
                            }}
                            className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium transition-colors"
                            title="Reset password user"
                          >
                            Reset PW
                          </button>
                          <button
                            onClick={() =>
                              setConfirmState({
                                title: "Hapus User",
                                message: (
                                  <>
                                    Yakin ingin menghapus user{" "}
                                    <span className="font-semibold">
                                      {u.name}
                                    </span>{" "}
                                    ({u.employee_id || u.username})? Semua data
                                    terkait akan ikut terhapus.
                                  </>
                                ),
                                confirmLabel: "Hapus",
                                action: () => handleDeleteUser(u.id),
                              })
                            }
                            disabled={
                              u.id === user?.id || deletingUser === u.id
                            }
                            className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium disabled:opacity-40 transition-colors"
                            title="Hapus user"
                          >
                            {deletingUser === u.id ? "Menghapus..." : "Hapus"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          </div>
        )}
      {activeTab === "divisi" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Kelola Divisi</h2>
              <p className="text-xs text-gray-400 mt-1">Tambah, ubah, atau hapus divisi yang tersedia.</p>
            </div>
            <div className="p-6">
              <form onSubmit={handleAddDivision} className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={newDivName}
                  onChange={(e) => setNewDivName(e.target.value)}
                  placeholder="Nama divisi baru"
                  required
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                />
                <button
                  type="submit"
                  disabled={divLoading || !newDivName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-40 transition-colors"
                >
                  {divLoading ? "Menyimpan..." : "Tambah"}
                </button>
              </form>
              {divisionsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm">Memuat divisi...</p>
                  </div>
                </div>
              ) : divisions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Belum ada divisi</p>
              ) : (
                <div className="space-y-2">
                  {divisions.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg"
                    >
                      {editDiv?.id === d.id ? (
                        <form
                          onSubmit={handleEditDivision}
                          className="flex items-center gap-2 flex-1"
                        >
                          <input
                            type="text"
                            value={editDivName}
                            onChange={(e) => setEditDivName(e.target.value)}
                            autoFocus
                            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          />
                          <button
                            type="submit"
                            disabled={divLoading || !editDivName.trim()}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium disabled:opacity-40 transition-colors"
                          >
                            {divLoading ? "..." : "Simpan"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditDiv(null)}
                            className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                          >
                            Batal
                          </button>
                        </form>
                      ) : (
                        <>
                          <div>
                            <span className="font-medium text-gray-900">{d.name}</span>
                            <span className="ml-2 text-xs text-gray-400">{d.total_events} event</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditDiv({ id: d.id, name: d.name });
                                setEditDivName(d.name);
                              }}
                              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium transition-colors"
                              title="Ubah nama divisi"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() =>
                                setConfirmState({
                                  title: "Hapus Divisi",
                                  message: (
                                    <>
                                      Yakin ingin menghapus divisi{" "}
                                      <span className="font-semibold">
                                        {d.name}
                                      </span>
                                      ?
                                    </>
                                  ),
                                  confirmLabel: "Hapus",
                                  action: () => handleDeleteDivision(d.id),
                                })
                              }
                              disabled={d.total_events > 0}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium disabled:opacity-40 transition-colors"
                              title={d.total_events > 0 ? "Masih dipakai oleh event" : "Hapus divisi"}
                            >
                              Hapus
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {editEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Edit Event</h3>
              <button
                onClick={() => setEditEvent(null)}
                className="p-2 text-gray-400 hover:text-gray-600"
                aria-label="Tutup"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEditEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Event</label>
                <input
                  type="text"
                  value={editEventData.name}
                  onChange={(e) => setEditEventData({ ...editEventData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                <input
                  type="date"
                  value={editEventData.event_date}
                  onChange={(e) => setEditEventData({ ...editEventData, event_date: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi</label>
                <input
                  type="text"
                  value={editEventData.location}
                  onChange={(e) => setEditEventData({ ...editEventData, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                <input
                  type="text"
                  value={editEventData.description}
                  onChange={(e) => setEditEventData({ ...editEventData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Divisi</label>
                <select
                  value={editEventData.division_id}
                  onChange={(e) => setEditEventData({ ...editEventData, division_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                >
                  <option value="">Pilih Divisi</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              {user?.role === "admin" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PIC (Transfer / Ganti)
                  </label>
                  <select
                    value={editEventData.pic_id}
                    onChange={(e) => setEditEventData({ ...editEventData, pic_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                  >
                    <option value="">Pilih PIC</option>
                    {pics.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.employee_id ? ` (${p.employee_id})` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Pilih PIC lain untuk mentransfer event ini ke PIC baru (hanya admin).
                  </p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={editEventLoading}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  {editEventLoading ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditEvent(null)}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Reset Password</h3>
              <button
                onClick={() => setResetTarget(null)}
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
            <div className="mb-4 bg-gray-50 rounded-xl p-3">
              <p className="text-sm font-medium text-gray-900">
                {resetTarget.name}
              </p>
              <p className="text-xs text-gray-400 font-mono">
                {resetTarget.employee_id}
              </p>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password Baru
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoFocus
              placeholder="Minimal 6 karakter"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900"
            />
            <p className="text-xs text-gray-400 mt-2">
              User bisa login dengan password baru. Sesi aktif mereka tetap
              berlaku otomatis.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={handleResetPassword}
                disabled={newPassword.length < 6 || resetLoading}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-40 transition-colors"
              >
                {resetLoading ? "Merreset..." : "Reset Password"}
              </button>
              <button
                onClick={() => setResetTarget(null)}
                className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

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
              <p className="text-xs text-gray-500 mt-1">
                Token baru otomatis dibuat dalam {countdowns[qrEvent.id] ?? 0} detik
              </p>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={async () => {
                  await handleGenerateToken(qrEvent.id);
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

      {confirmState && (
        <ConfirmModal
          open
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          loading={deletingUser !== null || deletingRecord !== null}
          onConfirm={() => {
            const { action } = confirmState;
            setConfirmState(null);
            action();
          }}
          onCancel={() => setConfirmState(null)}
        />
      )}

      {editRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Ubah Jam Kehadiran</h3>
              <button
                onClick={() => setEditRecord(null)}
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
            <p className="text-sm text-gray-700 mb-4">
              {editRecord.employee_name} (ID {editRecord.employee_id}) —{" "}
              {editRecord.date}
            </p>
            <form onSubmit={handleUpdateRecord} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jam Masuk
                </label>
                <input
                  type="time"
                  value={editClockIn}
                  onChange={(e) => setEditClockIn(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jam Pulang
                </label>
                <input
                  type="time"
                  value={editClockOut}
                  onChange={(e) => setEditClockOut(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Kosongkan untuk menandai masih bekerja.
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={recordSaving}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  {recordSaving ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditRecord(null)}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </main>
  );
}