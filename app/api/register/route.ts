import crypto from "crypto";
import { NextResponse } from "next/server";
import { signToken } from "@/lib/token";
import { gasRegister } from "@/lib/sheets";
import { hasDatabaseUrl, query } from "@/lib/db";
import { isTabBlocked } from "@/lib/tabSwitch";

interface RegisterBody {
  pid?: string;
  name?: string;
  email?: string;
  phone?: string;
  workExperience?: string;
  domain?: string;
  linkedinUrl?: string;
  bestDescribeYou?: string;
  considerMasters?: string;
  planningYear?: string;
  interestsMost?: string;
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
  const linkedinUrl =
    typeof body.linkedinUrl === "string" ? body.linkedinUrl.trim() : null;
  const bestDescribeYou =
    typeof body.bestDescribeYou === "string" ? body.bestDescribeYou.trim() : null;
  const considerMasters =
    typeof body.considerMasters === "string" ? body.considerMasters.trim() : null;
  const planningYear =
    typeof body.planningYear === "string" ? body.planningYear.trim() : null;
  const interestsMost =
    typeof body.interestsMost === "string" ? body.interestsMost.trim() : null;

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

  const now = new Date();

  // Postgres-first when DATABASE_URL is present.
  if (hasDatabaseUrl()) {
    const existingRows = await query<{
      pid: string;
      status: string;
      last_activity_at: string | null;
      tab_switches: number | null;
    }>(
      "SELECT pid, status, last_activity_at, COALESCE(tab_switches, 0) AS tab_switches FROM participants WHERE email = $1 LIMIT 1",
      [email]
    );

    if (existingRows.length > 0) {
      const existing = existingRows[0]!;
      const tabSwitches = Number(existing.tab_switches) || 0;
      if (isTabBlocked(tabSwitches) || existing.status === "blocked") {
        return NextResponse.json({
          pid: existing.pid,
          token: signToken(existing.pid),
          status: "blocked",
          lastActivityAt: existing.last_activity_at
            ? new Date(existing.last_activity_at).toISOString()
            : now.toISOString(),
          existing: true,
          blocked: true,
          tabSwitches,
        });
      }

      await query(
        "INSERT INTO attempts(pid) VALUES ($1) ON CONFLICT (pid) DO NOTHING",
        [existing.pid]
      );

      // Update mutable profile fields, but keep status + timestamps as-is
      // (matches the Sheets behavior where re-register doesn't reset progress).
      await query(
        `UPDATE participants
         SET name = $2,
             phone = $3,
             work_experience = $4,
             domain = $5,
             linkedin_url = $6,
             best_describe_you = $7,
             consider_masters = $8,
             planning_year = $9,
             interests_most = $10
         WHERE pid = $1`,
        [
          existing.pid,
          name,
          phone,
          workExperience ?? "",
          domain ?? "",
          linkedinUrl ?? null,
          bestDescribeYou ?? null,
          considerMasters ?? null,
          planningYear ?? null,
          interestsMost ?? null,
        ]
      );

      const lastActivityAtIso = existing.last_activity_at
        ? new Date(existing.last_activity_at).toISOString()
        : now.toISOString();

      // Background mirror: keep Google Sheet updated.
      void gasRegister({
        pid: existing.pid,
        name,
        email,
        phone,
        workExperience: workExperience ?? "",
        domain: domain ?? "",
        linkedinUrl: linkedinUrl ?? "",
        bestDescribeYou: bestDescribeYou ?? "",
        considerMasters: considerMasters ?? "",
        planningYear: planningYear ?? "",
        interestsMost: interestsMost ?? "",
      }).catch(() => {
        // ignore
      });

      return NextResponse.json({
        pid: existing.pid,
        token: signToken(existing.pid),
        status: existing.status,
        lastActivityAt: lastActivityAtIso,
        existing: true,
      });
    }

    const inserted = await query<{
      pid: string;
      status: string;
      last_activity_at: string;
    }>(
      `INSERT INTO participants
         (pid, name, email, phone, work_experience, domain, linkedin_url, best_describe_you, consider_masters, planning_year, interests_most, status, registered_at, last_activity_at)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'not_started', $12, $13)
       ON CONFLICT (pid)
       DO UPDATE SET
         name = EXCLUDED.name,
         phone = EXCLUDED.phone,
         work_experience = EXCLUDED.work_experience,
         domain = EXCLUDED.domain,
         linkedin_url = EXCLUDED.linkedin_url,
         best_describe_you = EXCLUDED.best_describe_you,
         consider_masters = EXCLUDED.consider_masters,
         planning_year = EXCLUDED.planning_year,
         interests_most = EXCLUDED.interests_most,
         last_activity_at = EXCLUDED.last_activity_at
       RETURNING pid, status, last_activity_at`,
      [
        pid,
        name,
        email,
        phone,
        workExperience ?? "",
        domain ?? "",
        linkedinUrl ?? null,
        bestDescribeYou ?? null,
        considerMasters ?? null,
        planningYear ?? null,
        interestsMost ?? null,
        now.toISOString(),
        now.toISOString(),
      ]
    );

    await query(
      "INSERT INTO attempts(pid) VALUES ($1) ON CONFLICT (pid) DO NOTHING",
      [pid]
    );

    // Background mirror: keep the Google Sheet updated with the same details.
    // This must never block UI latency.
    void gasRegister({
      pid: inserted[0]?.pid ?? pid,
      name,
      email,
      phone,
      workExperience: workExperience ?? "",
      domain: domain ?? "",
      linkedinUrl: linkedinUrl ?? "",
      bestDescribeYou: bestDescribeYou ?? "",
      considerMasters: considerMasters ?? "",
      planningYear: planningYear ?? "",
      interestsMost: interestsMost ?? "",
    }).catch(() => {
      // ignore (Sheets might be slow/unavailable; DB-first is the primary flow)
    });

    return NextResponse.json({
      pid: inserted[0]?.pid ?? pid,
      token: signToken(pid),
      status: inserted[0]?.status ?? "not_started",
      lastActivityAt: inserted[0]
        ? new Date(inserted[0].last_activity_at).toISOString()
        : now.toISOString(),
      existing: false,
    });
  }

  // Fallback to Google Sheets.
  const result = await gasRegister({
    pid,
    name,
    email,
    phone,
    workExperience: workExperience ?? "",
    domain: domain ?? "",
    linkedinUrl: linkedinUrl ?? "",
    bestDescribeYou: bestDescribeYou ?? "",
    considerMasters: considerMasters ?? "",
    planningYear: planningYear ?? "",
    interestsMost: interestsMost ?? "",
  });

  return NextResponse.json({
    pid: result.pid,
    token: signToken(result.pid),
    status: result.status,
    lastActivityAt: result.lastActivityAt,
    existing: result.existing,
    blocked: Boolean(result.blocked) || result.status === "blocked",
    tabSwitches: result.tabSwitches ?? 0,
  });
}
