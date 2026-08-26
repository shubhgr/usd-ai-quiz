"use client";

import Link from "next/link";
import { COLLEGE_STANDINGS_PATH, STANDINGS_PATH } from "@/lib/quizUrls";

export function LeaderboardTabs({
  active,
}: {
  active: "individual" | "college";
}) {
  return (
    <div className="lb-nav">
      <div className="lb-tabs" role="tablist" aria-label="Leaderboard type">
        <Link
          href={STANDINGS_PATH}
          role="tab"
          aria-selected={active === "individual"}
          className={`lb-tab ${
            active === "individual" ? "lb-tab--filled" : "lb-tab--outline"
          }`}
        >
          Leaderboard
        </Link>
        <Link
          href={COLLEGE_STANDINGS_PATH}
          role="tab"
          aria-selected={active === "college"}
          className={`lb-tab ${
            active === "college" ? "lb-tab--filled" : "lb-tab--outline"
          }`}
        >
          College Standings
        </Link>
      </div>
    </div>
  );
}
