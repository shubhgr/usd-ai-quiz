import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/token";
import { RESTART_AFTER_DAYS } from "@/lib/config";
import { findQuestion } from "@/lib/questions";

function unauthorized() {
  return NextResponse.json(
    { error: "Invalid or tampered token" },
    { status: 401 }
  );
}

export async function GET(request: NextRequest) {
  const pid = request.nextUrl.searchParams.get("pid") ?? "";
  const token = request.nextUrl.searchParams.get("token") ?? "";

  const verifiedPid = verifyToken(token);
  if (!verifiedPid || verifiedPid !== pid) return unauthorized();

  const registration = await prisma.registration.findUnique({
    where: { pid },
    include: { score: true },
  });
  if (!registration) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }

  const daysSinceLastActivity = Math.floor(
    (Date.now() - registration.lastActivityAt.getTime()) / 86_400_000
  );

  // §4.4 resume branch: expired => allow restart (configurable).
  // Must run BEFORE reading responses so a cleared quiz reports no answers.
  let status = registration.status;
  let restarted = false;
  if (
    registration.status === "in_progress" &&
    daysSinceLastActivity > RESTART_AFTER_DAYS
  ) {
    await prisma.response.deleteMany({ where: { pid } });
    await prisma.registration.update({
      where: { pid },
      data: { status: "not_started", lastActivityAt: new Date() },
    });
    status = "not_started";
    restarted = true;
  }

  const responses = await prisma.response.findMany({ where: { pid } });
  const answers: Record<string, { answer: string; isCorrect: boolean }> = {};
  for (const r of responses) {
    answers[r.questionId] = { answer: r.answer, isCorrect: r.isCorrect };
  }
  const answeredQuestionIds = responses.map((r) => r.questionId);

  return NextResponse.json({
    pid,
    name: registration.name,
    email: registration.email,
    status,
    lastActivityAt: registration.lastActivityAt.toISOString(),
    daysSinceLastActivity,
    restarted,
    answeredQuestionIds,
    answers,
    score: registration.score
      ? {
          totalScore: registration.score.totalScore,
          completionTimeSeconds: registration.score.completionTimeSeconds,
          completedAt: registration.score.completedAt.toISOString(),
        }
      : null,
  });
}

interface ProgressBody {
  pid?: string;
  token?: string;
  questionId?: string;
  answer?: string;
}

export async function POST(request: Request) {
  let body: ProgressBody;
  try {
    body = (await request.json()) as ProgressBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { pid = "", token = "", questionId = "", answer = "" } = body;
  const verifiedPid = verifyToken(token);
  if (!verifiedPid || verifiedPid !== pid) return unauthorized();

  const registration = await prisma.registration.findUnique({ where: { pid } });
  if (!registration) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }
  if (registration.status === "completed") {
    return NextResponse.json(
      { error: "Quiz already completed" },
      { status: 409 }
    );
  }

  const question = findQuestion(questionId);
  if (!question) {
    return NextResponse.json(
      { error: "Unknown questionId" },
      { status: 400 }
    );
  }
  const keys = Object.keys(question.options);
  if (!keys.includes(answer)) {
    return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
  }

  const isCorrect = question.correct === answer;

  // Upsert on (pid, questionId): changing an answer overwrites the row,
  // it never creates a duplicate.
  await prisma.response.upsert({
    where: { pid_questionId: { pid, questionId } },
    create: { pid, questionId, answer, isCorrect },
    update: { answer, isCorrect, answeredAt: new Date() },
  });

  await prisma.registration.update({
    where: { pid },
    data: { status: "in_progress", lastActivityAt: new Date() },
  });

  return NextResponse.json({ ok: true, isCorrect });
}
