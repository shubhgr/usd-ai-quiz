"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminGate } from "./AdminGate";
import { AdminRowMenu } from "./AdminRowMenu";
import { AssignCollegeModal } from "./AssignCollegeModal";
import { EditParticipantNameModal } from "./EditParticipantNameModal";
import {
  getParticipantsSnapshot,
  invalidateCollegesSnapshot,
  participantsCacheKey,
  setParticipantsSnapshot,
  updateParticipantsInSnapshot,
  type AdminParticipantCacheRow,
} from "./adminClientCache";
import { useAdminRefresh } from "./AdminRefresh";
import { AdminStickyTools } from "./AdminStickyTools";

type AdminParticipant = AdminParticipantCacheRow;

type Filter = "all" | "missing" | "completed" | "completed_missing";

const filterLabel = {
  all: "All participants",
  missing: "Missing college",
  completed: "Completed",
  completed_missing: "Completed · missing college",
} as const;

const defaultCounts = {
  total: 0,
  missingCollege: 0,
  completed: 0,
  completedMissingCollege: 0,
};

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function statusTone(status: string) {
  if (status === "completed") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  }
  if (status === "in_progress") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  }
  return "border-white/10 bg-white/[0.04] text-slate-400";
}

function rankTone(rank: number | null | undefined) {
  if (rank === 1) {
    return "border-[#75bee9]/40 bg-[#0074c8]/20 text-[#75bee9]";
  }
  if (rank && rank <= 3) {
    return "border-[#75bee9]/25 bg-[#0074c8]/12 text-[#75bee9]";
  }
  return "border-white/10 bg-white/[0.04] text-slate-300";
}

