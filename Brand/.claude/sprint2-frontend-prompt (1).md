# Sprint 2 Frontend — Part A: Control Plane Portal

This file covers **Part A only** — the control plane portal (`aurora.io`) — signup + account management.

> **Part B** (Data Plane Onboarding — ERP connection, agent setup, schema discovery) has been moved to its own refined file:
> **`sprint3-frontend-onboarding.md`** — use that file for all Part B implementation.

Frontend conventions: React 18, Vite, TypeScript, TanStack Query v5, React Router v6, Tailwind CSS v4, Zod + react-hook-form, ECharts for charts.

---

## Control Plane Portal (aurora.io)

### Backend running at `localhost:5100`

| Method | Route | Body | Response |
|--------|-------|------|----------|
| POST | `/api/v1/accounts/signup` | see `SignupRequestDto` below | `AccountDto` |
| GET | `/api/v1/accounts/{id}` | — | `AccountDto` with nested `dataPlanes[]` |
| GET | `/api/v1/accounts/{id}/billing` | — | `BillingMeterDto` |
| POST | `/api/v1/accounts/{id}/data-planes` | `{ subdomain, region, tierIsolation }` | `DataPlaneDto` |
| PATCH | `/api/v1/accounts/{id}/status` | `{ status }` | 200 OK |

All responses: `{ success: bool, data: T, message: string, errors: string[] }`

### TypeScript types

```typescript
// ── Enums ──────────────────────────────────────────────────────────────────
export type PlanTier        = 'Starter' | 'Professional' | 'Enterprise';
export type AccountStatus   = 'Pending' | 'Active' | 'Suspended' | 'Churned';
export type DataPlaneStatus = 'Provisioning' | 'Active' | 'Suspended' | 'Deprovisioned';
export type TierIsolation   = 'SharedNamespace' | 'DedicatedCluster';
export type BillingPeriodStatus = 'Open' | 'Closed' | 'Invoiced';
export type EmployeeRange   = 'Under50' | 'Fifty200' | 'Over200';

export type ErpSystemType =
  | 'BusinessCentral'
  | 'LsRetail'
  | 'LsCentral'
  | 'SapEcc'
  | 'SapS4Hana'
  | 'OracleEbs'
  | 'MicrosoftNav'
  | 'MicrosoftAx'
  | 'Workday'
  | 'Salesforce'
  | 'NetSuite'
  | 'DynamicsCe'
  | 'Custom';

// ── Request DTOs ────────────────────────────────────────────────────────────
export interface SignupRequestDto {
  // Step 1 — Account
  companyName: string;
  email: string;
  billingEmail?: string;
  planTier: PlanTier;
  region: string;
  // Step 2 — Company Profile
  country: string;
  city?: string;
  employeeRange: EmployeeRange;
  industry: string;
  erpSystems: ErpSystemType[];  // min 1 required
}

export interface CreateDataPlaneDto {
  subdomain: string;
  region: string;
  tierIsolation: TierIsolation;
}

// ── Response DTOs ───────────────────────────────────────────────────────────
export interface DataPlaneDto {
  id: string;
  subdomain: string;
  status: DataPlaneStatus;
  provisionedAt?: string;
  apiEndpoint?: string;
  region: string;
  tierIsolation: TierIsolation;
  createdAt: string;
}

export interface AccountDto {
  id: string;
  companyName: string;
  email: string;
  planTier: PlanTier;
  status: AccountStatus;
  region: string;
  billingEmail?: string;
  country: string;
  city?: string;
  employeeRange: EmployeeRange;
  industry: string;
  erpSystems: ErpSystemType[];
  dataPlanes: DataPlaneDto[];
  createdAt: string;
}

export interface BillingMeterDto {
  id: string;
  periodStart: string;
  periodEnd: string;
  dataPlanesActive: number;
  aiCallsCount: number;
  storageGb: number;
  status: BillingPeriodStatus;
}
```

### Pages

#### 1. `SignupPage` (`/signup`)

Two-step form on a single page. Step indicator at top (Step 1 / Step 2).

**Step 1 — Account**
| Field | Input | Validation |
|---|---|---|
| Company Name | text | required, max 256 |
| Work Email | email | required, valid email |
| Password | password | required, min 8 chars |
| Plan | radio: Starter / Professional / Enterprise | required |
| Region | dropdown: UAE North / EU West / US East | required |
| Billing Email | text | optional, valid email |

