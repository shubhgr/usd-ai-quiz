"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { COMPETITION_NAME } from "@/lib/config";

interface LeaderboardRow {
  name: string;
  totalScore: number;
  completionTimeSeconds: number;
  completedAt: string;
}

const POLL_MS = 10_000;

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/leaderboard?limit=20");
        const body = (await res.json()) as LeaderboardRow[] | { error?: string };
        if (!res.ok) {
          throw new Error("error" in body ? (body.error ?? "Failed to load") : "Failed to load");
        }
        if (!cancelled) setRows(body as LeaderboardRow[]);
      } catch {
        if (!cancelled) setError("Couldn't load the leaderboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m === 0 ? `${s}s` : `${m}m ${s}s`;
  };

  const rankLabel = (i: number) =>
    i === 0 ? "1st" : i === 1 ? "2nd" : i === 2 ? "3rd" : `${i + 1}th`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          {COMPETITION_NAME} — top scores. Ties are broken by faster time.
        </p>
      </header>

      {loading && (
        <p className="text-center text-neutral-500">Loading leaderboard…</p>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
              No scores yet. Be the first to finish!
            </div>
          ) : (
            <ol className="space-y-2">
              {rows.map((row, i) => (
                <li
                  key={`${row.name}-${row.completedAt}`}
                  className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <span className="w-12 shrink-0 text-center">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        i === 0
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          : i === 1
                            ? "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                            : i === 2
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                              : "bg-transparent text-neutral-500 dark:text-neutral-400"
                      }`}
                    >
                      {rankLabel(i)}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{row.name}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Finished {new Date(row.completedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                      {row.totalScore}
                      <span className="text-xs font-medium text-neutral-400">
                        {" "}
                        / 15
                      </span>
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {formatDuration(row.completionTimeSeconds)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      <div className="mt-8 text-center">
        <Link
          href="/register"
          className="inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Take the challenge
        </Link>
      </div>
    </main>
  );
}
