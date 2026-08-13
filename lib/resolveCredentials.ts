import { loadSession, saveSession, clearSession } from "./clientSession";
import { normalizeEmail } from "./quizUrls";

export interface ResolvedCredentials {
  pid: string;
  token: string;
  name: string;
  email: string;
  status: string;
}

export async function resolveCredentialsByEmail(
  email: string
): Promise<ResolvedCredentials | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const local = loadSession();
  if (local && normalizeEmail(local.email) === normalized && local.token) {
    return {
      pid: local.pid,
      token: local.token,
      name: local.name,
      email: local.email,
      status: local.completed ? "completed" : local.registered ? "in_progress" : "not_started",
    };
  }

  const res = await fetch("/api/resume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: normalized }),
  });
  const data = (await res.json()) as ResolvedCredentials & { error?: string };
  if (!res.ok) return null;

  if (local && normalizeEmail(local.email) !== normalized) {
    clearSession();
  }

  return {
    pid: data.pid,
    token: data.token,
    name: local?.name ?? data.name ?? "",
    email: normalized,
    status: data.status,
  };
}

export function persistResolvedCredentials(
  creds: ResolvedCredentials,
  patch?: Partial<ReturnType<typeof loadSession>>
): void {
  const existing = loadSession();
  saveSession({
    pid: creds.pid,
    token: creds.token,
    name: existing?.name ?? creds.name ?? "",
    email: creds.email,
    phone: existing?.phone ?? "",
    workExperience: existing?.workExperience ?? "",
    domain: existing?.domain ?? "",
    registeredAt: existing?.registeredAt ?? Date.now(),
    registered: existing?.registered ?? creds.status !== "not_started",
    answers: existing?.answers ?? {},
    syncedAnswerString: existing?.syncedAnswerString ?? "",
    completed: existing?.completed ?? creds.status === "completed",
    submitted: existing?.submitted ?? creds.status === "completed",
    score: existing?.score ?? null,
    completionTimeSeconds: existing?.completionTimeSeconds ?? null,
    completedAt: existing?.completedAt ?? null,
    rank: existing?.rank ?? null,
    ...patch,
  });
}
