"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { COLLEGE_STANDINGS_PATH, STANDINGS_PATH } from "@/lib/quizUrls";
import { isEmbedded } from "@/lib/embed";

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  const className = `lb-tab ${active ? "lb-tab--filled" : "lb-tab--outline"}`;

  // Soft Next navigations often fail / skip height remount inside Framer iframes.
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isEmbedded()) return;
    e.preventDefault();
    window.location.assign(href);
  };

  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={className}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}

export function LeaderboardTabs({
  active,
}: {
  active: "individual" | "college";
}) {
  return (
    <div className="lb-nav">
      <div className="lb-tabs" role="tablist" aria-label="Leaderboard type">
        <TabLink href={STANDINGS_PATH} active={active === "individual"}>
          Leaderboard
        </TabLink>
        <TabLink href={COLLEGE_STANDINGS_PATH} active={active === "college"}>
          College Standings
        </TabLink>
      </div>
    </div>
  );
}
