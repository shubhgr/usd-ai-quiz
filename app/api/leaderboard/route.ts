import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("limit");
  const parsed = Number(raw);
  const limit = Number.isFinite(parsed)
    ? Math.min(100, Math.max(1, Math.trunc(parsed)))
    : 20;

  const scores = await prisma.score.findMany({
    take: limit,
    orderBy: [
      { totalScore: "desc" },
      { completionTimeSeconds: "asc" },
      { completedAt: "asc" },
    ],
    include: { registration: { select: { name: true } } },
  });

  return NextResponse.json(
    scores.map((s) => ({
      name: s.registration.name,
      totalScore: s.totalScore,
      completionTimeSeconds: s.completionTimeSeconds,
      completedAt: s.completedAt.toISOString(),
    }))
  );
}
