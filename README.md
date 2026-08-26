# USD Knowledge Challenge

Next.js quiz app with downloadable results PDF and a live leaderboard.
Data is stored in Postgres (Neon) and can fall back to Google Sheets/Apps Script.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Public leaderboard API

No auth required. Returns every ranked participant with **name**, **rank**, and **score** only.

```
GET /api/standings?limit=100
```

Local:

```
http://localhost:3000/api/standings?limit=100
```

Example response:

```json
{
  "entries": [
    { "name": "Shubhanshu Singh", "rank": 1, "score": 22 },
    { "name": "Alex Kumar", "rank": 2, "score": 20 }
  ]
}
```

| Field   | Description                          |
| ------- | ------------------------------------ |
| `name`  | Participant display name             |
| `rank`  | 1-based position on the leaderboard  |
| `score` | Total correct answers                |

`limit` is optional (default `100`, max `100`).

The UI leaderboard is at [/leaderboard](http://localhost:3000/leaderboard).

## Embedding in Framer (iframe)

Embed the quiz on your Framer site so users stay on your page:

```
https://usd-ai-quiz.vercel.app/
```

Users do **not** need to leave your site. The quiz runs inside the iframe.

If the browser blocks `localStorage` in the iframe, the app keeps the session **in memory** for that visit and still saves registration/answers to the server. If someone refreshes mid-quiz, they can continue with **Already registered?** and their email.

### Auto height (no iframe scroll)

Framer’s built-in **URL Embed** cannot use Height → Fit. Use a **Code component** that listens for our height messages and grows the iframe. Put page scroll on the Framer page (or the parent stack), not inside the iframe.

1. Assets → Code → New component (e.g. `AutoHeightEmbed`).
2. Paste:

```tsx
import { addPropertyControls, ControlType } from "framer"
import { useEffect, useState } from "react"

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export default function AutoHeightEmbed(props) {
  const { url, minHeight, style } = props
  const [height, setHeight] = useState(minHeight || 400)

  useEffect(() => {
    function onMessage(event) {
      const data = event.data
      if (
        data?.source === "usd-ai-quiz" &&
        data?.type === "embed-height" &&
        typeof data.height === "number" &&
        data.height > 0
      ) {
        setHeight(Math.max(minHeight || 0, Math.ceil(data.height)))
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [minHeight])

  return (
    <iframe
      src={url}
      title="AI Grand Prix"
      style={{
        ...style,
        width: "100%",
        height,
        border: "none",
        display: "block",
        overflow: "hidden",
      }}
      scrolling="no"
    />
  )
}

addPropertyControls(AutoHeightEmbed, {
  url: {
    type: ControlType.String,
    title: "URL",
    defaultValue: "https://usd-ai-quiz.vercel.app/leaderboard",
  },
  minHeight: {
    type: ControlType.Number,
    title: "Min Height",
    defaultValue: 400,
    min: 0,
    step: 10,
  },
})
```

3. Drop that component on the canvas (not the default URL Embed).
4. Set URL to `/leaderboard` or `/college-leaderboard`.
5. Let the Framer page (or a scrolling parent) scroll — do not put Height → Fit on a URL Embed.

Framer tip: avoid a restrictive `sandbox` on the iframe.

## Postgres (Neon) setup
1. Create/initialize a Neon Postgres database.
2. Copy your connection string into `.env.local` as `DATABASE_URL`.
   - Must include `sslmode=require` (Neon requires SSL).
3. Create the schema:
   - `psql "$DATABASE_URL" -f scripts/db/init.sql`
   - Or open `scripts/db/init.sql` in the Neon SQL editor and run it.

Once `DATABASE_URL` is set, the backend uses Postgres-first for:
- `/api/register`
- `/api/resume`
- `/api/progress` (GET + POST)
- `/api/leaderboard` and `/api/standings`