**Step 2 — Company Profile**
| Field | Input | Validation |
|---|---|---|
| Country | text | required |
| City | text | optional |
| No. of Employees | radio: Under 50 / 50–200 / 200+ | required |
| Industry | dropdown: Manufacturing / Retail / Finance / Healthcare / Technology / Education / Other | required |
| ERP System(s) | checkboxes (multi-select, see list below) | min 1 required |

ERP checkbox labels (map to `ErpSystemType`):
```
✓ Business Central          → BusinessCentral
□ LS Retail                 → LsRetail
□ LS Central                → LsCentral
□ SAP ECC                   → SapEcc
□ SAP S/4HANA               → SapS4Hana
□ Oracle EBS                → OracleEbs
□ Microsoft Dynamics NAV    → MicrosoftNav
□ Microsoft Dynamics AX     → MicrosoftAx
□ Workday                   → Workday
□ Salesforce                → Salesforce
□ NetSuite                  → NetSuite
□ Dynamics 365 CE           → DynamicsCe
□ Custom / Other SQL        → Custom
```

**Submit behaviour:**
- Step 1 "Next →" validates step 1 fields only, advances to step 2
- Step 2 "Create Account" validates both steps and posts to `POST /api/v1/accounts/signup`
- On 201: store `accountId` in `localStorage('cp_account_id')`, redirect to `/dashboard/{accountId}`
- On 409: show "An account with this email already exists"
- On 400: show field-level errors from `errors[]`
- Step 2 has "← Back" to return to step 1 without losing values

#### 2. `DashboardPage` (`/dashboard/:accountId`)

- Fetch account: `GET /api/v1/accounts/{id}`
- Fetch billing: `GET /api/v1/accounts/{id}/billing`

**Account card** (top)
- Company name (h1)
- Plan badge: Starter=blue, Professional=purple, Enterprise=gold
- Status badge: Pending=gray, Active=green, Suspended=amber, Churned=red
- Region / Country / Industry / Employees
- ERP systems as small chips (color-coded per family: BC=blue, SAP=orange, Oracle=red, MS=teal, Other=gray)
- Created date

**Data Planes section**
- Table or card grid, one row per data plane
- Columns: Subdomain, Status pill, Provisioned At, API Endpoint (link), Region, Isolation
- "Provisioning" status shows a spinner + auto-refetch every 10s until Active
- "Add Data Plane" button → opens modal

**Billing Meter card** (bottom or sidebar)
- Period (formatted: "May 1 – May 31, 2026")
- Data Planes Active / AI Calls / Storage GB
- Status badge (Open=blue, Closed=gray, Invoiced=green)

#### 3. `AddDataPlaneModal`

- Fields: Subdomain (text, required), Region (dropdown), Tier Isolation (radio)
- Dedicated Cluster only enabled when plan = Enterprise (show tooltip otherwise)
- POST to `/api/v1/accounts/{id}/data-planes`
- On success: close modal, invalidate account query (TanStack), show toast

### Folder structure

```
frontend/control-plane/
├─ src/
│  ├─ api/
│  │  ├─ types.ts                     TypeScript types
│  │  └─ control-plane-api.ts         API client (typed fetch)
│  ├─ pages/
│  │  ├─ SignupPage.tsx                2-step signup form
│  │  ├─ DashboardPage.tsx            Account + data planes + billing
│  │  └─ NotFound.tsx
│  ├─ components/
│  │  ├─ SignupStep1.tsx               Step 1 sub-form
│  │  ├─ SignupStep2.tsx               Step 2 sub-form (company profile + ERP checkboxes)
│  │  ├─ AddDataPlaneModal.tsx
│  │  ├─ BillingMeterCard.tsx
│  │  ├─ DataPlaneList.tsx
│  │  ├─ ErpChip.tsx                  Small colored chip for ERP type display
│  │  └─ Navbar.tsx
│  ├─ hooks/
│  │  └─ useAuth.ts                   accountId from localStorage
│  ├─ App.tsx
│  ├─ main.tsx
│  └─ index.css
```

### Acceptance criteria

- [ ] SignupPage: 2-step flow, step 1 validates independently, ERP checkboxes (min 1), full Zod validation
- [ ] DashboardPage: account details, ERP chips, data plane list with provisioning spinner, billing card
- [ ] AddDataPlaneModal: Enterprise-only guard on Dedicated Cluster
- [ ] API client: typed, TanStack Query, error handling
- [ ] Routing: `/`, `/signup`, `/dashboard/:id`, 404
- [ ] Styling: Tailwind, responsive, color-coded badges and chips
