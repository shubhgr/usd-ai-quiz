"use client";

import { FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { AdminGate } from "../AdminGate";
import { AdminAddStudentDropdown } from "../AdminAddStudentDropdown";
import { AdminRowMenu } from "../AdminRowMenu";
import {
  collegesCacheKey,
  getCollegesCached,
  getCollegesSnapshot,
  setCollegesSnapshot,
  type AdminCollegeCacheRow,
} from "../adminClientCache";
import { useAdminRefresh } from "../AdminRefresh";
import { AdminStickyTools } from "../AdminStickyTools";

type CollegeListItem = AdminCollegeCacheRow;

type CollegeMember = {
  pid: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  score: number | null;
};

function AddCollegeModal({
  open,
  saving,
  error,
  onClose,
  onSave,
}: {
  open: boolean;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-4 sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-white/15 bg-[#001426] p-5 shadow-2xl"
      >
        <h2 id={titleId} className="text-lg font-semibold text-white">
          Add college
        </h2>
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || saving) return;
            void onSave(name.trim());
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="College name"
            className="register-input w-full"
            disabled={saving}
          />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 hover:border-white/30 hover:text-white disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="cta-button-gradient rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CollegesAdmin() {
  const cached = getCollegesSnapshot();
  const [searchInput, setSearchInput] = useState(
    () => cached?.searchInput ?? ""
  );
  const [activeQuery, setActiveQuery] = useState(
    () => cached?.activeQuery ?? ""
  );
  const [results, setResults] = useState<CollegeListItem[]>(
    () => cached?.results ?? []
  );
  const [hasMore, setHasMore] = useState(() => cached?.hasMore ?? false);
  const [loading, setLoading] = useState(() => !cached);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [membersByCollege, setMembersByCollege] = useState<
    Record<string, CollegeMember[]>
  >({});
  const [loadingMembersKey, setLoadingMembersKey] = useState<string | null>(
    null
  );
  const [memberActionPid, setMemberActionPid] = useState<string | null>(null);
  const [deleteCollegeTarget, setDeleteCollegeTarget] =
    useState<CollegeListItem | null>(null);
  const [deletingCollegeKey, setDeletingCollegeKey] = useState<string | null>(
    null
  );
  const searchInputRef = useRef(searchInput);
  searchInputRef.current = searchInput;

  const persistColleges = useCallback(
    (
      q: string,
      input: string,
      nextResults: CollegeListItem[],
      nextHasMore: boolean
    ) => {
      setCollegesSnapshot({
        key: collegesCacheKey(q),
        searchInput: input,
        activeQuery: q,
        results: nextResults,
        hasMore: nextHasMore,
      });
    },
    []
  );

  const loadColleges = useCallback(
    async (
      q: string,
      nextOffset: number,
      append: boolean,
      opts?: { force?: boolean; searchInputValue?: string }
    ) => {
      const key = collegesCacheKey(q);
      if (!append && !opts?.force) {
        const cachedPage = getCollegesCached(q);
        if (cachedPage) {
          const input = opts?.searchInputValue ?? searchInputRef.current;
          setResults(cachedPage.results);
          setHasMore(cachedPage.hasMore);
          setLoading(false);
          setCollegesSnapshot({
            key,
            searchInput: input,
            activeQuery: q,
            results: cachedPage.results,
            hasMore: cachedPage.hasMore,
          });
          return;
        }
      }

      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          mode: "participation",
          limit: "80",
          offset: String(nextOffset),
        });
        if (q.trim()) params.set("q", q.trim());
        const res = await fetch(`/api/admin/colleges?${params}`);
        const body = (await res.json()) as {
          results?: CollegeListItem[];
          hasMore?: boolean;
          error?: string;
        };
        if (!res.ok) throw new Error(body.error ?? "Failed to load colleges");
        const page = body.results ?? [];
        const nextHasMore = Boolean(body.hasMore);
        setHasMore(nextHasMore);
        setResults((prev) => {
          const next = append ? [...prev, ...page] : page;
          persistColleges(
            q,
            opts?.searchInputValue ?? searchInputRef.current,
            next,
            nextHasMore
          );
          return next;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load colleges");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [persistColleges]
  );

  useEffect(() => {
    void loadColleges(activeQuery, 0, false);
  }, [activeQuery, loadColleges]);

  useAdminRefresh(() =>
    loadColleges(activeQuery, 0, false, {
      force: true,
      searchInputValue: searchInputRef.current,
    })
  );

  function applyQuery(next: string) {
    const q = next.trim();
    setSearchInput(next);
    searchInputRef.current = next;
    if (q === activeQuery) return;
    // Restore instantly from cache when available (e.g. clear search → all colleges).
    const cachedPage = getCollegesCached(q);
    if (cachedPage) {
      setResults(cachedPage.results);
      setHasMore(cachedPage.hasMore);
      setLoading(false);
      setCollegesSnapshot({
        key: collegesCacheKey(q),
        searchInput: next,
        activeQuery: q,
        results: cachedPage.results,
        hasMore: cachedPage.hasMore,
      });
    }
    setActiveQuery(q);
  }

  function runSearch(e?: FormEvent) {
    e?.preventDefault();
    applyQuery(searchInput);
  }

  function onSearchInputChange(value: string) {
    setSearchInput(value);
    // Native search clear (×) should reset the list without waiting for Enter.
    if (!value.trim() && activeQuery) {
      applyQuery("");
    }
  }

  async function handleAddCollege(name: string) {
    setAdding(true);
    setAddError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/colleges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = (await res.json()) as { error?: string; name?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not add college");
      setMessage(`Added “${body.name ?? name}”`);
      setAddOpen(false);
      await loadColleges(activeQuery, 0, false, {
        force: true,
        searchInputValue: searchInput,
      });
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Could not add college");
    } finally {
      setAdding(false);
    }
  }

  async function loadCollegeMembers(collegeName: string) {
    setLoadingMembersKey(collegeName);
    try {
      const params = new URLSearchParams({ collegeName });
      const res = await fetch(`/api/admin/colleges/members?${params}`);
      const body = (await res.json()) as {
        members?: CollegeMember[];
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Failed to load students");
      setMembersByCollege((prev) => ({
        ...prev,
        [collegeName]: body.members ?? [],
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load students");
    } finally {
      setLoadingMembersKey(null);
    }
  }

  async function toggleExpanded(college: CollegeListItem) {
    const key = college.name;
    if (expandedKey === key) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(key);
    await loadCollegeMembers(key);
  }

  function startEdit(college: CollegeListItem) {
    setEditingKey(college.name);
    setEditName(college.name);
    setMessage("");
    setError("");
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditName("");
  }

  async function removeMember(collegeName: string, pid: string) {
    setMemberActionPid(pid);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/participants/${pid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collegeName: "" }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not remove student");
      await loadCollegeMembers(collegeName);
      await loadColleges(activeQuery, 0, false, {
        force: true,
        searchInputValue: searchInput,
      });
      setMessage("Student removed from college");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove student");
    } finally {
      setMemberActionPid(null);
    }
  }

  async function addMember(collegeName: string, pid: string) {
    setMessage("");
    const res = await fetch(`/api/admin/participants/${pid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collegeName }),
    });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(body.error ?? "Could not add student");
    await loadCollegeMembers(collegeName);
    await loadColleges(activeQuery, 0, false, {
      force: true,
      searchInputValue: searchInput,
    });
    setMessage("Student added to college");
  }

  async function deleteCollege(college: CollegeListItem) {
    setDeletingCollegeKey(college.name);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/admin/colleges", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: college.id ?? undefined,
          name: college.name,
        }),
      });
      const body = (await res.json()) as { error?: string; unassigned?: number };
      if (!res.ok) throw new Error(body.error ?? "Could not delete college");
      setMessage(
        body.unassigned
          ? `Deleted “${college.name}” and unassigned ${body.unassigned} student(s)`
          : `Deleted “${college.name}”`
      );
      setDeleteCollegeTarget(null);
      if (expandedKey === college.name) setExpandedKey(null);
      setMembersByCollege((prev) => {
        const next = { ...prev };
        delete next[college.name];
        return next;
      });
      await loadColleges(activeQuery, 0, false, {
        force: true,
        searchInputValue: searchInput,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete college");
    } finally {
      setDeletingCollegeKey(null);
    }
  }

  async function saveEdit(college: CollegeListItem) {
    const name = editName.trim();
    if (!name) return;
    const key = college.name;
    setSavingKey(key);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/admin/colleges", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: college.id ?? undefined,
          fromName: college.name,
          name,
        }),
      });
      const body = (await res.json()) as {
        error?: string;
        college?: { name: string; oldName: string };
      };
      if (!res.ok) throw new Error(body.error ?? "Could not rename college");
      setMessage(
        body.college && body.college.oldName !== body.college.name
          ? `Renamed “${body.college.oldName}” → “${body.college.name}”`
          : "Saved"
      );
      setEditingKey(null);
      setEditName("");
      const newName = body.college?.name ?? name;
      if (expandedKey === college.name && newName !== college.name) {
        setExpandedKey(newName);
        setMembersByCollege((prev) => {
          const next = { ...prev };
          if (next[college.name]) {
            next[newName] = next[college.name]!;
            delete next[college.name];
          }
          return next;
        });
      }
      await loadColleges(activeQuery, 0, false, {
        force: true,
        searchInputValue: searchInput,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename college");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <>
      <AdminStickyTools>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <form onSubmit={runSearch} className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </span>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => onSearchInputChange(e.target.value)}
              placeholder="Search colleges"
              className="register-input w-full pl-10"
              aria-label="Search colleges"
            />
          </form>

          <button
            type="button"
            onClick={() => {
              setAddError("");
              setAddOpen(true);
            }}
            className="cta-button-gradient shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
          >
            Add College
          </button>
        </div>
      </AdminStickyTools>

      {message && <p className="mt-3 text-sm text-[#75BEE9]">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {loading && (
        <p className="mt-4 text-sm text-slate-400">Loading colleges…</p>
      )}

      <ul className="mt-6 space-y-3">
        {results.map((college) => {
          const editing = editingKey === college.name;
          const busy = savingKey === college.name;
          const expanded = expandedKey === college.name;
          const members = membersByCollege[college.name] ?? [];
          const loadingMembers = loadingMembersKey === college.name;
          return (
            <li
              key={college.id != null ? `id-${college.id}` : college.name}
              className={`group rounded-xl border bg-[rgba(0,14,28,0.72)] transition-[border-color,background-color,box-shadow] ${
                expanded
                  ? "border-[#75bee9]/25 shadow-[0_0_0_1px_rgba(117,190,233,0.08)]"
                  : "border-white/10 hover:border-[#75bee9]/20 hover:bg-[rgba(0,18,36,0.82)]"
              }`}
            >
              {editing ? (
                <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="register-input flex-1"
                    autoFocus
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy || !editName.trim()}
                      onClick={() => void saveEdit(college)}
                      className="cta-button-gradient rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {busy ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={cancelEdit}
                      className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-300 hover:border-white/30 disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3 p-4">
                    <button
                      type="button"
                      onClick={() => void toggleExpanded(college)}
                      className="min-w-0 flex-1 text-left"
                      aria-expanded={expanded}
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        <p className="truncate text-base font-semibold text-white">
                          {college.name}
                        </p>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[0.6875rem] text-slate-300">
                          <span className="font-semibold text-white">
                            {college.participantCount}
                          </span>
                          student{college.participantCount === 1 ? "" : "s"}
                        </span>
                        <span className="inline-flex shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[0.6875rem] text-emerald-300">
                          {college.completedCount} completed
                        </span>
                      </div>
                    </button>

                    <div
                      className="flex shrink-0 items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <AdminAddStudentDropdown
                        collegeName={college.name}
                        excludePids={members.map((m) => m.pid)}
                        onAdd={async (pid) => {
                          try {
                            await addMember(college.name, pid);
                          } catch (err) {
                            setError(
                              err instanceof Error
                                ? err.message
                                : "Could not add student"
                            );
                            throw err;
                          }
                        }}
                      />
                      <AdminRowMenu
                        editLabel="Edit name"
                        deleteLabel="Delete college"
                        onEdit={() => startEdit(college)}
                        onDelete={() => setDeleteCollegeTarget(college)}
                      />
                      <button
                        type="button"
                        aria-label={expanded ? "Collapse" : "Expand"}
                        title={expanded ? "Collapse" : "Expand"}
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleExpanded(college);
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/12 text-slate-400 hover:border-white/25 hover:bg-white/[0.04] hover:text-white"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-white/8 px-4 pb-4 pt-3">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#6da6d3]">
                          Students
                          {!loadingMembers && (
                            <span className="ml-1.5 normal-case tracking-normal text-slate-400">
                              ({members.length})
                            </span>
                          )}
                        </p>
                        {!loadingMembers && members.length > 0 && (
                          <button
                            type="button"
                            onClick={() => void loadCollegeMembers(college.name)}
                            className="text-xs text-slate-500 hover:text-slate-300"
                          >
                            Refresh
                          </button>
                        )}
                      </div>

                      {loadingMembers && (
                        <ul className="space-y-2" aria-hidden>
                          {[0, 1, 2].map((i) => (
                            <li
                              key={i}
                              className="h-12 animate-pulse rounded-lg border border-white/6 bg-white/[0.03]"
                            />
                          ))}
                        </ul>
                      )}

                      {!loadingMembers && members.length === 0 && (
                        <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-sm text-slate-500">
                          No students assigned yet. Use Add above.
                        </p>
                      )}

                      {!loadingMembers && members.length > 0 && (
                        <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                          {members.map((member) => (
                            <li
                              key={member.pid}
                              className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-white">
                                  {member.name}
                                </p>
                                <p className="truncate text-xs text-slate-400">
                                  {member.email}
                                  {member.score !== null
                                    ? ` · ${member.score} pts`
                                    : ""}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={memberActionPid === member.pid}
                                onClick={() =>
                                  void removeMember(college.name, member.pid)
                                }
                                className="shrink-0 rounded-lg border border-white/12 px-2.5 py-1 text-xs text-slate-400 hover:border-red-400/40 hover:text-red-300 disabled:opacity-40"
                              >
                                {memberActionPid === member.pid
                                  ? "Removing…"
                                  : "Remove"}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>

      {!loading && results.length === 0 && (
        <p className="mt-8 text-center text-sm text-slate-500">
          {activeQuery
            ? "No colleges match that search."
            : "No colleges found."}
        </p>
      )}

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() =>
              void loadColleges(activeQuery, results.length, true)
            }
            className="rounded-lg border border-white/15 px-4 py-2.5 text-sm text-slate-300 hover:border-white/30 hover:text-white disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}

      <AddCollegeModal
        open={addOpen}
        saving={adding}
        error={addError}
        onClose={() => {
          if (!adding) setAddOpen(false);
        }}
        onSave={handleAddCollege}
      />

      {deleteCollegeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deletingCollegeKey) {
              setDeleteCollegeTarget(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-red-500/25 bg-[#001426] p-5 shadow-2xl"
          >
            <h2 className="text-lg font-semibold text-white">Delete college</h2>
            <p className="mt-3 text-sm text-slate-300">
              Delete <span className="font-semibold text-white">{deleteCollegeTarget.name}</span>?
              All {deleteCollegeTarget.participantCount} assigned student(s) will be
              unassigned. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={Boolean(deletingCollegeKey)}
                onClick={() => setDeleteCollegeTarget(null)}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 hover:border-white/30 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(deletingCollegeKey)}
                onClick={() => void deleteCollege(deleteCollegeTarget)}
                className="rounded-lg border border-red-500/50 bg-red-950/50 px-4 py-2 text-sm font-semibold text-red-200 hover:border-red-400 disabled:opacity-50"
              >
                {deletingCollegeKey === deleteCollegeTarget.name
                  ? "Deleting…"
                  : "Delete college"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function AdminCollegesPage() {
  return (
    <AdminGate section="colleges">
      <CollegesAdmin />
    </AdminGate>
  );
}
