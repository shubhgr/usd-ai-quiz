import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { listCollegeMembers } from "@/lib/collegeCatalog";

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const collegeName = request.nextUrl.searchParams.get("collegeName")?.trim() ?? "";
  if (!collegeName) {
    return NextResponse.json(
      { error: "collegeName query parameter is required" },
      { status: 400 }
    );
  }

  const members = await listCollegeMembers(collegeName);
  return NextResponse.json({ collegeName, members });
}
