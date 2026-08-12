import { NextResponse, type NextRequest } from "next/server";
import { verifyToken } from "@/lib/token";
import { RESTART_AFTER_DAYS } from "@/lib/config";
import { questions } from "@/lib/questions";
import { isCorrectAnswer } from "@/lib/answerKey";
import {
  gasGetProgress,
  gasSaveAnswers,
  gasClearResponses,
  type ProgressInfo,
} from "@/lib/sheets";
import { respondSheetsError } from "@/lib/handleSheetsError";

function unauthorized() {
  return NextResponse.json(
    { error: "Invalid or tampered token" },
    { status: 401 }
  );
}

function notFound() {
  return NextResponse.json({ error: "Participant not found" }, { status: 404 });
}

async function fetchProgress(pid: string): Promise<{
  progress: ProgressInfo;
  restarted: boolean;
}> {
  let progress = await gasGetProgress(pid);
  let restarted = false;

  const last = progress.lastActivityAt
    ? new Date(progress.lastActivityAt).getTime()
    : Date.now();
  const daysSinceLastActivity = Math.floor((Date.now() - last) / 86_400_000);

  if (
    progress.status === "in_progress" &&
    daysSinceLastActivity > RESTART_AFTER_DAYS
  ) {
    await gasClearResponses(pid);
    progress = await gasGetProgress(pid);
    restarted = true;
  }

  return { progress, restarted };
}

export async function GET(request: NextRequest) {
  const pid = request.nextUrl.searchParams.get("pid") ?? "";
  const token = request.nextUrl.searchParams.get("token") ?? "";

  const verifiedPid = verifyToken(token);
  if (!verifiedPid || verifiedPid !== pid) return unauthorized();

  try {
    const { progress, restarted } = await fetchProgress(pid);

    const last = progress.lastActivityAt
      ? new Date(progress.lastActivityAt).getTime()
      : Date.now();
    const daysSinceLastActivity = Math.floor((Date.now() - last) / 86_400_000);

    const answers: Record<string, { answer: string; isCorrect?: boolean }> = {};
    const showCorrectness = progress.status === "completed";
    for (const r of progress.responses) {
      answers[r.questionId] = {
        answer: r.answer,
        ...(showCorrectness
          ? { isCorrect: isCorrectAnswer(r.questionId, r.answer) }
          : {}),
      };
    }
    const answeredQuestionIds = progress.responses.map((r) => r.questionId);

    return NextResponse.json({
      pid,
      name: progress.name,
      email: progress.email,
      status: progress.status,
      lastActivityAt: progress.lastActivityAt,
      daysSinceLastActivity,
      restarted,
      answeredQuestionIds,
      answers,
      score: progress.score,
    });
  } catch (err) {
    const response = respondSheetsError(err);
    if (response) return response;
    console.error("[progress GET]", err);
    return NextResponse.json(
      { error: "Could not load progress. Please try again." },
      { status: 502 }
    );
  }
}

interface ProgressBody {
  pid?: string;
  token?: string;
  answers?: string;
}

export async function POST(request: Request) {
  let body: ProgressBody;
  try {
    body = (await request.json()) as ProgressBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { pid = "", token = "", answers = "" } = body;
  const verifiedPid = verifyToken(token);
  if (!verifiedPid || verifiedPid !== pid) return unauthorized();

  const normalized = answers.trim().toLowerCase();
  if (!normalized) {
    return NextResponse.json({ error: "answers is required" }, { status: 400 });
  }
  if (normalized.length > questions.length) {
    return NextResponse.json({ error: "answers string is too long" }, { status: 400 });
  }
  if (!/^[abcd]+$/.test(normalized)) {
    return NextResponse.json({ error: "Invalid answer string" }, { status: 400 });
  }

  try {
    const result = await gasSaveAnswers({ pid, answers: normalized });

    if (result.completed) {
      return NextResponse.json({
        ok: true,
        completed: true,
        totalScore: result.totalScore,
        completionTimeSeconds: result.completionTimeSeconds,
        completedAt: result.completedAt,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const response = respondSheetsError(err);
    if (response) return response;
    console.error("[progress POST]", err);
    return NextResponse.json(
      { error: "Could not save progress. Please try again." },
      { status: 502 }
    );
  }
}
