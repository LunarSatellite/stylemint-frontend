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
- Build, lint and test only on the VPS in Docker (see README) - never on the Windows workstation.
