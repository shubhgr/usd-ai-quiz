import Link from "next/link";
import RegisterForm from "./RegisterForm";
import { COMPETITION_NAME } from "@/lib/config";

export const metadata = {
  title: `Register — ${COMPETITION_NAME}`,
};

export default function RegisterPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <Link
        href="/"
        className="mb-8 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
      >
        ← Back to home
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Register</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          15 questions, 5 quick rounds. You can leave and come back within 30
          days — your progress is saved as you go.
        </p>
      </div>

      <RegisterForm />
    </main>
  );
}
