import { loadSession, saveSession, clearSession } from "./clientSession";
import { normalizeEmail } from "./quizUrls";
import { questions } from "./questions";

export interface ResolvedCredentials {
  pid: string;
  token: string;
  name: string;
  email: string;
  status: string;
  answers?: string;
  score?: {
    totalScore: number;
    completionTimeSeconds: number;
    completedAt: string | null;
  } | null;
  rank?: number | null;
}

function answersFromString(answerStr: string): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = (answerStr || "").trim().toLowerCase();
  for (let i = 0; i < raw.length && i < questions.length; i++) {
    const ch = raw.charAt(i);
    if (/^[abcd]$/.test(ch)) out[`q${i + 1}`] = ch;
  }
  return out;
}

export async function resolveCredentialsByEmail(
  email: string
): Promise<ResolvedCredentials | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const local = loadSession();
  if (
    local &&
    normalizeEmail(local.email) === normalized &&
    local.token &&
    local.score !== null
  ) {
    return {
      pid: local.pid,
      token: local.token,
      name: local.name,
      email: local.email,
      status: local.completed ? "completed" : local.registered ? "in_progress" : "not_started",
      score: {
        totalScore: local.score,
        completionTimeSeconds: local.completionTimeSeconds ?? 0,
        completedAt: local.completedAt,
      },
      rank: local.rank ?? null,
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
    answers: data.answers ?? "",
    score: data.score ?? null,
    rank: data.rank ?? null,
  };
}

export function persistResolvedCredentials(
  creds: ResolvedCredentials,
  patch?: Partial<ReturnType<typeof loadSession>>
): void {
  const existing = loadSession();
  const fromAnswers = creds.answers ? answersFromString(creds.answers) : {};
  saveSession({
    pid: creds.pid,
    token: creds.token,
    name: existing?.name || creds.name || "",
    email: creds.email,
    phone: existing?.phone ?? "",
    workExperience: existing?.workExperience ?? "",
    domain: existing?.domain ?? "",
    registeredAt: existing?.registeredAt ?? Date.now(),
    registered: true,
    answers:
      Object.keys(existing?.answers ?? {}).length > 0
        ? existing!.answers
        : fromAnswers,
    syncedAnswerString: existing?.syncedAnswerString ?? creds.answers ?? "",
    completed: existing?.completed || creds.status === "completed",
    submitted: existing?.submitted || creds.status === "completed",
    score: existing?.score ?? creds.score?.totalScore ?? null,
    completionTimeSeconds:
      existing?.completionTimeSeconds ??
      creds.score?.completionTimeSeconds ??
      null,
    completedAt:
      existing?.completedAt ?? creds.score?.completedAt ?? null,
    rank: existing?.rank ?? creds.rank ?? null,
    ...patch,
  });
}
