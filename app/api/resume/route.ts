import { NextResponse, type NextRequest } from "next/server";
import { signToken } from "@/lib/token";
import { gasResume } from "@/lib/sheets";
import { respondSheetsError } from "@/lib/handleSheetsError";

const RESUME_TTL_MS = 60_000;

interface ResumeBody {
  pid: string;
  token: string;
  name: string;
  email: string;
  status: string;
  lastActivityAt: string | null;
  answers?: string;
  score?: {
    totalScore: number;
    completionTimeSeconds: number;
    completedAt: string | null;
  } | null;
  rank?: number | null;
}

const resumeCache = new Map<string, { at: number; body: ResumeBody }>();

async function resumeByEmail(email: string) {
  const normalized =
    typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalized) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(normalized)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const cached = resumeCache.get(normalized);
  if (cached && Date.now() - cached.at <= RESUME_TTL_MS) {
    return NextResponse.json(cached.body);
  }

  try {
    const existing = await gasResume(normalized);
    const body: ResumeBody = {
      pid: existing.pid,
      token: signToken(existing.pid),
      name: existing.name,
      email: existing.email,
      status: existing.status,
      lastActivityAt: existing.lastActivityAt,
      answers: existing.answers ?? "",
      score: existing.score ?? null,
      rank: existing.rank ?? null,
    };
    resumeCache.set(normalized, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (err) {
    const response = respondSheetsError(err);
    if (response) return response;
    console.error("[resume]", err);
    return NextResponse.json(
      { error: "Could not reach the registration server. Please try again." },
      { status: 502 }
    );
  }
}

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email") ?? "";
  return resumeByEmail(email);
}

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return resumeByEmail(body.email ?? "");
}
