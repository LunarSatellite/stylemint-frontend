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

Until SSO is configured, `?devToken=<jwt>` seeds the auth store. It is behind
`import.meta.env.DEV`, which Vite replaces with a literal `false` in a
production build, so the branch is dropped entirely — verified by grepping the
bundle, not assumed.

## Types and contracts

```bash
npm run codegen
```

Writes two committed artifacts from `../../stylemint-backend/swagger-spec.json`:

- `src/api/schema.ts` — generated types
- `src/api/request-bodies.json` — the field names each endpoint accepts, read
  by the contract guard so it works in CI with only this repository checked out

## Screens

| Area | State |
|---|---|
| KYC review | queue, decide, optimistic, step-up |
| Moderation | queue, all six outcomes |
| Post reports | queue; post actions and report resolution kept separate |
| Recipe drafts | model-written recipes awaiting sign-off |
| Featured matches | approval queue with the fairness audit above it |
| Audio | broken-links queue and all tracks; hide and restore |
| Couriers | lookup by ID, seven of nine operations |
| Admin accounts | roles, disable/enable, revoke sessions, remove MFA |
| Audit log | list and filter |
| Feature flags | list |
| Popular searches | list and toggle |
| My security | MFA status and sessions |
| Payouts | **not built** — see below |

## What is not built, and why

**Payouts, reels, reputation, insurance, payments** have admin write endpoints
and no admin read. There is nothing honest to list them against, so the screens
do not exist. Tracked in
[stylemint-backend#133](https://github.com/LunarSatellite/stylemint-backend/issues/133).

**Couriers** is a lookup rather than a browse for the same reason — nine
operations, no list endpoint. `GET /v1/courier/{id}` is not admin-scoped, so
the page says a failure may mean "not permitted" rather than "not found".

## Four paging conventions

Worth knowing before adding a list, because getting it wrong looks like missing
data rather than a bug:

| Shape | Used by |
|---|---|
| `PagedList` — `pageNumber`, `totalPages` | most admin lists |
| `CursorList` — `cursor`, `nextCursor`, `hasMore` | audio, matchmaking |
| bare array + `take` | social-feed reports |
| bare array + `skip`/`take` | recipe drafts |

## The guards

`npm test` runs the usual unit tests and three checks that exist because the
mistakes they catch are invisible to TypeScript and to a live server:

- **`request-bodies-match-the-spec`** — every field a mutation posts must exist
  on the endpoint. ASP.NET ignores unknown properties, so sending `reasonCode`
  where the API wants `decisionReasonCode` returns 200 and silently drops the
  reviewer's reason. This already happened once.
- **`step-up-is-not-optional`** — any call to one of the eight step-up
  endpoints must use `useMutationWithStepUp`. A plain mutation gets
  `mfa.step_up_required` back, has no idea what it means, and shows the
  operator a toast telling them to verify with nothing to verify against.
- **the `StepUpDialog` mount check** — exactly one mount. Zero leaves the
  mutation pending for ever; two have both copies racing to settle one promise.

Each is mutation-tested: break the thing it guards and it fails, naming the file.

## Two rules worth knowing before editing

**The token lives in memory only.** Not localStorage, not a cookie. A refresh
signs the operator out until the silent SSO frame completes, and that cost is
paid on purpose — this console can revoke sessions, force payouts and strip MFA
from other admins.

**Switch on `errorCode`, never on HTTP status.** A 401 can mean "log in again",
"your token was replayed" or "someone ended your session", and those want three
different screens.
