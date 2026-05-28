# Admin Dashboard

Internal Next.js ops dashboard.

Use the repo root [README](</c:/Projects/LoadSetu/README.md>) as the main runbook. This file is only the admin-specific quick reference.

## Run

```bash
cd admin-dashboard
npm install
npm run dev
```

Default local URL:

- `http://localhost:3001`

## Current Status

- Production build passes with `npm run build`
- Useful for quick visibility into loads, matches, trucks, and service health

## Fresh Clone Notes

- Add `.env.local` only if you need to override the backend base URL
- Start backend and ML before opening the dashboard
