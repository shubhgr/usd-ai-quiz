"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { jsPDF } from "jspdf";
import { questions } from "@/lib/questions";

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
  answers: Record<string, { answer: string; isCorrect: boolean }>;
  answeredQuestionIds: string[];
}

export default function ResultsClient({
  pid,
  token,
}: {
  pid: string;
  token: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<ResultsData | null>(null);

  const resultsUrl = `/results?pid=${encodeURIComponent(pid)}&token=${encodeURIComponent(token)}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/progress?pid=${encodeURIComponent(pid)}&token=${encodeURIComponent(token)}`
        );
        const body = (await res.json()) as ResultsData & { error?: string };
        if (!res.ok) {
          setError(body.error ?? "Unable to load your results.");
          return;
        }
        if (cancelled) return;
        setData(body);
      } catch {
        if (!cancelled) setError("Network error. Please refresh to retry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pid, token]);

  const downloadPdf = useCallback(() => {
    if (!data?.score) return;
    const doc = new jsPDF();

    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Competition Result", pageWidth / 2, y, { align: "center" });
    y += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Name: ${data.name}`, margin, y);
    y += 7;
    doc.text(`Email: ${data.email}`, margin, y);
    y += 7;
    doc.text(
      `Score: ${data.score.totalScore} / ${questions.length}`,
      margin,
      y
    );
    y += 7;
    doc.text(
      `Time taken: ${formatDuration(data.score.completionTimeSeconds)}`,
      margin,
      y
    );
    y += 7;
    doc.text(
      `Completed: ${new Date(data.score.completedAt).toLocaleString()}`,
      margin,
      y
    );
    y += 10;

    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Your responses", margin, y);
    y += 8;

    doc.setFontSize(9.5);
    for (const q of questions) {
      const answer = data.answers[q.id];
      const picked = answer ? answer.answer.toUpperCase() : "-";
      const pickedLabel = answer
        ? q.options[answer.answer as keyof typeof q.options]
        : "Not answered";

      doc.setFont("helvetica", "bold");
      doc.text(`${q.id.toUpperCase()}. ${q.text}`, margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.text(`Your answer: ${picked} — ${pickedLabel}`, margin + 4, y);
      y += 8;

      if (y > pageHeight - 20) {
        doc.addPage();
        y = margin;
      }
    }

    doc.save(`result-${data.pid}.pdf`);
  }, [data]);

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16 text-neutral-500">
        Loading your results…
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Couldn&apos;t load results</h1>
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

  if (!data) return null;

  if (!data.score) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">You haven&apos;t finished yet</h1>
          <p className="mt-3 text-neutral-600 dark:text-neutral-400">
            Your score is computed when you submit the final answer.
          </p>
          <Link
            href={`/quiz?pid=${encodeURIComponent(pid)}&token=${encodeURIComponent(token)}`}
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Continue your quiz
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          {data.name} — you&apos;re done!
        </p>
        <div className="mt-4 text-6xl font-extrabold tracking-tight">
          {data.score.totalScore}
          <span className="text-2xl font-medium text-neutral-400">
            {" "}
            / {questions.length}
          </span>
        </div>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Your score
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-neutral-600 dark:text-neutral-400">
          <span>
            Time taken:{" "}
            <strong className="text-neutral-900 dark:text-neutral-100">
              {formatDuration(data.score.completionTimeSeconds)}
            </strong>
          </span>
        </div>

        <button
          onClick={downloadPdf}
          className="mt-8 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Download PDF result
        </button>
      </div>

      <h2 className="mb-4 mt-10 text-lg font-semibold">Your responses</h2>
      <div className="space-y-3">
        {questions.map((q, i) => {
          const answer = data.answers[q.id];
          return (
            <div
              key={q.id}
              className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
            >
              <p className="text-sm font-medium">
                <span className="mr-2 text-neutral-400">
                  {i + 1}.
                </span>
                {q.text}
              </p>
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                Your answer:{" "}
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  {answer ? `${answer.answer.toUpperCase()} — ${q.options[answer.answer as keyof typeof q.options]}` : "Not answered"}
                </span>
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/leaderboard"
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          View leaderboard
        </Link>
        <Link
          href={resultsUrl}
          className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Copy results link
        </Link>
      </div>
    </main>
  );
}
