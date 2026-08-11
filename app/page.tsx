import Link from "next/link";
import { COMPETITION_NAME } from "@/lib/config";
import { TOTAL_CAROUSELS, questions } from "@/lib/questions";

export const metadata = {
  title: `${COMPETITION_NAME} — Think. Answer. Win.`,
};

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-6 py-20 text-center">
      <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
        15 questions · {TOTAL_CAROUSELS} rounds · ~5 minutes
      </span>

      <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
        {COMPETITION_NAME}
      </h1>
      <p className="mt-4 max-w-xl text-lg text-neutral-600 dark:text-neutral-400">
        Answer {questions.length} quick multiple-choice questions across general
        knowledge, tech, maths, science and more. Your progress saves
        automatically — you can leave and come back within 30 days.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link
          href="/register"
          className="rounded-lg bg-indigo-600 px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          Start now
        </Link>
        <Link
          href="/leaderboard"
          className="rounded-lg border border-neutral-300 px-7 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          View leaderboard
        </Link>
      </div>

      <div className="mt-16 grid w-full gap-4 text-left sm:grid-cols-3">
        {[
          {
            title: "Register once",
            body: "Use your email — it becomes your credential. Return to the same link anytime to resume.",
          },
          {
            title: "Answer & autosave",
            body: "Every answer is saved instantly. No save buttons, no lost progress if you close the tab.",
          },
          {
            title: "Result + leaderboard",
            body: "Get an instant score and a downloadable PDF, then see how you rank.",
          },
        ].map((card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
          >
            <h3 className="font-semibold">{card.title}</h3>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {card.body}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
