"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { questions } from "@/lib/questions";
import { loadSession, saveSession, type LocalSession } from "@/lib/clientSession";
import { flushPendingOnUnload, scheduleSync } from "@/lib/backgroundSync";
import { resultsUrl, leaderboardUrl, normalizeEmail } from "@/lib/quizUrls";
import {
  resolveCredentialsByEmail,
  persistResolvedCredentials,
} from "@/lib/resolveCredentials";
import { downloadResultPdf } from "@/lib/resultPdf";
import { showToast } from "@/lib/toast";
import { allAnswersString } from "@/lib/quizScreens";
import {
  getLeaderboardClientCache,
  setCachedRank,
  setLeaderboardClientCache,
} from "@/lib/leaderboardClientCache";
import { estimateRank, prefetchStandings } from "@/lib/rankEstimate";

const REVEAL_MS = 500;

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

interface ResultsData {
  pid: string;
  name: string;
  email: string;
  status: string;
  score: {
    totalScore: number;
    completionTimeSeconds: number;
    completedAt: string;
  } | null;
  answers: Record<string, { answer: string; isCorrect?: boolean }>;
  answeredQuestionIds: string[];
}

function localPreview(session: LocalSession, email: string): ResultsData | null {
  if (normalizeEmail(session.email) !== email) return null;
  const answersMap: ResultsData["answers"] = {};
  for (const q of questions) {
    const a = session.answers[q.id];
    if (a) answersMap[q.id] = { answer: a };
  }
  return {
    pid: session.pid,
    name: session.name,
    email: session.email,
    status: session.completed ? "completed" : "in_progress",
    score:
      session.score !== null
        ? {
            totalScore: session.score,
            completionTimeSeconds: session.completionTimeSeconds ?? 0,
            completedAt: session.completedAt ?? new Date().toISOString(),
          }
        : null,
    answers: answersMap,
    answeredQuestionIds: Object.keys(answersMap),
  };
}