function ParticipantsAdmin({ assignPid }: { assignPid?: string }) {
  const router = useRouter();
  const cached = getParticipantsSnapshot();
  const [filter, setFilter] = useState<Filter>(
    () => (cached?.filter as Filter) ?? "all"
  );
  const [query, setQuery] = useState(() => cached?.query ?? "");
  const [participants, setParticipants] = useState<AdminParticipant[]>(
    () => cached?.participants ?? []
  );
  const [counts, setCounts] = useState(
    () => cached?.counts ?? defaultCounts
  );
  const [loadingList, setLoadingList] = useState(() => !cached);
  const [listError, setListError] = useState("");

  const [assignTarget, setAssignTarget] = useState<AdminParticipant | null>(
    null
  );
  const [editTarget, setEditTarget] = useState<AdminParticipant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminParticipant | null>(
    null
  );
  const [editError, setEditError] = useState("");
  const [savingPid, setSavingPid] = useState<string | null>(null);
  const [deletingPid, setDeletingPid] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<Record<string, string>>({});

  const loadParticipants = useCallback(
    async (opts?: { force?: boolean }) => {
      const key = participantsCacheKey(filter, query);
      if (!opts?.force) {
        const snap = getParticipantsSnapshot();
        if (snap && snap.key === key) {
          setParticipants(snap.participants);
          setCounts(snap.counts);
          setLoadingList(false);
          return;
        }
      }

      setLoadingList(true);
      setListError("");
      try {
        const params = new URLSearchParams({ filter });
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(`/api/admin/participants?${params}`);
        const body = (await res.json()) as {
          participants?: AdminParticipant[];
          counts?: {
            total: number;
            missingCollege: number;
            completed: number;
            completedMissingCollege: number;
          };
          error?: string;
        };
        if (!res.ok) throw new Error(body.error ?? "Failed to load participants");
        const nextParticipants = body.participants ?? [];
        const nextCounts = body.counts ?? defaultCounts;
        setParticipants(nextParticipants);
        setCounts(nextCounts);
        setParticipantsSnapshot({
          key,
          filter,
          query,
          participants: nextParticipants,
          counts: nextCounts,
        });
      } catch (err) {
        setListError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoadingList(false);
      }
    },
    [filter, query]
  );

  useEffect(() => {
    void loadParticipants();
  }, [loadParticipants]);

  useAdminRefresh(() => loadParticipants({ force: true }));

  useEffect(() => {
    if (!assignPid) {
      setAssignTarget(null);
      return;
    }
    const found = participants.find((p) => p.pid === assignPid) ?? null;
    setAssignTarget(found);
  }, [assignPid, participants]);

  function openAssign(p: AdminParticipant) {
    setAssignTarget(p);
    router.push(`/admin/assign/${p.pid}`);
  }

  function closeAssign() {
    setAssignTarget(null);
    router.push("/admin");
  }

  async function assignCollege(pid: string, collegeName: string) {
    setSavingPid(pid);
    setRowMessage((m) => ({ ...m, [pid]: "" }));
    try {
      const res = await fetch(`/api/admin/participants/${pid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collegeName }),
      });
      const body = (await res.json()) as {
        error?: string;
        participant?: { collegeName: string | null };
      };
      if (!res.ok) throw new Error(body.error ?? "Save failed");

      const nextCollege = body.participant?.collegeName ?? null;
      setParticipants((list) => {
        const next = list.map((p) =>
          p.pid === pid ? { ...p, collegeName: nextCollege } : p
        );
        updateParticipantsInSnapshot(() => next);
        return next;
      });
      invalidateCollegesSnapshot();
      setRowMessage((m) => ({
        ...m,
        [pid]: nextCollege ? `Assigned to ${nextCollege}` : "College cleared",
      }));
      if (collegeName) {
        closeAssign();
      } else {
        setAssignTarget(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setRowMessage((m) => ({ ...m, [pid]: message }));
      throw err;
    } finally {
      setSavingPid(null);
    }
  }

  async function saveParticipantName(pid: string, name: string) {
    setSavingPid(pid);
    setEditError("");
    setRowMessage((m) => ({ ...m, [pid]: "" }));
    try {
      const res = await fetch(`/api/admin/participants/${pid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = (await res.json()) as {
        error?: string;
        participant?: { name: string };
      };
      if (!res.ok) throw new Error(body.error ?? "Save failed");

      const nextName = body.participant?.name ?? name;
      setParticipants((list) => {
        const next = list.map((p) =>
          p.pid === pid ? { ...p, name: nextName } : p
        );
        updateParticipantsInSnapshot(() => next);
        return next;
      });
      setRowMessage((m) => ({ ...m, [pid]: "Name updated" }));
      setEditTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setEditError(message);
      throw err;
    } finally {
      setSavingPid(null);
    }
  }

  async function deleteParticipant(pid: string) {
    setDeletingPid(pid);
    setRowMessage((m) => ({ ...m, [pid]: "" }));
    try {
      const res = await fetch(`/api/admin/participants/${pid}`, {
        method: "DELETE",
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Delete failed");

      setParticipants((list) => {
        const next = list.filter((p) => p.pid !== pid);
        updateParticipantsInSnapshot(() => next);
        return next;
      });
      invalidateCollegesSnapshot();
      setDeleteTarget(null);
      if (assignTarget?.pid === pid) closeAssign();
      if (editTarget?.pid === pid) setEditTarget(null);
      await loadParticipants({ force: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      setRowMessage((m) => ({ ...m, [pid]: message }));
    } finally {
      setDeletingPid(null);
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Total", counts.total],
          ["Missing college", counts.missingCollege],
          ["Completed", counts.completed],
          ["Done · no college", counts.completedMissingCollege],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-white/10 bg-[rgba(0,20,40,0.55)] px-3 py-3"
          >
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#6da6d3]">
              {label}
            </p>
            <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <AdminStickyTools>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="register-input register-select sm:max-w-xs"
          >
            {(Object.keys(filterLabel) as Filter[]).map((key) => (
              <option key={key} value={key}>
                {filterLabel[key]}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, or college"
            className="register-input flex-1"
          />
        </div>
      </AdminStickyTools>

      {listError && <p className="mt-4 text-sm text-red-300">{listError}</p>}
      {loadingList && (
        <p className="mt-4 text-sm text-slate-400">Loading participants…</p>
      )}

      {assignPid && !loadingList && !assignTarget && (
        <p className="mt-4 text-sm text-amber-200">
          Participant not found in this list. Try another filter or refresh.
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {participants.map((p) => (
          <li
            key={p.pid}
            className="group rounded-xl border border-white/10 bg-[rgba(0,14,28,0.72)] p-4 transition-[border-color,background-color,box-shadow] hover:border-[#75bee9]/20 hover:bg-[rgba(0,18,36,0.82)] hover:shadow-[0_0_0_1px_rgba(117,190,233,0.08)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <p className="truncate text-base font-semibold leading-tight text-white">
                    {p.name}
                  </p>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] ${rankTone(p.rank)}`}
                  >
                    Rank
                    <span className="font-semibold">
                      {p.rank === null || p.rank === undefined ? "—" : `#${p.rank}`}
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[0.6875rem] text-slate-300">
                    Score
                    <span className="font-semibold text-white">
                      {p.score === null ? "—" : p.score}
                    </span>
                  </span>
                  <span
                    className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] capitalize ${statusTone(p.status)}`}
                  >
                    {statusLabel(p.status)}
                  </span>
                </div>

                <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                  <span className="truncate text-slate-400">{p.email}</span>
                  {p.phone ? (
                    <>
                      <span className="text-slate-600" aria-hidden>
                        ·
                      </span>
                      <span className="truncate text-slate-500">{p.phone}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-slate-600" aria-hidden>
                        ·
                      </span>
                      <span className="text-slate-600">No phone</span>
                    </>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100">
                <AdminRowMenu
                  editLabel="Edit name"
                  deleteLabel="Delete participant"
                  disabled={savingPid === p.pid || deletingPid === p.pid}
                  onEdit={() => {
                    setEditError("");
                    setEditTarget(p);
                  }}
                  onDelete={() => setDeleteTarget(p)}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-white/8 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 sm:max-w-[55%]">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#6da6d3]">
                  College
                </p>
                <p
                  className={`mt-0.5 truncate text-sm ${
                    p.collegeName ? "text-slate-200" : "italic text-slate-500"
                  }`}
                >
                  {p.collegeName || "Not assigned"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <button
                  type="button"
                  disabled={savingPid === p.pid || deletingPid === p.pid}
                  onClick={() => openAssign(p)}
                  className={
                    p.collegeName
                      ? "rounded-lg border border-[#0074c8]/45 bg-[#0074c8]/12 px-3 py-2 text-sm font-semibold text-[#75bee9] hover:bg-[#0074c8]/20 disabled:opacity-50"
                      : "cta-button-gradient rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  }
                >
                  {p.collegeName ? "Change college" : "Assign college"}
                </button>
                <button
                  type="button"
                  disabled={
                    savingPid === p.pid || deletingPid === p.pid || !p.collegeName
                  }
                  onClick={() => void assignCollege(p.pid, "")}
                  className="rounded-lg border border-white/12 px-3 py-2 text-sm text-slate-400 hover:border-white/25 hover:text-slate-200 disabled:opacity-40"
                >
                  Clear college
                </button>
              </div>
            </div>
            {rowMessage[p.pid] && (
              <p className="mt-3 rounded-lg border border-[#75bee9]/15 bg-[#0074c8]/8 px-3 py-2 text-sm text-[#75BEE9]">
                {rowMessage[p.pid]}
              </p>
            )}
          </li>
        ))}
      </ul>

      {!loadingList && participants.length === 0 && (
        <p className="mt-8 text-center text-sm text-slate-500">
          No participants match this filter.
        </p>
      )}

      <AssignCollegeModal
        open={Boolean(assignTarget)}
        participantName={assignTarget?.name ?? ""}
        currentCollege={assignTarget?.collegeName ?? null}
        saving={Boolean(assignTarget && savingPid === assignTarget.pid)}
        onClose={() => {
          if (!savingPid) closeAssign();
        }}
        onAssign={async (collegeName) => {
          if (!assignTarget) return;
          await assignCollege(assignTarget.pid, collegeName);
        }}
      />

      <EditParticipantNameModal
        open={Boolean(editTarget)}
        participantName={editTarget?.name ?? ""}
        saving={Boolean(editTarget && savingPid === editTarget.pid)}
        error={editError}
        onClose={() => {
          if (!savingPid) {
            setEditTarget(null);
            setEditError("");
          }
        }}
        onSave={async (name) => {
          if (!editTarget) return;
          await saveParticipantName(editTarget.pid, name);
        }}
      />

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deletingPid) setDeleteTarget(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-red-500/25 bg-[#001426] p-5 shadow-2xl"
          >
            <h2 className="text-lg font-semibold text-white">Delete participant</h2>
            <p className="mt-3 text-sm text-slate-300">
              Delete <span className="font-semibold text-white">{deleteTarget.name}</span>{" "}
              ({deleteTarget.email})? This removes their registration and quiz attempt.
              This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={Boolean(deletingPid)}
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 hover:border-white/30 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(deletingPid)}
                onClick={() => void deleteParticipant(deleteTarget.pid)}
                className="rounded-lg border border-red-500/50 bg-red-950/50 px-4 py-2 text-sm font-semibold text-red-200 hover:border-red-400 disabled:opacity-50"
              >
                {deletingPid === deleteTarget.pid ? "Deleting…" : "Delete participant"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function AdminParticipantsScreen({ assignPid }: { assignPid?: string }) {
  return (
    <AdminGate section="participants">
      <ParticipantsAdmin assignPid={assignPid} />
    </AdminGate>
  );
}
