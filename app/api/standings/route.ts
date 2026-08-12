import { NextResponse, type NextRequest } from "next/server";
import { getCachedLeaderboard } from "@/lib/leaderboardCache";
import { respondSheetsError } from "@/lib/handleSheetsError";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("limit");
  const parsed = Number(raw);
  const limit = Number.isFinite(parsed)
    ? Math.min(100, Math.max(1, Math.trunc(parsed)))
    : 100;

  try {
    const result = await getCachedLeaderboard({ limit });
    return NextResponse.json({ topEntries: result.topEntries });
  } catch (err) {
    const response = respondSheetsError(err);
    if (response) return response;
    console.error("[standings]", err);
    return NextResponse.json(
      { error: "Could not load leaderboard. Please try again." },
      { status: 502 }
    );
  }
}
