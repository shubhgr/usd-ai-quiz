import Link from "next/link";
import QuizClient from "./QuizClient";
import { COMPETITION_NAME } from "@/lib/config";

export const metadata = {
  title: `Quiz — ${COMPETITION_NAME}`,
};

interface QuizPageProps {
  searchParams: Promise<{ pid?: string; token?: string }>;
}

export default async function QuizPage({ searchParams }: QuizPageProps) {
  const { pid, token } = await searchParams;

  if (!pid || !token) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Missing access link</h1>
          <p className="mt-3 text-neutral-600 dark:text-neutral-400">
            This page needs a link that was emailed to you (it contains your
            unique quiz token).
          </p>
          <Link
            href="/register"
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Register to get your link
          </Link>
        </div>
      </main>
    );
  }

  return <QuizClient pid={pid} token={token} />;
}
