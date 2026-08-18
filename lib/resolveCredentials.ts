import { loadSession, saveSession, clearSession } from "./clientSession";
import { normalizeEmail } from "./quizUrls";
import { questions } from "./questions";
import { allAnswersString } from "./quizScreens";

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
  const hasLocal =
    Boolean(local) &&
    normalizeEmail(local!.email) === normalized &&
    Boolean(local!.token) &&
    Boolean(local!.pid);

  // Instant path only when we already have a score — otherwise we still need
  // Sheets (or /api/score) to finish scoring for results/leaderboard.
  if (hasLocal && local!.score !== null) {
    return {
      pid: local!.pid,
      token: local!.token,
      name: local!.name,
      email: local!.email,
      status: local!.completed
        ? "completed"
        : local!.registered
          ? "in_progress"
          : "not_started",
      score: {
        totalScore: local!.score,
        completionTimeSeconds: local!.completionTimeSeconds ?? 0,
        completedAt: local!.completedAt,
      },
      rank: local!.rank ?? null,
      answers: allAnswersString(local!.answers),
    };
  }

  try {
    const res = await fetch("/api/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalized }),
    });
    const data = (await res.json()) as ResolvedCredentials & { error?: string };
    if (res.ok) {
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
  } catch {
    // Fall through to local credentials if present.
  }

  // Sheets slow/unavailable — still let quiz continue with local pid/token.
  if (hasLocal) {
    return {
      pid: local!.pid,
      token: local!.token,
      name: local!.name,
      email: local!.email,
      status: local!.completed
        ? "completed"
        : local!.registered
          ? "in_progress"
          : "not_started",
      score: null,
      rank: local!.rank ?? null,
      answers: allAnswersString(local!.answers),
    };
  }

  return null;
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
    linkedinUrl: existing?.linkedinUrl ?? "",
    bestDescribeYou: existing?.bestDescribeYou ?? "",
    considerMasters: existing?.considerMasters ?? "",
    planningYear: existing?.planningYear ?? "",
    interestsMost: existing?.interestsMost ?? "",
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
