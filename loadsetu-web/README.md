# LoadSetu Web

Next.js shipper and operations frontend.

Use the repo root [README](</c:/Projects/LoadSetu/README.md>) as the main runbook. This file is the web-specific quick reference.

## Run

```bash
cd loadsetu-web
npm install
npm run dev
```

Default local URL:

- `http://localhost:3000`

If port `3000` is busy, Next may move to another port such as `3002`.

## Main Areas

- Landing page
- Login and shipper registration
- Dashboard routes under `src/app/(dashboard)`
- Load creation and My Loads
- Match visibility via `/api/v1/matches/{loadId}`

Key files:

- `src/app/login/page.tsx`
- `src/app/register/page.tsx`
- `src/components/features/Loads/MyLoads.tsx`
- `src/lib/api/hooks.ts`

## Verification Notes

- Dev server starts locally
- Production build should pass with `npm run build`
- Landing page and dashboard depend on valid backend URLs and local env config

## Fresh Clone Notes

- Add `.env.local` if your backend URL differs from local defaults
- Start Spring Boot and ML before testing load creation and match visibility
