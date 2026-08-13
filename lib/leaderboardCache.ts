import { gasLeaderboard, type LeaderboardInfo } from "@/lib/sheets";

const TTL_MS = 45_000;
const FETCH_LIMIT = 100;

type MeInfo = LeaderboardInfo["me"];
type Entry = LeaderboardInfo["topEntries"][number];

interface CacheEntry {
  at: number;
  topEntries: Entry[];
  meByPid: Record<string, MeInfo>;
}

let cache: CacheEntry | null = null;
let inflight: Promise<Entry[]> | null = null;

function meFromEntry(entry: Entry, rank: number): NonNullable<MeInfo> {
  return {
    rank,
    totalScore: entry.totalScore,
    completionTimeSeconds: entry.completionTimeSeconds,
    completedAt: entry.completedAt,
  };
}

function indexEntries(entries: Entry[]) {
  const meByPid: Record<string, MeInfo> = { ...(cache?.meByPid ?? {}) };
  entries.forEach((entry, i) => {
    meByPid[entry.pid] = meFromEntry(entry, i + 1);
  });
  return meByPid;
}

function view(pid: string, limit: number, source: CacheEntry): LeaderboardInfo {
  const topEntries = source.topEntries.slice(0, limit);
  let me: MeInfo = null;
  if (pid) {
    me = source.meByPid[pid] ?? null;
    if (!me) {
      const idx = source.topEntries.findIndex((e) => e.pid === pid);
      if (idx >= 0) me = meFromEntry(source.topEntries[idx], idx + 1);
    }
  }
  return { ok: true, topEntries, me };
}

async function fetchEntries(pid?: string): Promise<Entry[]> {
  const result = await gasLeaderboard({
    pid: pid || undefined,
    limit: FETCH_LIMIT,
  });
  const meByPid = indexEntries(result.topEntries);
  if (pid && result.me) {
    meByPid[pid] = result.me;
  }
  cache = {
    at: Date.now(),
    topEntries: result.topEntries,
    meByPid,
  };
  return result.topEntries;
}

export function invalidateLeaderboardCache() {
  cache = null;
}

export async function getCachedLeaderboard(params: {
  pid?: string;
  limit: number;
}): Promise<LeaderboardInfo> {
  const pid = params.pid ?? "";
  const limit = Math.min(FETCH_LIMIT, Math.max(1, params.limit));

  if (cache && Date.now() - cache.at <= TTL_MS) {
    const result = view(pid, limit, cache);
    // Serve cache when we don't need me, or me is already known / in the list.
    if (!pid || result.me) return result;
  }

  if (!inflight) {
    inflight = fetchEntries(pid || undefined).finally(() => {
      inflight = null;
    });
  }

  try {
    await inflight;
    if (cache) {
      const result = view(pid, limit, cache);
      if (!pid || result.me) return result;
      // Shared inflight may have been started without this pid — fetch me specifically.
      await fetchEntries(pid);
      if (cache) return view(pid, limit, cache);
    }
    throw new Error("Leaderboard cache missing after fetch");
  } catch (err) {
    if (cache && cache.topEntries.length > 0) return view(pid, limit, cache);
    throw err;
  }
}
