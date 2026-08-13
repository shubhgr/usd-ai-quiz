import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/token";
import { gasSubmit } from "@/lib/sheets";
import { respondSheetsError } from "@/lib/handleSheetsError";
import { invalidateLeaderboardCache } from "@/lib/leaderboardCache";

interface SubmitBody {
  pid?: string;
  token?: string;
}

export async function POST(request: Request) {
  let body: SubmitBody;
  try {
    body = (await request.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { pid = "", token = "" } = body;
  const verifiedPid = verifyToken(token);
  if (!verifiedPid || verifiedPid !== pid) {
    return NextResponse.json(
      { error: "Invalid or tampered token" },
      { status: 401 }
    );
  }

  try {
    // The Apps Script backend reads the saved answers from the Responses tab,
    // computes the score + completion time, writes them, and marks the
    // participant as completed. The client never sends a score.
    const result = await gasSubmit(pid);
    invalidateLeaderboardCache();
    return NextResponse.json({
      totalScore: result.totalScore,
      completionTimeSeconds: result.completionTimeSeconds,
      completedAt: result.completedAt,
    });
  } catch (err) {
    const response = respondSheetsError(err);
    if (response) return response;
    console.error("[submit]", err);
    return NextResponse.json(
      { error: "Could not submit quiz. Please try again." },
      { status: 502 }
    );
  }
}
