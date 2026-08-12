export interface LocalSession {
  pid: string;
  token: string;
  name: string;
  email: string;
  phone: string;
  workExperience: string;
  domain: string;
  registeredAt: number | null;
  registered: boolean;
  answers: Record<string, string>;
  syncedAnswerString: string;
  completed: boolean;
  submitted: boolean;
  score: number | null;
  completionTimeSeconds: number | null;
  completedAt: string | null;
}

const KEY = "usd-session";

export function loadSession(): LocalSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalSession;
    if (!parsed.pid) return null;
    return {
      ...parsed,
      registered: parsed.registered ?? false,
      syncedAnswerString: parsed.syncedAnswerString ?? "",
    };
  } catch {
    return null;
  }
}

export function saveSession(session: LocalSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable; the UI still works for this session.
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
