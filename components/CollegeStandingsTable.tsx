"use client";

import type { CollegeStanding } from "@/lib/collegeStandings";

interface CollegeStandingsTableProps {
  rows: CollegeStanding[];
  loading?: boolean;
}

export function CollegeStandingsTable({
  rows,
  loading = false,
}: CollegeStandingsTableProps) {
  return (
    <div className="cl-wrap" aria-busy={loading || undefined}>
      <header className="cl-heading">
        <p className="cl-kicker">AI Grand Prix</p>
        <h1 className="cl-title">College Ranking</h1>
      </header>

      <div className="cl-table-shell">
        <div className="cl-table" role="table" aria-label="College standings">
          <div className="cl-head" role="row">
            <span className="cl-cell cl-cell--rank" role="columnheader">
              #
            </span>
            <span className="cl-cell cl-cell--name" role="columnheader">
              College
            </span>
            <span className="cl-cell cl-cell--points" role="columnheader">
              Points
            </span>
          </div>

          {loading && rows.length === 0 && (
            <div className="cl-empty" role="status">
              Loading rankings…
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div className="cl-empty">No college standings yet.</div>
          )}

          {rows.map((row) => {
            const topThree = row.rank <= 3;
            return (
              <div
                key={`${row.rank}-${row.collegeName}`}
                className={`cl-row ${topThree ? "cl-row--podium" : ""}`}
                role="row"
              >
                <span className="cl-cell cl-cell--rank cl-rank--top" role="cell">
                  {row.rank}
                </span>
                <span className="cl-cell cl-cell--name" role="cell" title={row.collegeName}>
                  {row.collegeName}
                </span>
                <span className="cl-cell cl-cell--points" role="cell">
                  {row.combinedScore}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
