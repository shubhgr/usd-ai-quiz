import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { hasDatabaseUrl, query } from "@/lib/db";

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      { error: "Database is not configured." },
      { status: 503 }
    );
  }

  const rows = await query<{
    pid: string;
    name: string;
    email: string;
    phone: string | null;
    college_name: string | null;
    status: string;
    score: number | null;
    completion_time_seconds: number | null;
    registered_at: string | null;
  }>(
    `SELECT
       p.pid,
       p.name,
       p.email,
       p.phone,
       p.college_name,
       p.status,
       a.score,
       a.completion_time_seconds,
       p.registered_at
     FROM participants p
     LEFT JOIN attempts a ON a.pid = p.pid
     ORDER BY
       (a.score IS NULL) ASC,
       a.score DESC NULLS LAST,
       a.completion_time_seconds ASC NULLS LAST,
       p.registered_at DESC
     LIMIT 10000`
  );

  const scored = rows
    .filter((r) => r.score !== null)
    .sort((a, b) => {
      const scoreDiff = Number(b.score) - Number(a.score);
      if (scoreDiff !== 0) return scoreDiff;
      const timeA = a.completion_time_seconds ?? Number.POSITIVE_INFINITY;
      const timeB = b.completion_time_seconds ?? Number.POSITIVE_INFINITY;
      return timeA - timeB;
    });
  const rankByPid = new Map<string, number>();
  scored.forEach((r, i) => rankByPid.set(r.pid, i + 1));

  const headers = [
    "Rank",
    "Name",
    "Email",
    "Phone",
    "College",
    "Status",
    "Score",
    "Completion Time (sec)",
    "Registered At",
  ];

  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((r) => {
      const rank = rankByPid.get(r.pid) ?? "";
      const registered = r.registered_at
        ? new Date(r.registered_at).toISOString()
        : "";
      return [
        rank,
        r.name,
        r.email,
        (r.phone ?? "").trim(),
        r.college_name?.trim() || "",
        formatStatus(r.status),
        r.score ?? "",
        r.completion_time_seconds ?? "",
        registered,
      ]
        .map(csvCell)
        .join(",");
    }),
  ];

  const csv = `\uFEFF${lines.join("\r\n")}`;
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="usd-participants-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
