const MASTERS_URL =
  "https://india.sandiego.edu/?utm_source=Landing%20page&utm_medium=USD&utm_campaign=AI%20Grand%20Prix";

function BrainIcon() {
  return (
    <svg
      className="lb-masters-icon"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
    >
      <path
        d="M11.5 7.5c-2.4 0-4.5 1.9-4.5 4.5 0 1.1.4 2.1 1 2.9-.7.7-1.2 1.7-1.2 2.8 0 2.1 1.6 3.8 3.6 4.1v1.7c0 .8.7 1.5 1.5 1.5h1.2c.8 0 1.5-.7 1.5-1.5V11.2c0-2-1.6-3.7-3.6-3.7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M20.5 7.5c2.4 0 4.5 1.9 4.5 4.5 0 1.1-.4 2.1-1 2.9.7.7 1.2 1.7 1.2 2.8 0 2.1-1.6 3.8-3.6 4.1v1.7c0 .8-.7 1.5-1.5 1.5h-1.2c-.8 0-1.5-.7-1.5-1.5V11.2c0-2 1.6-3.7 3.6-3.7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M16 10.5v11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Bottom CTA copied from the GradRight leaderboard page. */
export function LeaderboardMastersCta() {
  return (
    <section className="lb-masters" aria-labelledby="lb-masters-heading">
      <h2 id="lb-masters-heading" className="lb-masters-heading">
        See where you can go from here.
      </h2>

      <div className="lb-masters-card">
        <BrainIcon />
        <p className="lb-masters-card-title">
          Find the program that fits where you want to go.
        </p>
        <p className="lb-masters-card-body">
          Whether you topped the leaderboard or are just getting started, a
          Master&apos;s in the U.S. could be your next step to upskill and take
          your career further.
        </p>
      </div>

      <a
        href={MASTERS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="lb-masters-btn"
      >
        Explore Master&apos;s Programs
      </a>
    </section>
  );
}
