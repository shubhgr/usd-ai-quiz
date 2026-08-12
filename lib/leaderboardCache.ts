import { gasLeaderboard, type LeaderboardInfo } from "@/lib/sheets";

const TTL_MS = 20_000;
const FETCH_LIMIT = 100;

interface CacheEntry {
  at: number;
  topEntries: LeaderboardInfo["topEntries"];
  meByPid: Record<string, LeaderboardInfo["me"]>;
}

let cache: CacheEntry | null = null;
let inflight: Promise<LeaderboardInfo> | null = null;

function view(pid: string, limit: number, source: CacheEntry): LeaderboardInfo {
  return {
    ok: true,
    topEntries: source.topEntries.slice(0, limit),
    me: pid ? (source.meByPid[pid] ?? null) : null,
  };
}

function store(result: LeaderboardInfo, pid: string) {
  cache = {
    at: Date.now(),
    topEntries: result.topEntries,
    meByPid: {
      ...(cache?.meByPid ?? {}),
      ...(pid ? { [pid]: result.me } : {}),
    },
  };
}

export async function getCachedLeaderboard(params: {
  pid?: string;
  limit: number;
}): Promise<LeaderboardInfo> {
  const pid = params.pid ?? "";
  const limit = Math.min(FETCH_LIMIT, Math.max(1, params.limit));

  if (cache && Date.now() - cache.at <= TTL_MS) {
    const knownMe = !pid || Object.prototype.hasOwnProperty.call(cache.meByPid, pid);
    if (knownMe) return view(pid, limit, cache);
  }

  if (!inflight) {
    inflight = gasLeaderboard({ pid: pid || undefined, limit: FETCH_LIMIT })
      .then((result) => {
        store(result, pid);
        return result;
      })
      .finally(() => {
        inflight = null;
      });
  }

  try {
    await inflight;
    if (cache) return view(pid, limit, cache);
    throw new Error("Leaderboard cache missing after fetch");
  } catch (err) {
    if (cache && cache.topEntries.length > 0) return view(pid, limit, cache);
    throw err;
  }
}
