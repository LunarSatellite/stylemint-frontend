# stylemint-admin-fe

Internal desktop console for Style Mint operators. Talks to the Style Mint
API directly at `/v1/admin/*` — it does not go through Lead360.

## Running it

```bash
npm install
cp .env.example .env.local   # then fill in the SSO values
npm run dev
```

`src/env.ts` throws on startup if a variable is missing. That is deliberate:
a missing API base URL otherwise sends requests to the console's own origin,
which 404 as HTML and surface much later as JSON parse errors.

## Types

```bash
npm run codegen
```

Generated from `../../stylemint-backend/swagger-spec.json` — 769 paths, 110
of them under `/v1/admin`. `src/api/schema.ts` is committed and never
regenerated in CI.

## What is here

| Area | State |
|---|---|
| env, axios client, interceptor chain | done |
| auth store, claim parsing, route guards, multi-tab logout | done |
| error registry, query keys, staleTime policy | done |
| step-up MFA wrapper | done |
| KYC queue (query + optimistic decide) | first slice |
| moderation, payouts, admin accounts, flags, audit, MFA settings | endpoints exist, screens do not |

`npm test` covers claim parsing and the interceptor chain. Both were
mutation-tested: removing the `Idempotency-Key` line or the SSO token
exclusion makes them fail.

## The two rules worth knowing before editing

**The token lives in memory only.** Not localStorage, not a cookie. A refresh
signs the operator out until the silent SSO frame completes, and that cost is
paid on purpose — this console can revoke sessions, force payouts and strip
MFA from other admins.

**Switch on `errorCode`, never on HTTP status.** A 401 can mean "log in
again", "your token was replayed" or "someone ended your session", and those
want three different screens.
