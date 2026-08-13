# USD Knowledge Challenge

Next.js quiz app with Google Sheets backend, downloadable results PDF, and a live leaderboard.

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
