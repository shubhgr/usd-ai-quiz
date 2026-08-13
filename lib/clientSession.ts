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

// Fallback when localStorage is blocked (third-party iframes like Framer).
// Survives in-app navigation; lost only on full page reload.
let memorySession: LocalSession | null = null;

function normalize(session: LocalSession): LocalSession {
  return {
    ...session,
    registered: session.registered ?? false,
    syncedAnswerString: session.syncedAnswerString ?? "",
  };
}

export function loadSession(): LocalSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalSession;
      if (parsed.pid) {
        memorySession = normalize(parsed);
        return memorySession;
      }
    }
  } catch {
    // localStorage blocked — use memory
  }
  return memorySession;
}

/**
 * Always keeps an in-memory copy so the quiz works inside Framer iframes
 * even when the browser blocks localStorage.
 * Returns true when localStorage also persisted (false = memory-only).
 */
export function saveSession(session: LocalSession): boolean {
  if (typeof window === "undefined") return false;
  const next = normalize(session);
  memorySession = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function clearSession(): void {
  memorySession = null;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** True when the active session is memory-only (no durable localStorage). */
export function isMemoryOnlySession(): boolean {
  if (typeof window === "undefined") return false;
  if (!memorySession) return false;
  try {
    return window.localStorage.getItem(KEY) == null;
  } catch {
    return true;
  }
}
