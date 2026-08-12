import crypto from "crypto";
import { NextResponse } from "next/server";
import { signToken } from "@/lib/token";
import { gasRegister } from "@/lib/sheets";

interface RegisterBody {
  pid?: string;
  name?: string;
  email?: string;
  phone?: string;
  workExperience?: string;
  domain?: string;
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
  const workExperience =
    typeof body.workExperience === "string" ? body.workExperience.trim() : null;
  const domain = typeof body.domain === "string" ? body.domain.trim() : null;

  if (!name || !email) {
    return NextResponse.json(
      { error: "name and email are required" },
      { status: 400 }
    );
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  // Accept a client-supplied pid (issued instantly by /api/begin) so the
  // registration can be written in the background without blocking the UI.
  // Fall back to generating one here for safety.
  const pid =
    typeof body.pid === "string" && /^[0-9a-f-]{36}$/i.test(body.pid)
      ? body.pid
      : crypto.randomUUID();

  // The Apps Script backend owns the unique-email check: if the email already
  // exists it returns the existing row (existing:true) instead of a duplicate.
  const result = await gasRegister({ pid, name, email, phone, workExperience: workExperience ?? "", domain: domain ?? "" });

  return NextResponse.json({
    pid: result.pid,
    token: signToken(result.pid),
    status: result.status,
    lastActivityAt: result.lastActivityAt,
    existing: result.existing,
  });
}