export default function ResultsClient({ email }: { email: string }) {
  const [error, setError] = useState("");
  const [data, setData] = useState<ResultsData | null>(null);
  const [pid, setPid] = useState("");
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revealCard, setRevealCard] = useState(false);
  const [rank, setRank] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const session = loadSession();
    if (session?.rank) return session.rank;
    return getLeaderboardClientCache()?.myRank ?? null;
  });
  const [localTimeSeconds, setLocalTimeSeconds] = useState<number | null>(null);

  useEffect(() => {
    const flush = () => flushPendingOnUnload();
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  useEffect(() => {
    const session = loadSession();
    if (session && normalizeEmail(session.email) === email) {
      setPid(session.pid);
      setToken(session.token);
      setLocalTimeSeconds(session.completionTimeSeconds);
      setData(localPreview(session, email));
      if (session.score !== null) setRevealCard(true);
      if (session.rank) setRank(session.rank);

      if (session.score !== null && !session.rank) {
        const cached = getLeaderboardClientCache();
        if (cached?.rows.length) {
          const estimated = estimateRank(
            cached.rows,
            session.score,
            session.completionTimeSeconds ?? 0,
            session.pid
          );
          setRank(estimated);
          setCachedRank(estimated);
        }
      }
    }
    const cachedRank = getLeaderboardClientCache()?.myRank;
    if (cachedRank) setRank((r) => r ?? cachedRank);
    if (session && (!session.submitted || !session.completed)) {
      scheduleSync();
    }
    prefetchStandings();
    // Only show the results card once we have a score — never flash an empty
    // "calculating…" card after the loading screen.
    if (session?.score !== null && session?.score !== undefined) {
      const timer = window.setTimeout(() => setRevealCard(true), REVEAL_MS);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [email]);

  useEffect(() => {
    const session = loadSession();
    if (!session || normalizeEmail(session.email) !== email) return;
    if (session.score !== null) return;
    const answerStr = allAnswersString(session.answers);
    if (!answerStr || !session.pid || !session.token) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pid: session.pid,
            token: session.token,
            answers: answerStr,
          }),
        });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as {
          totalScore?: number;
          graded?: Record<string, boolean>;
        };
        const totalScore = Number(body.totalScore);
        if (Number.isNaN(totalScore)) return;
        const cur = loadSession();
        if (!cur) return;
        saveSession({ ...cur, score: totalScore });
        if (cancelled) return;
        const preview = localPreview({ ...cur, score: totalScore }, email);
        if (preview && body.graded) {
          for (const [id, ok] of Object.entries(body.graded)) {
            if (preview.answers[id]) preview.answers[id].isCorrect = ok;
          }
        }
        setData(preview);
        setRevealCard(true);
        const cached = getLeaderboardClientCache();
        if (cached?.rows.length) {
          const estimated = estimateRank(
            cached.rows,
            totalScore,
            cur.completionTimeSeconds ?? 0,
            cur.pid
          );
          setRank(estimated);
          setCachedRank(estimated);
        }
      } catch {
        // Rank polling / sheet sync still continue.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const creds = await resolveCredentialsByEmail(email);
      if (cancelled) return;
      if (!creds) {
        if (!loadSession()) {
          setError("No registration found for this email.");
        } else {
          showToast("Couldn't confirm your registration. We'll keep retrying.");
        }
        return;
      }
      setPid(creds.pid);
      setToken(creds.token);
      persistResolvedCredentials(creds);

      // One Responses-backed resume payload can fill score + rank immediately.
      if (creds.score) {
        const preview: ResultsData = {
          pid: creds.pid,
          name: creds.name,
          email: creds.email,
          status: creds.status,
          score: {
            totalScore: creds.score.totalScore,
            completionTimeSeconds: creds.score.completionTimeSeconds,
            completedAt:
              creds.score.completedAt ?? new Date().toISOString(),
          },
          answers: {},
          answeredQuestionIds: [],
        };
        if (creds.answers) {
          const raw = creds.answers.trim().toLowerCase();
          for (let i = 0; i < raw.length && i < questions.length; i++) {
            const ch = raw.charAt(i);
            if (/^[abcd]$/.test(ch)) {
              const id = questions[i].id;
              preview.answers[id] = { answer: ch };
              preview.answeredQuestionIds.push(id);
            }
          }
        }
        setData((current) => (current?.score ? current : preview));
        setLocalTimeSeconds(creds.score.completionTimeSeconds);
        setRevealCard(true);
      } else if (creds.answers && creds.answers.length > 0) {
        // Sheets hasn't written score yet — grade on Next immediately.
        try {
          const res = await fetch("/api/score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pid: creds.pid,
              token: creds.token,
              answers: creds.answers,
            }),
          });
          if (res.ok && !cancelled) {
            const body = (await res.json()) as {
              totalScore?: number;
              graded?: Record<string, boolean>;
            };
            const totalScore = Number(body.totalScore);
            if (!Number.isNaN(totalScore)) {
              const cur = loadSession();
              if (cur) saveSession({ ...cur, score: totalScore });
              const answersMap: ResultsData["answers"] = {};
              const raw = creds.answers.trim().toLowerCase();
              for (let i = 0; i < raw.length && i < questions.length; i++) {
                const ch = raw.charAt(i);
                if (/^[abcd]$/.test(ch)) {
                  const id = questions[i].id;
                  answersMap[id] = {
                    answer: ch,
                    isCorrect: body.graded?.[id],
                  };
                }
              }
              const time = cur?.completionTimeSeconds ?? 0;
              setData({
                pid: creds.pid,
                name: creds.name || cur?.name || "",
                email: creds.email,
                status: "completed",
                score: {
                  totalScore,
                  completionTimeSeconds: time,
                  completedAt: new Date().toISOString(),
                },
                answers: answersMap,
                answeredQuestionIds: Object.keys(answersMap),
              });
              setLocalTimeSeconds(time);
              setRevealCard(true);
              const cached = getLeaderboardClientCache();
              if (cached?.rows.length) {
                const estimated = estimateRank(
                  cached.rows,
                  totalScore,
                  time,
                  creds.pid
                );
                setRank(estimated);
                setCachedRank(estimated);
              }
            }
          }
        } catch {
          // Polling / sync still continue.
        }
      }
      if (creds.rank) {
        setRank(creds.rank);
        setCachedRank(creds.rank);
      }

      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [email]);

  useEffect(() => {
    if (!ready) return;
    const session = loadSession();
    if (!session) return;
    const preview = localPreview(session, email);
    if (preview) setData((current) => (current?.score ? current : preview));
  }, [email, ready]);

  useEffect(() => {
    if (!pid || !token) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function fetchRank(apiPid: string, apiToken: string) {
      try {
        const res = await fetch(
          `/api/leaderboard?limit=100&pid=${encodeURIComponent(apiPid)}&token=${encodeURIComponent(apiToken)}`
        );
        if (!res.ok) return false;
        const body = (await res.json()) as {
          me?: {
            rank?: number;
            totalScore?: number;
            completionTimeSeconds?: number;
            completedAt?: string;
          } | null;
          topEntries?: {
            pid: string;
            name: string;
            totalScore: number;
            completionTimeSeconds?: number;
            completedAt?: string;
          }[];
        };
        if (!cancelled && body.topEntries?.length) {
          setLeaderboardClientCache({
            rows: body.topEntries.map((e) => ({
              pid: e.pid,
              name: e.name,
              totalScore: e.totalScore,
              completionTimeSeconds: e.completionTimeSeconds ?? 0,
              completedAt: e.completedAt ?? "",
            })),
            me: body.me?.rank
              ? {
                  rank: body.me.rank,
                  totalScore: body.me.totalScore ?? 0,
                  completionTimeSeconds: body.me.completionTimeSeconds ?? 0,
                  completedAt: body.me.completedAt ?? "",
                }
              : null,
            myRank: body.me?.rank ?? null,
          });
        }
        if (!cancelled && body.me?.rank) {
          setRank(body.me.rank);
          setCachedRank(body.me.rank);
          const cur = loadSession();
          if (cur) saveSession({ ...cur, rank: body.me.rank });
          return true;
        }
      } catch {
        // retry
      }
      return false;
    }

    // Already have a cached rank — refresh quietly in the background.
    if (rank) {
      void fetchRank(pid, token);
      return () => {
        cancelled = true;
      };
    }

    let attempts = 0;

    async function pollRank() {
      const local = loadSession();
      if (local && (!local.registered || !local.submitted)) {
        scheduleSync();
      }
      const apiPid = local?.pid ?? pid;
      const apiToken = local?.token ?? token;
      const ranked = await fetchRank(apiPid, apiToken);
      if (!ranked && !cancelled) {
        attempts += 1;
        const delay = attempts < 6 ? 1500 : attempts < 12 ? 3000 : 6000;
        timer = setTimeout(pollRank, delay);
      }
    }

    void pollRank();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pid, token, rank]);

  const copyResultsLink = useCallback(async () => {
    const url = `${window.location.origin}${resultsUrl(email)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }, [email]);

  const goToLeaderboard = useCallback(() => {
    if (data) {
      persistResolvedCredentials(
        {
          pid: data.pid || pid,
          token,
          name: data.name,
          email: data.email,
          status: "completed",
        },
        { completed: true, submitted: Boolean(data.score), score: data.score?.totalScore ?? null }
      );
    }
    window.location.assign(leaderboardUrl(email));
  }, [data, pid, token, email]);

  const [pdfBusy, setPdfBusy] = useState(false);

  const downloadPdf = useCallback(async () => {
    if (!data?.score || pdfBusy) return;
    setPdfBusy(true);
    try {
      let answers = data.answers;
      const needsGrade = Object.values(answers).some((a) => a.isCorrect === undefined);
      if (needsGrade && pid && token) {
        const answerStr = allAnswersString(
          Object.fromEntries(
            Object.entries(answers).map(([id, a]) => [id, a.answer])
          )
        );
        const res = await fetch("/api/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pid, token, answers: answerStr }),
        });
        if (res.ok) {
          const body = (await res.json()) as {
            graded?: Record<string, boolean>;
          };
          if (body.graded) {
            answers = { ...answers };
            for (const [id, ok] of Object.entries(body.graded)) {
              if (answers[id]) answers[id] = { ...answers[id], isCorrect: ok };
            }
            setData((prev) => (prev ? { ...prev, answers } : prev));
          }
        }
      }
      await downloadResultPdf({
        pid: data.pid,
        name: data.name,
        email: data.email,
        score: data.score,
        answers,
      });
    } finally {
      setPdfBusy(false);
    }
  }, [data, pdfBusy, pid, token]);

  if (error) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Couldn&apos;t load results</h1>
          <p className="mt-3 text-slate-400">{error}</p>
          <Link
            href="/"
            className="cta-button-gradient mt-6 inline-block rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
          >
            Go to registration
          </Link>
        </div>
      </main>
    );
  }

  if (!revealCard || !data?.score) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-2 border-[#75BEE9]/30 border-t-[#75BEE9]" />
          <h1 className="text-2xl font-bold">Calculating your score…</h1>
          <p className="mt-3 text-slate-400">
            Scoring your answers. This usually takes a few seconds.
          </p>
        </div>
      </main>
    );
  }

  const displayName = data.name ?? "";
  const score = data.score;
  const timeSeconds = score.completionTimeSeconds ?? localTimeSeconds;
  const pct = Math.round((score.totalScore / questions.length) * 100);

  return (
    <main className="relative mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-5 py-10 sm:px-6 sm:py-14">
      <div className="pointer-events-none absolute -top-20 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#0074C8]/20 blur-[120px]" />

      <div className="results-card relative w-full overflow-hidden rounded-3xl p-8 sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#75BEE9]/10 blur-3xl" />

        <div className="relative text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0074C8]/25 ring-1 ring-[#75BEE9]/30">
            <svg
              className="h-7 w-7 text-[#75BEE9]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              />
            </svg>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#75BEE9]">
            Assessment complete
          </p>
          <h1 className="mt-2 text-xl font-bold text-white sm:text-2xl">
            {displayName ? `${displayName}, you're done!` : "You're done!"}
          </h1>
        </div>

        <div className="results-you-card relative mt-8">
          <span className="results-you-name" title={displayName || email}>
            {displayName || email}
          </span>
          <span className={rank ? "results-you-rank" : "results-calculating"}>
            {rank ? `#${rank}` : "updating…"}
          </span>
        </div>

        <div className="relative mt-8 text-center">
          <p className="results-score-value text-7xl font-extrabold leading-none tracking-tight sm:text-8xl">
            {score.totalScore}
            <span className="text-3xl font-semibold text-slate-500 sm:text-4xl">
              /{questions.length}
            </span>
          </p>
          <p className="mt-3 text-sm text-slate-400">{pct}% correct</p>
        </div>

        <div className="relative mt-8 grid grid-cols-2 gap-3">
          <div className="results-stat-pill rounded-xl px-4 py-3 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Time
            </p>
            <p className="mt-1 text-base font-semibold text-white">
              {timeSeconds != null ? formatDuration(timeSeconds) : "—"}
            </p>
          </div>
          <div className="results-stat-pill rounded-xl px-4 py-3 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Rank
            </p>
            <p className={`mt-1 text-base font-semibold ${rank ? "text-white" : "results-calculating"}`}>
              {rank ? `#${rank}` : "updating…"}
            </p>
          </div>
        </div>

        <div className="relative mt-8 space-y-3">
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={!score || pdfBusy}
            className="cta-button-gradient flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {pdfBusy ? "Preparing PDF…" : score ? "Download PDF result" : "PDF available after score"}
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={goToLeaderboard}
              className="results-btn-secondary flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white"
            >
              <svg
                className="h-4 w-4 text-[#75BEE9]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Leaderboard
            </button>
            <button
              type="button"
              onClick={() => void copyResultsLink()}
              className={`results-btn-secondary flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white ${copied ? "results-btn-copied" : ""}`}
            >
              {copied ? (
                <>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4 text-[#75BEE9]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Copy link
                </>
              )}
            </button>
          </div>
        </div>

        <p className="relative mt-6 text-center text-xs text-slate-500">
          Full question breakdown is included in your PDF download.
        </p>
      </div>
    </main>
  );
}
