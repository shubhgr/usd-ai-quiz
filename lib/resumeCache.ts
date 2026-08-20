type ResumeCacheBody = Record<string, unknown>;

const resumeCache = new Map<string, { at: number; body: ResumeCacheBody }>();

export function getResumeCache(email: string) {
  return resumeCache.get(email);
}

export function setResumeCache(email: string, body: ResumeCacheBody) {
  resumeCache.set(email, { at: Date.now(), body });
}

export function clearResumeCache(email?: string) {
  if (email) resumeCache.delete(email.trim().toLowerCase());
  else resumeCache.clear();
}
