# stylemint-admin-web

The StyleMint operations console at `/admin/`. Adapted from `Admin/CLAUDE.md` (the earlier
Tailwind/Radix console) to the decided stack and design: **Mantine 7, matching Voyager CX**.

## Stack

Vite · React 18 · TypeScript strict · Mantine 7 (core, dates, notifications, modals) · React Router 6 ·
TanStack Query 5 · zod · Vitest + Testing Library. No axios, no zustand, no Tailwind.

## Rules

- Same origin: call `/v1/...` through `src/api/client.ts` (`http.*` / `request`). Never `fetch` directly,
  never a base URL. The client adds the bearer, an `Idempotency-Key` on every write (some endpoints
  require it), `Accept-Language`, and the 401 → refresh-or-end-session handling.
- Wire facts (verified against the backend source): JSON is camelCase; **enums are numbers** in bodies and
  DTOs (a few DTO fields are pre-stringified - see each api module); money is decimal major units with a
  separate currency (`NPR`). Paging comes in four shapes - always normalise with `toPage()`.
- Errors: switch on `ApiError.code` (`errorCode`), not the status. `admin.step_up.required` → `withStepUp`;
  `admin.session.*` / empty 401 → session ends; `auth.forbidden` → forbidden state.
- Roles: never check a role string inline - add a capability to `src/auth/roles.ts`, copied from the
  endpoint's `[RequireAdminRole]`. SuperAdmin passes everything.
- Lists: `DataTable` + `useListState` (+ `useCursorPages` for cursor lists) + `DetailDrawer`.
  Writes: `useActionDialog` with a consequence sentence and a reason field when the API takes one.
- States: loading skeleton, error (with retry and correlation id), forbidden, empty vs "no matches" -
  never show "none" for "could not load". Missing endpoints (bare 404) render `NotAvailableBlock`.
- Tokens: session in memory + this tab's sessionStorage only. Never localStorage/cookies for tokens.
- Never `dangerouslySetInnerHTML` (lint enforces). Audit payloads render as text.
- Identity numbers are masked (`mask`, `maskPhone`, `maskEmail`); document files load only on request.
- Colours come from the theme / `--sm-*` variables in `index.css`, not hex in components.
- Service vendors (`api/services.ts`, `D:\Stylemint\wt\service-*-contract.md` v1): KYC review shows the vendor's
  `serviceCategory` + licence (bank = NRB licence number); `/bookings` = service bookings overview (search, cancel,
  refund retry) and `?tab=commission` (category + per-vendor percent, 0–50). Capabilities `viewBookings` /
  `manageBookings`.
- Service items in orders (`service-cart-contract.md` v1): sub-orders with `fulfillmentChannel: "Service"` (`channelLabel`)
  show booking lines (`isServiceLine`; missing `lineKind` = product) in the order drawer — dates, guest names, booking
  number, paid now vs pay at venue, "Open booking" → `/bookings?open=<id>` for `viewBookings`; no shipping rows.
- Journeys (`api/journeys.ts`, `features/journeys/`, `journey-reels-contract.md` v1 §5): `/journeys` list (search title /
  city / business / id, status, vendor id; page-numbered), drawer with members and every step (closed ones too), "End
  journey…" with a required reason (3–500). Behind `viewModeration` / `decideModeration` (server also lets SupportAgent read).
- Build, lint and test only on the VPS in Docker (see README) - never on the Windows workstation.
- Platform commission (`api/commission.ts`, `features/commission/`, `platform-commission-contract.md` v1.0 §1, §3, §4):
  `/commission` under Orders & money — category tree with per-row rate (0–50, 2 decimals, `PUT {ratePercent}`, null
  clears; optimistic + rollback + toast), effective rate / "inherited from", history drawer, summary tiles for a date
  range. Read `viewPayouts`; edit `holdPayouts` (SuperAdmin + PayoutsOps, as the endpoint). Bare 404 → not deployed.
- Refunds desk (`api/refunds.ts`, `features/refunds/`, `refunds-desk-contract.md` v1.0 §2, §5): `/refunds` under Orders &
  money — cards from `/summary` (to settle, settled this month, to settle by method), tabs To settle (default) /
  Completed / All (`?view=`), method + date + search filters, cursor list. "Mark refunded" modal says what to pay
  (eSewa: portal + original transaction; COD: amount to the buyer's name + full phone) and takes reference (1–100) +
  optional note (≤500); the Idempotency-Key is kept for a retried identical submission (`request({ idempotencyKey })`).
  409 `REFUND_ALREADY_SETTLED` → toast + refresh; 422 `REFUND_NOT_MANUAL` → inline. Drawer shows the attempt history.
  `viewRefunds` / `settleRefunds` (SuperAdmin + PayoutsOps). Bare 404 → not deployed.
