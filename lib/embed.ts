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

/**
 * Content-only height — never use the iframe viewport (100dvh / % of a tall
 * parent), or height cannot shrink when switching to a shorter page.
 */
export function measureEmbedHeight(): number {
  if (typeof document === "undefined") return 0;
  const body = document.body;
  if (!body) return 0;

  // Let layout settle to intrinsic content size before measuring.
  const html = document.documentElement;
  const prevHtmlHeight = html.style.height;
  const prevBodyHeight = body.style.height;
  html.style.height = "auto";
  body.style.height = "auto";

  let bottom = 0;
  for (const node of Array.from(body.children)) {
    if (!(node instanceof HTMLElement)) continue;
    const style = window.getComputedStyle(node);
    if (style.display === "none") continue;
    if (style.position === "fixed" || style.position === "sticky") continue;
    const rect = node.getBoundingClientRect();
    bottom = Math.max(bottom, rect.bottom);
  }

  // Prefer main when present (leaderboard / quiz shell).
  const main = body.querySelector("main");
  if (main instanceof HTMLElement) {
    const rect = main.getBoundingClientRect();
    bottom = Math.max(bottom, rect.bottom);
  }

  const height = Math.ceil(Math.max(bottom, 1)) + 2;

  // Collapse document to content so a tall iframe does not paint empty page bg.
  html.style.height = `${height}px`;
  body.style.height = `${height}px`;

  // Keep previous inline values only if measure somehow failed mid-flight.
  if (height <= 1) {
    html.style.height = prevHtmlHeight;
    body.style.height = prevBodyHeight;
  }

  return height;
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
