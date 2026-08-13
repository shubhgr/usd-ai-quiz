"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import LeaderboardView from "@/components/LeaderboardView";
import { normalizeEmail, resultsUrl } from "@/lib/quizUrls";
import { resolveCredentialsByEmail, persistResolvedCredentials } from "@/lib/resolveCredentials";
import { loadSession } from "@/lib/clientSession";
import type { LeaderboardRow, MeInfo } from "@/components/LeaderboardView";
import "./leaderboard.css";

interface LeaderboardResponse {
  topEntries?: LeaderboardRow[];
  entries?: { name: string; rank: number; score: number }[];
  me?: MeInfo | null;
  error?: string;
}

const POLL_MS = 30_000;

function LeaderboardShell({
  loading = true,
  rows = [],
  me = null,
  myPid = "",
  myName = "",
  myScore = null,
  pendingName = "",
  backHref = "",
}: {
  loading?: boolean;
  rows?: LeaderboardRow[];
  me?: MeInfo | null;
  myPid?: string;
  myName?: string;
  myScore?: number | null;
  pendingName?: string;
  backHref?: string;
}) {
  return (
    <main className="lb-page relative flex w-full flex-1 flex-col">
      <LeaderboardView
        rows={rows}
        me={me}
        myPid={myPid}
        myName={myName}
        myScore={myScore}
        pendingName={pendingName}
        loading={loading}
        backHref={backHref}
      />
    </main>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={<LeaderboardShell loading />}>
      <Leaderboard />
    </Suspense>
  );
}

function Leaderboard() {
  const searchParams = useSearchParams();
  const email = normalizeEmail(searchParams.get("email") ?? "");
  const backHref = email ? resultsUrl(email) : "/";

  const [pid, setPid] = useState("");
  const [token, setToken] = useState("");
  const [myName, setMyName] = useState("");
  const [myScore, setMyScore] = useState<number | null>(null);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [me, setMe] = useState<MeInfo | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingName, setPendingName] = useState("");
  const rowsRef = useRef<LeaderboardRow[]>([]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    const local = loadSession();
    if (!email || !local || normalizeEmail(local.email) !== email) return;
    setMyName(local.name);
    setMyScore(local.score);
    if (local.completed) {
      setPendingName(local.name);
    }
    if (local.pid) setPid(local.pid);
    if (local.token) setToken(local.token);
  }, [email]);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    (async () => {
      const creds = await resolveCredentialsByEmail(email);
      if (cancelled || !creds) return;
      setPid(creds.pid);
      setToken(creds.token);
      if (creds.name) setMyName(creds.name);
      persistResolvedCredentials(creds);
    })();
    return () => {
      cancelled = true;
    };
  }, [email]);

  const loadingRef = useRef(false);

  const loadLeaderboard = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const url =
        pid && token
          ? `/api/leaderboard?limit=100&pid=${encodeURIComponent(pid)}&token=${encodeURIComponent(token)}`
          : "/api/standings?limit=100";
      const res = await fetch(url);
      const body = (await res.json()) as LeaderboardResponse;
      if (!res.ok || body.error) {
        if (res.status === 502 && rowsRef.current.length > 0) return;
        throw new Error(body.error ?? "Failed to load");
      }
      const nextRows: LeaderboardRow[] =
        body.topEntries ??
        (body.entries ?? []).map((e) => ({
          pid: `rank-${e.rank}`,
          name: e.name,
          totalScore: e.score,
          completionTimeSeconds: 0,
          completedAt: "",
        }));
      setRows(nextRows);
      setMe(body.me ?? null);
      if (body.me || nextRows.some((r) => r.pid === pid && pid)) {
        setPendingName("");
      }
      setError("");
      setReady(true);
    } catch (err) {
      if (rowsRef.current.length > 0) return;
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't load the leaderboard. Please try again."
      );
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [pid, token]);

  useEffect(() => {
    void loadLeaderboard();
    const interval = setInterval(
      loadLeaderboard,
      pendingName ? 5_000 : POLL_MS
    );
    return () => clearInterval(interval);
  }, [loadLeaderboard, pendingName]);

  return (
    <main className="lb-page relative flex w-full flex-1 flex-col">
      {error && !ready && (
        <div className="relative z-10 mx-auto mt-6 max-w-xl px-5">
          <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-4 text-center">
            <p className="text-sm text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => void loadLeaderboard()}
              disabled={loading}
              className="cta-button-gradient mt-3 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Loading…" : "Try again"}
            </button>
          </div>
        </div>
      )}

      <LeaderboardView
        rows={rows}
        me={me}
        myPid={pid}
        myName={myName}
        myScore={myScore}
        pendingName={pendingName}
        loading={loading && !ready}
        backHref={backHref}
      />
    </main>
  );
}
