"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadSession, saveSession, clearSession } from "@/lib/clientSession";
import { scheduleSync, flushPendingOnUnload } from "@/lib/backgroundSync";
import { questions } from "@/lib/questions";
import { resultsUrl, normalizeEmail } from "@/lib/quizUrls";
import {
  resolveCredentialsByEmail,
  persistResolvedCredentials,
} from "@/lib/resolveCredentials";
import { allAnswersString } from "@/lib/quizScreens";
import { prefetchStandings } from "@/lib/rankEstimate";

const TOTAL_QUESTIONS = questions.length;

interface ProgressResponse {
  pid: string;
  name: string;
  email: string;
  status: "not_started" | "in_progress" | "completed" | "expired";
  lastActivityAt: string;
  daysSinceLastActivity: number;
  restarted: boolean;
  answeredQuestionIds: string[];
  answers: Record<string, { answer: string; isCorrect?: boolean }>;
  score: {
    totalScore: number;
    completionTimeSeconds: number;
    completedAt: string;
  } | null;
}

export default function QuizClient({ email }: { email: string }) {
  const router = useRouter();
  const linkResults = resultsUrl(email);

  const [pid, setPid] = useState("");
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [restartNotice, setRestartNotice] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const session = loadSession();
    return session &&
      normalizeEmail(session.email) === email &&
      !session.completed
      ? session.answers
      : {};
  });
  const [saveError, setSaveError] = useState("");

  const submittingRef = useRef(false);
  const firstUnansweredRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const flush = () => flushPendingOnUnload();
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const creds = await resolveCredentialsByEmail(email);
      if (cancelled) return;
      if (!creds) {
        setError("No registration found for this email.");
        return;
      }

      setPid(creds.pid);
      setToken(creds.token);
      persistResolvedCredentials(creds);

      const local = loadSession();
      if (local && normalizeEmail(local.email) === email) {
        if (local.completed) {
          router.replace(linkResults);
          return;
        }
        setReady(true);
        scheduleSync();
        return;
      }

      if (local && normalizeEmail(local.email) !== email) {
        clearSession();
      }

      try {
        const res = await fetch(
          `/api/progress?pid=${encodeURIComponent(creds.pid)}&token=${encodeURIComponent(creds.token)}`
        );
        const data = (await res.json()) as ProgressResponse & { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Unable to load your quiz.");
          return;
        }
        if (cancelled) return;

        if (data.status === "completed" && data.score) {
          router.replace(linkResults);
          return;
        }

        setRestartNotice(data.restarted);

        const savedAnswers: Record<string, string> = {};
        for (const qid of Object.keys(data.answers)) {
          savedAnswers[qid] = data.answers[qid].answer;
        }
        saveSession({
          pid: creds.pid,
          token: creds.token,
          name: data.name,
          email: data.email,
          phone: "",
          workExperience: "",
          domain: "",
          registeredAt: data.lastActivityAt
            ? new Date(data.lastActivityAt).getTime()
            : Date.now(),
          registered: true,
          answers: savedAnswers,
          syncedAnswerString: allAnswersString(savedAnswers),
          completed: data.status === "completed",
          submitted: data.status === "completed",
          score: data.score?.totalScore ?? null,
          completionTimeSeconds: data.score?.completionTimeSeconds ?? null,
          completedAt: data.score?.completedAt ?? null,
        });
        setAnswers(savedAnswers);
        setReady(true);
        scheduleSync();
      } catch {
        if (!cancelled) setError("Network error. Please refresh to retry.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email, router, linkResults]);

  useEffect(() => {
    if (!ready || !firstUnansweredRef.current) return;
    firstUnansweredRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    prefetchStandings();
  }, [ready]);

  const submit = useCallback(() => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaveError("");

    const session = loadSession();
    const registeredAt = session?.registeredAt ?? Date.now();
    const completedAt = new Date();
    const completionTimeSeconds = Math.max(
      0,
      Math.round((completedAt.getTime() - registeredAt) / 1000)
    );
    const apiPid = session?.pid ?? pid;
    const apiToken = session?.token ?? token;
    const answerStr = allAnswersString(answers);

    saveSession({
      pid: apiPid,
      token: apiToken,
      name: session?.name ?? "",
      email: session?.email ?? email,
      phone: session?.phone ?? "",
      workExperience: session?.workExperience ?? "",
      domain: session?.domain ?? "",
      registeredAt,
      registered: session?.registered ?? false,
      answers,
      syncedAnswerString: session?.syncedAnswerString ?? "",
      completed: true,
      submitted: false,
      score: null,
      completionTimeSeconds,
      completedAt: completedAt.toISOString(),
    });

    // Score on the server only (answer key never ships to the browser).
    // Kick off scoring, then navigate — results page retries if this is slow.
    void fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pid: apiPid,
        token: apiToken,
        answers: answerStr,
      }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json()) as { totalScore?: number };
        const totalScore = Number(body.totalScore);
        const cur = loadSession();
        if (cur && !Number.isNaN(totalScore)) {
          saveSession({ ...cur, score: totalScore });
        }
      })
      .catch(() => {
        // Results page will score via /api/score if this fails.
      });

    scheduleSync();
    router.replace(linkResults);
  }, [answers, pid, token, email, router, linkResults]);

  const answer = useCallback(
    (questionId: string, option: string) => {
      const prev = answers[questionId];
      if (prev === option) return;

      setAnswers((a) => ({ ...a, [questionId]: option }));
      setSaveError("");

      const session = loadSession();
      const nextAnswers = { ...(session?.answers ?? answers), [questionId]: option };

      if (session) {
        saveSession({
          ...session,
          answers: nextAnswers,
          registeredAt: session.registeredAt ?? Date.now(),
          registered: session.registered ?? false,
        });
      } else {
        saveSession({
          pid,
          token,
          name: "",
          email,
          phone: "",
          workExperience: "",
          domain: "",
          registeredAt: Date.now(),
          registered: false,
          answers: nextAnswers,
          syncedAnswerString: "",
          completed: false,
          submitted: false,
          score: null,
          completionTimeSeconds: null,
          completedAt: null,
        });
      }

      scheduleSync();
    },
    [answers, email, pid, token]
  );

  if (error) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">This link isn&apos;t valid</h1>
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

  if (!ready) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16 text-slate-400">
        Loading your quiz…
      </main>
    );
  }

  const answeredCount = questions.filter((q) => answers[q.id] !== undefined).length;
  const allComplete = answeredCount === TOTAL_QUESTIONS;
  const progressPct = Math.round((answeredCount / TOTAL_QUESTIONS) * 100);
  const firstUnansweredId = questions.find((q) => !(q.id in answers))?.id;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#001426]/95 px-4 py-4 backdrop-blur-md sm:px-6">
        <div className="mx-auto w-full max-w-6xl space-y-2">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-slate-300">
              Questions answered
            </p>
            <p className="text-sm tabular-nums text-white">
              <span className="font-bold text-[#75BEE9]">{answeredCount}</span>
              <span className="text-slate-500"> / {TOTAL_QUESTIONS}</span>
            </p>
          </div>
          <div className="quiz-progress-track" aria-hidden="true">
            <div
              className="quiz-progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </header>

      {/* Scrollable questions */}
      <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-[#0074C8]/15 blur-[110px]" />

        {restartNotice && (
          <p className="relative mb-4 rounded-lg border border-amber-300/20 bg-amber-950/50 px-3 py-2 text-sm text-amber-200">
            More than 30 days passed since your last activity, so your previous
            answers were cleared and you&apos;ve been restarted from question 1.
          </p>
        )}

        <div className="glass-panel relative rounded-2xl border border-white/10 px-5 py-7 sm:px-8 sm:py-9">
          {questions.map((q, globalIndex) => {
            const selected = answers[q.id];
            const isFirstUnanswered = q.id === firstUnansweredId;
            return (
              <article
                key={q.id}
                ref={isFirstUnanswered ? firstUnansweredRef : undefined}
                className="quiz-question-block"
              >
                <div className="flex items-start gap-3.5 sm:gap-4">
                  <span className="quiz-q-badge" aria-hidden="true">
                    {globalIndex + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="quiz-q-text">{q.text}</h2>
                    <fieldset className="mt-5 space-y-2.5 border-0 p-0">
                      <legend className="sr-only">
                        Question {globalIndex + 1} options
                      </legend>
                      {Object.entries(q.options).map(([key, label]) => {
                        const isSelected = selected === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => answer(q.id, key)}
                            className={`quiz-option ${
                              isSelected ? "quiz-option-selected" : ""
                            }`}
                          >
                            <span className="quiz-option-letter">
                              {key.toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1 pt-px">
                              {label}
                            </span>
                          </button>
                        );
                      })}
                    </fieldset>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {saveError && (
          <p className="relative mt-4 rounded-lg border border-red-500/30 bg-red-950/60 px-3 py-2 text-sm text-red-300">
            {saveError}
          </p>
        )}

        {/* Spacer so content isn't hidden behind sticky footer */}
        <div className="h-24" aria-hidden="true" />
      </main>

      {/* Sticky footer with single submit */}
      <footer className="sticky bottom-0 z-20 border-t border-white/10 bg-[#001426]/95 px-4 py-4 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <p className="text-sm tabular-nums text-slate-400">
            <span className="font-medium text-white">{answeredCount}</span>
            <span> / {TOTAL_QUESTIONS} answered</span>
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={!allComplete}
            className="cta-button-gradient shrink-0 rounded-lg px-8 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Submit
          </button>
        </div>
      </footer>
    </div>
  );
}
