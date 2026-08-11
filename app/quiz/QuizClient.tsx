"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { questions, questionsByCarousel } from "@/lib/questions";

const carousels = questionsByCarousel();
const TOTAL_SCREENS = carousels.length;
const TOTAL_QUESTIONS = questions.length;
const SWIPE_THRESHOLD = 0.25;

interface ProgressResponse {
  pid: string;
  name: string;
  email: string;
  status: "not_started" | "in_progress" | "completed" | "expired";
  lastActivityAt: string;
  daysSinceLastActivity: number;
  restarted: boolean;
  answeredQuestionIds: string[];
  answers: Record<string, { answer: string; isCorrect: boolean }>;
  score: {
    totalScore: number;
    completionTimeSeconds: number;
    completedAt: string;
  } | null;
}

export default function QuizClient({
  pid,
  token,
}: {
  pid: string;
  token: string;
}) {
  const router = useRouter();
  const quizUrl = `/quiz?pid=${encodeURIComponent(pid)}&token=${encodeURIComponent(token)}`;
  const resultsUrl = `/results?pid=${encodeURIComponent(pid)}&token=${encodeURIComponent(token)}`;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [restartNotice, setRestartNotice] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [screen, setScreen] = useState(0);
  const [saveError, setSaveError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const submittingRef = useRef(false);

  // Swipe state (pointer drag on the carousel track).
  const dragRef = useRef<{
    active: boolean;
    captured: boolean;
    startX: number;
    delta: number;
    width: number;
  }>({ active: false, captured: false, startX: 0, delta: 0, width: 0 });
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const DRAG_START_THRESHOLD = 8;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/progress?pid=${encodeURIComponent(pid)}&token=${encodeURIComponent(token)}`
        );
        const data = (await res.json()) as ProgressResponse & { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Unable to load your quiz.");
          return;
        }
        if (cancelled) return;

        if (data.status === "completed") {
          router.replace(resultsUrl);
          return;
        }

        setRestartNotice(data.restarted);

        const savedAnswers: Record<string, string> = {};
        for (const qid of Object.keys(data.answers)) {
          savedAnswers[qid] = data.answers[qid].answer;
        }
        setAnswers(savedAnswers);

        // Resume at the first screen containing an unanswered question.
        // If everything is answered but not yet submitted, land on the last screen.
        const unanswered = questions.find((q) => !(q.id in savedAnswers));
        if (unanswered) {
          setScreen(unanswered.carousel - 1);
        } else if (Object.keys(savedAnswers).length >= TOTAL_QUESTIONS) {
          setScreen(TOTAL_SCREENS - 1);
        }
      } catch {
        if (!cancelled) setError("Network error. Please refresh to retry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pid, token, router, resultsUrl]);

  const isScreenComplete = (screenIdx: number) =>
    carousels[screenIdx].every((q) => answers[q.id] !== undefined);

  const submit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSaveError("");
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pid, token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Could not submit your quiz.");
        submittingRef.current = false;
        setSubmitting(false);
        return;
      }
      router.replace(resultsUrl);
    } catch {
      setSaveError("Network error while submitting. Please try again.");
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [pid, token, router, resultsUrl]);

  const answer = useCallback(
    async (questionId: string, option: string) => {
      const prev = answers[questionId];
      if (prev === option) return;

      setAnswers((a) => ({ ...a, [questionId]: option }));
      setSaveError("");

      try {
        const res = await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pid, token, questionId, answer: option }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setAnswers((a) => {
            const next = { ...a };
            if (prev === undefined) delete next[questionId];
            else next[questionId] = prev;
            return next;
          });
          setSaveError(data.error ?? "Could not save your answer. Please retry.");
        }
      } catch {
        setAnswers((a) => {
          const next = { ...a };
          if (prev === undefined) delete next[questionId];
          else next[questionId] = prev;
          return next;
        });
        setSaveError("Network error while saving. Please retry.");
      }
    },
    [answers, pid, token]
  );

  const goToScreen = (target: number) => {
    const clamped = Math.max(0, Math.min(TOTAL_SCREENS - 1, target));
    setScreen(clamped);
  };

  // --- Swipe (pointer drag) handlers ---
  const onPointerDown = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el) return;
    dragRef.current = {
      active: true,
      captured: false,
      startX: e.clientX,
      delta: 0,
      width: el.clientWidth,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    const delta = e.clientX - drag.startX;

    // Small dead-zone: a stationary press should remain a click on the
    // option buttons, so we only start the swipe once the pointer moves.
    if (!drag.captured) {
      if (Math.abs(delta) < DRAG_START_THRESHOLD) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.captured = true;
      setDragging(true);
    }

    const canGoBack = screen > 0;
    const canGoForward = screen < TOTAL_SCREENS - 1;
    const clamped = Math.max(
      canGoBack ? -drag.width : 0,
      Math.min(canGoForward ? drag.width : 0, delta)
    );
    drag.delta = clamped;
    setDragOffset(clamped);
  };

  const endDrag = () => {
    const drag = dragRef.current;
    if (!drag.active) return;
    drag.active = false;
    if (drag.captured) {
      const ratio = drag.delta / (drag.width || 1);
      if (ratio < -SWIPE_THRESHOLD) goToScreen(screen + 1);
      else if (ratio > SWIPE_THRESHOLD) goToScreen(screen - 1);
    }
    setDragging(false);
    setDragOffset(0);
    dragRef.current = {
      active: false,
      captured: false,
      startX: 0,
      delta: 0,
      width: 0,
    };
  };

  if (error) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">This link isn&apos;t valid</h1>
          <p className="mt-3 text-neutral-600 dark:text-neutral-400">{error}</p>
          <Link
            href="/register"
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Go to registration
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16 text-neutral-500">
        Loading your quiz…
      </main>
    );
  }

  const screenComplete = isScreenComplete(screen);
  const allComplete = Object.keys(answers).length >= TOTAL_QUESTIONS;
  const isLastScreen = screen === TOTAL_SCREENS - 1;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-400">
          ← Home
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            Screen {screen + 1} of {TOTAL_SCREENS}
          </span>
          <div className="flex gap-1.5" aria-label="Progress">
            {carousels.map((group, i) => {
              const done = group.every((q) => answers[q.id] !== undefined);
              return (
                <span
                  key={i}
                  title={`Screen ${i + 1}${done ? " (complete)" : ""}`}
                  className={`h-2.5 w-2.5 rounded-full transition ${
                    i === screen
                      ? "bg-indigo-600 scale-110"
                      : done
                        ? "bg-emerald-500"
                        : "bg-neutral-300 dark:bg-neutral-700"
                  }`}
                />
              );
            })}
          </div>
        </div>
      </header>

      {restartNotice && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          More than 30 days passed since your last activity, so your previous
          answers were cleared and you&apos;ve been restarted from question 1.
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div
          ref={trackRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={`flex touch-pan-y select-none ${
            dragging ? "" : "transition-transform duration-500 ease-in-out"
          }`}
          style={{
            transform: `translateX(calc(${-screen * 100}% + ${dragOffset}px))`,
          }}
        >
          {carousels.map((group, slideIdx) => (
            <div
              key={slideIdx}
              className="flex w-full shrink-0 flex-col gap-5 px-6 py-8 sm:px-10"
            >
              {group.map((q) => {
                const selected = answers[q.id];
                const globalIndex = questions.indexOf(q);
                return (
                  <div key={q.id} className="flex flex-col gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Question {globalIndex + 1} of {TOTAL_QUESTIONS}
                    </p>
                    <h2 className="text-lg font-semibold leading-snug">{q.text}</h2>
                    <div className="grid gap-2">
                      {Object.entries(q.options).map(([key, label]) => {
                        const isSelected = selected === key;
                        return (
                          <button
                            key={key}
                            onClick={() => answer(q.id, key)}
                            className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition ${
                              isSelected
                                ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600 dark:bg-indigo-950"
                                : "border-neutral-200 hover:border-indigo-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                            }`}
                          >
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                                isSelected
                                  ? "border-indigo-600 bg-indigo-600 text-white"
                                  : "border-neutral-300 text-neutral-500 dark:border-neutral-600 dark:text-neutral-400"
                              }`}
                            >
                              {key.toUpperCase()}
                            </span>
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          onClick={() => goToScreen(screen - 1)}
          disabled={screen === 0}
          className="rounded-lg border border-neutral-300 px-5 py-2 text-sm font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          ← Back
        </button>
        <div className="flex items-center gap-3">
          {!isLastScreen ? (
            <button
              onClick={() => goToScreen(screen + 1)}
              disabled={!screenComplete}
              className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!allComplete || submitting}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Finish quiz"}
            </button>
          )}
        </div>
      </div>

      {saveError && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {saveError}
        </p>
      )}

      <p className="mt-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
        Your answers are saved automatically as you select them. You can close
        this tab and resume later from this same link. (
        <Link href={quizUrl} className="text-indigo-600 hover:underline dark:text-indigo-400">
          copy your quiz link
        </Link>
        )
      </p>
    </main>
  );
}
