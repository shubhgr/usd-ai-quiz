import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/token";
import { questions } from "@/lib/questions";

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

  const registration = await prisma.registration.findUnique({ where: { pid } });
  if (!registration) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }
  if (registration.status === "completed") {
    const existingScore = await prisma.score.findUnique({ where: { pid } });
    if (existingScore) {
      return NextResponse.json({
        totalScore: existingScore.totalScore,
        completionTimeSeconds: existingScore.completionTimeSeconds,
        completedAt: existingScore.completedAt.toISOString(),
        alreadyCompleted: true,
      });
    }
  }

  // Score is always recomputed server-side from saved responses — the
  // client never sends a score.
  const responses = await prisma.response.findMany({ where: { pid } });
  const answeredIds = new Set(responses.map((r) => r.questionId));
  if (answeredIds.size < questions.length) {
    return NextResponse.json(
      { error: "Not all questions have been answered" },
      { status: 400 }
    );
  }

  const totalScore = responses.filter((r) => r.isCorrect).length;

  let earliest = responses[0].answeredAt;
  for (const r of responses) {
    if (r.answeredAt < earliest) earliest = r.answeredAt;
  }
  const completionTimeSeconds = Math.max(
    0,
    Math.round((Date.now() - earliest.getTime()) / 1000)
  );

  const completedAt = new Date();

  // Upsert keyed on pid so two near-simultaneous submits can't race.
  await prisma.score.upsert({
    where: { pid },
    create: {
      pid,
      totalScore,
      completionTimeSeconds,
      completedAt,
    },
    update: { totalScore, completionTimeSeconds, completedAt },
  });

  await prisma.registration.update({
    where: { pid },
    data: { status: "completed", lastActivityAt: completedAt },
  });

  return NextResponse.json({
    totalScore,
    completionTimeSeconds,
    completedAt: completedAt.toISOString(),
  });
}
