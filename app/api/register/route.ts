import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/token";

interface RegisterBody {
  name?: string;
  email?: string;
  phone?: string;
}

export async function POST(request: Request) {
  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  if (!name || !email) {
    return NextResponse.json(
      { error: "name and email are required" },
      { status: 400 }
    );
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const existing = await prisma.registration.findUnique({ where: { email } });
  if (existing) {
    // Returning participant — do NOT create a duplicate. The quiz page
    // branches on `status` (start / resume / redirect to results).
    return NextResponse.json({
      pid: existing.pid,
      token: signToken(existing.pid),
      status: existing.status,
      lastActivityAt: existing.lastActivityAt.toISOString(),
      existing: true,
    });
  }

  const pid = crypto.randomUUID();
  const now = new Date();

  try {
    const created = await prisma.registration.create({
      data: {
        pid,
        name,
        email,
        phone,
        status: "not_started",
        registeredAt: now,
        lastActivityAt: now,
      },
    });
    return NextResponse.json({
      pid: created.pid,
      token: signToken(created.pid),
      status: created.status,
      lastActivityAt: created.lastActivityAt.toISOString(),
      existing: false,
    });
  } catch (err) {
    // Race: two identical registrations landed at once; unique(email) fired.
    // Re-read and return the existing row.
    if (err instanceof Error && "code" in err && (err as { code?: string }).code === "P2002") {
      const existingRow = await prisma.registration.findUnique({ where: { email } });
      if (existingRow) {
        return NextResponse.json({
          pid: existingRow.pid,
          token: signToken(existingRow.pid),
          status: existingRow.status,
          lastActivityAt: existingRow.lastActivityAt.toISOString(),
          existing: true,
        });
      }
    }
    throw err;
  }
}
