import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { hasDatabaseUrl, query } from "@/lib/db";
import { invalidateCollegeLeaderboardCache } from "@/lib/collegeLeaderboardCache";
import { invalidateCollegeAdminListCache } from "@/lib/collegeCatalog";
import { invalidateLeaderboardCache } from "@/lib/leaderboardCache";

interface Body {
  collegeName?: string | null;
  name?: string;
}

function mapParticipant(row: {
  pid: string;
  name: string;
  email: string;
  college_name: string | null;
}) {
  return {
    pid: row.pid,
    name: row.name,
    email: row.email,
    collegeName: row.college_name?.trim() || null,
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ pid: string }> }
) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      { error: "Database is not configured." },
      { status: 503 }
    );
  }

  const { pid } = await context.params;
  if (!pid || !/^[0-9a-f-]{36}$/i.test(pid)) {
    return NextResponse.json({ error: "Invalid pid" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sets: string[] = [];
  const values: unknown[] = [pid];
  let touchedName = false;
  let touchedCollege = false;

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    sets.push(`name = $${values.length + 1}`);
    values.push(name);
    touchedName = true;
  }

  if (body.collegeName !== undefined) {
    const collegeName =
      typeof body.collegeName === "string" ? body.collegeName.trim() : "";
    sets.push(`college_name = $${values.length + 1}`);
    values.push(collegeName || null);
    touchedCollege = true;
  }

  if (!sets.length) {
    return NextResponse.json(
      { error: "Provide name and/or collegeName to update" },
      { status: 400 }
    );
  }

  const updated = await query<{
    pid: string;
    name: string;
    email: string;
    college_name: string | null;
  }>(
    `UPDATE participants
       SET ${sets.join(", ")}
     WHERE pid = $1
     RETURNING pid, name, email, college_name`,
    values
  );

  if (!updated.length) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }

  if (touchedName) invalidateLeaderboardCache();
  if (touchedCollege) {
    invalidateCollegeLeaderboardCache();
    invalidateCollegeAdminListCache();
  }

  return NextResponse.json({
    ok: true,
    participant: mapParticipant(updated[0]!),
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ pid: string }> }
) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      { error: "Database is not configured." },
      { status: 503 }
    );
  }

  const { pid } = await context.params;
  if (!pid || !/^[0-9a-f-]{36}$/i.test(pid)) {
    return NextResponse.json({ error: "Invalid pid" }, { status: 400 });
  }

  const deleted = await query<{ pid: string; name: string; email: string }>(
    `DELETE FROM participants WHERE pid = $1 RETURNING pid, name, email`,
    [pid]
  );

  if (!deleted.length) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }

  invalidateLeaderboardCache();
  invalidateCollegeLeaderboardCache();
  invalidateCollegeAdminListCache();

  return NextResponse.json({
    ok: true,
    deleted: deleted[0]!,
  });
}
