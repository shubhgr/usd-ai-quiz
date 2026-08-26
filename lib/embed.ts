/** True when this page is running inside a cross-origin iframe (e.g. Framer embed). */
export function isEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export const EMBED_HEIGHT_SOURCE = "usd-ai-quiz";
export const EMBED_HEIGHT_TYPE = "embed-height";

export type EmbedHeightMessage = {
  source: typeof EMBED_HEIGHT_SOURCE;
  type: typeof EMBED_HEIGHT_TYPE;
  height: number;
};

/** Measure content height for parent iframe resize (Framer code component). */
export function measureEmbedHeight(): number {
  if (typeof document === "undefined") return 0;
  const doc = document.documentElement;
  const body = document.body;
  return Math.ceil(
    Math.max(
      body?.scrollHeight ?? 0,
      body?.offsetHeight ?? 0,
      doc?.scrollHeight ?? 0,
      doc?.offsetHeight ?? 0
    )
  );
}

/** Tell the parent frame the content height so it can grow (no iframe scroll). */
export function reportEmbedHeight(height = measureEmbedHeight()): void {
  if (!isEmbedded() || height <= 0) return;
  const message: EmbedHeightMessage = {
    source: EMBED_HEIGHT_SOURCE,
    type: EMBED_HEIGHT_TYPE,
    height,
  };
  window.parent.postMessage(message, "*");
}

/** True when localStorage can round-trip a value. */
export function isStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const probe = `__usd_probe_${Date.now()}`;
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ask the browser for storage access after a user gesture (form submit).
 * Helps some browsers persist localStorage inside third-party iframes.
 */
export async function requestEmbedStorageAccess(): Promise<boolean> {
  if (typeof document === "undefined") return isStorageAvailable();
  if (isStorageAvailable()) return true;
  try {
    const req = (
      document as Document & {
        requestStorageAccess?: () => Promise<void>;
      }
    ).requestStorageAccess;
    if (typeof req !== "function") return false;
    await req.call(document);
    return isStorageAvailable();
  } catch {
    return false;
  }
}
