"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";

type ParticipantHit = {
  pid: string;
  name: string;
  email: string;
  phone: string;
  collegeName: string | null;
  status: string;
  score: number | null;
  rank: number | null;
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

export function AdminAddStudentDropdown({
  collegeName,
  excludePids,
  disabled = false,
  onAdd,
}: {
  collegeName: string;
  excludePids: string[];
  disabled?: boolean;
  onAdd: (pid: string) => Promise<void>;
}) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ParticipantHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<ParticipantHit | null>(
    null
  );
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open || confirmTarget) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open, confirmTarget]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (confirmTarget) {
        setConfirmTarget(null);
        return;
      }
      setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, confirmTarget]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setConfirmTarget(null);
      setAdding(false);
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const params = new URLSearchParams({ filter: "all", q: trimmed });
          const res = await fetch(`/api/admin/participants?${params}`);
          const body = (await res.json()) as {
            participants?: ParticipantHit[];
            error?: string;
          };
          if (!res.ok) throw new Error(body.error ?? "Search failed");
          const excluded = new Set(excludePids);
          setResults(
            (body.participants ?? [])
              .filter(
                (p) =>
                  !excluded.has(p.pid) &&
                  (p.collegeName ?? "").trim().toLowerCase() !==
                    collegeName.trim().toLowerCase()
              )
              .slice(0, 8)
          );
        } catch {
          setResults([]);
        } finally {
          setSearching(false);
        }
      })();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [open, query, collegeName, excludePids]);

  async function handleConfirmAdd() {
    if (!confirmTarget) return;
    setAdding(true);
    try {
      await onAdd(confirmTarget.pid);
      setResults((prev) => prev.filter((p) => p.pid !== confirmTarget.pid));
      setConfirmTarget(null);
      setOpen(false);
    } finally {
      setAdding(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Add student"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#0074c8]/45 bg-[#0074c8]/12 px-2.5 text-xs font-semibold text-[#75bee9] hover:bg-[#0074c8]/20 disabled:opacity-40"
      >
        Add
        <svg
          viewBox="0 0 24 24"
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
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

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Add student"
          className="absolute right-0 top-full z-30 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-white/12 bg-[#001426] p-3 shadow-xl"
        >
          {confirmTarget ? (
            <div>
              <button
                type="button"
                disabled={adding}
                onClick={() => setConfirmTarget(null)}
                className="mb-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
                Back to search
              </button>

              <p className="text-sm leading-snug text-slate-200">
                Add{" "}
                <span className="font-semibold text-white">
                  {confirmTarget.name}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-[#75bee9]">
                  {collegeName}
                </span>
                ?
              </p>

              <div className="mt-3 rounded-lg border border-white/10 bg-[rgba(0,14,28,0.72)] p-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <p className="truncate text-sm font-semibold text-white">
                    {confirmTarget.name}
                  </p>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] ${rankTone(confirmTarget.rank)}`}
                  >
                    Rank
                    <span className="font-semibold">
                      {confirmTarget.rank == null
                        ? "—"
                        : `#${confirmTarget.rank}`}
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[0.6875rem] text-slate-300">
                    Score
                    <span className="font-semibold text-white">
                      {confirmTarget.score == null ? "—" : confirmTarget.score}
                    </span>
                  </span>
                  <span
                    className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] capitalize ${statusTone(confirmTarget.status)}`}
                  >
                    {statusLabel(confirmTarget.status)}
                  </span>
                </div>

                <p className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                  <span className="truncate text-slate-400">
                    {confirmTarget.email}
                  </span>
                  {confirmTarget.phone ? (
                    <>
                      <span className="text-slate-600" aria-hidden>
                        ·
                      </span>
                      <span className="truncate text-slate-500">
                        {confirmTarget.phone}
                      </span>
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

                <div className="mt-3 border-t border-white/8 pt-3">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#6da6d3]">
                    Current college
                  </p>
                  <p
                    className={`mt-0.5 truncate text-sm ${
                      confirmTarget.collegeName
                        ? "text-slate-200"
                        : "italic text-slate-500"
                    }`}
                  >
                    {confirmTarget.collegeName || "Not assigned"}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={adding}
                  onClick={() => setConfirmTarget(null)}
                  className="rounded-lg border border-white/12 px-3 py-1.5 text-xs text-slate-300 hover:border-white/25 hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={adding}
                  onClick={() => void handleConfirmAdd()}
                  className="rounded-lg border border-[#0074c8]/45 bg-[#0074c8]/12 px-3 py-1.5 text-xs font-semibold text-[#75bee9] hover:bg-[#0074c8]/20 disabled:opacity-50"
                >
                  {adding ? "Adding…" : "Add to college"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={onSubmit}>
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name or email…"
                  className="register-input w-full text-sm"
                />
              </form>
              <div className="mt-2 max-h-52 overflow-y-auto">
                {searching && (
                  <p className="px-1 py-2 text-xs text-slate-500">
                    Searching…
                  </p>
                )}
                {!searching && query.trim() && results.length === 0 && (
                  <p className="px-1 py-2 text-xs text-slate-500">No matches</p>
                )}
                {!searching && !query.trim() && (
                  <p className="px-1 py-2 text-xs text-slate-500">
                    Type to find a student
                  </p>
                )}
                <ul className="space-y-1">
                  {results.map((hit) => (
                    <li
                      key={hit.pid}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-white/[0.04]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-white">{hit.name}</p>
                        <p className="truncate text-xs text-slate-400">
                          {hit.email}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirmTarget(hit)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#0074c8]/45 bg-[#0074c8]/12 px-2 py-1 text-[0.6875rem] font-semibold text-[#75bee9] hover:bg-[#0074c8]/20"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-3 w-3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        Add
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
