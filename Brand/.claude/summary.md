# Aurora BI — Sprint Progress Summary

> **A quick note on sprint numbers (read this first):**
> Early on, the commits numbered sprints one way, but the official plan
> (`aurora-bi-platform-blueprint.md`) numbers them differently. The blueprint is
> the boss now. Two things to know so the numbers below make sense:
> - The **5 ERP connectors** were originally called "Sprint 6" in commits, but the
>   blueprint calls that **Sprint 8** — we just built it early.
> - The blueprint's **real Sprint 6** is **"Entities + DAG"** (the plumbing the whole
>   platform sits on) — that's the newest work, described near the bottom.

---

## Sprint 1 — Discovery & Foundation

**What we did:**
- Investigated the entire codebase to understand what was already built and what was missing.
- Confirmed the tech stack:
  - Database: SQL Server (`AuroraBICloud` on Azure, `10.2.0.4`)
  - No Redis — uses in-process caching (`FusionCache`)
  - No Docker containers — bare-metal/VM deployment on Azure App Service (UAE North)
  - OpenTelemetry already wired up but not pointing anywhere yet
  - ECharts v6 for charts on the frontend
  - GitHub Actions chosen for CI/CD (folder exists but no workflows written yet)
  - Python ML service is external (`localhost:8000`) — not in this repo
- Found a **security bug**: `BackgroundJob.TenantId` is nullable, meaning background jobs aren't properly isolated per tenant. Wrote up a formal decision document (ADR-015) to fix this in Sprint 6.
- Established the **canonical plan**: `aurora-bi-platform-blueprint.md` (dated 2026-05-25) is the single source of truth for all future sprints.

**Result:** We know exactly what's in the codebase, what needs to be built, and in what order.

---

## Sprint 2 — Control Plane MVP (Backend)

**What we did:**
- Built the entire **Control Plane backend** — a separate service that runs at `aurora.io` and manages customer accounts.
- This is the "admin side" of Aurora BI — where new enterprise customers sign up.

**New project created:** `AuroraBI.ControlPlane`

**What's inside:**
- **Customer signup**: Companies can sign up with their name, email, plan tier (Starter / Professional / Enterprise), region, industry, employee count, and which ERP systems they use (Business Central, SAP, Oracle, etc.)
- **Data plane management**: Each customer gets their own isolated "data plane" (their own Aurora BI instance). The control plane tracks these.
- **Billing meters**: Tracks how many data planes are active, AI calls made, and storage used per billing period.
- **API key authentication**: The control plane uses API key auth (not JWT) since it's an internal service.
- **Database**: Separate SQL Server database (`AuroraBIControlPlane`) with its own EF Core migrations.

**Endpoints built:**
- `POST /api/v1/accounts/signup` — create a new customer account
- `GET /api/v1/accounts/{id}` — get account details + their data planes
- `GET /api/v1/accounts/{id}/billing` — get current billing meter
- `POST /api/v1/accounts/{id}/data-planes` — create a new data plane for a customer
- `PATCH /api/v1/accounts/{id}/status` — update account status (Active, Suspended, etc.)

**Result:** A customer can sign up and the system knows to create an isolated data plane for them.

---

## Sprint 3 — Agent + ERP Connection (Backend)

**What we did:**
- Built the backend features that let the **Aurora Agent** (a Windows Service running on the customer's server) connect to the cloud and register itself.
- Added support for **14 ERP system types** (Business Central, LS Retail, SAP, Oracle, Workday, Salesforce, etc.) so customers can specify which ERP they're connecting.

**What's inside:**

**Agent registration & status:**
- `POST /api/v1/agents/register` — the agent calls this to register itself and get credentials (Tenant ID, Agent ID, API Key)
- `GET /api/v1/agents/connected` — the frontend polls this to know if the agent is online (`{ isOnline, hasAgent }`)

**ERP connection from agent:**
- `POST /api/v1/connections/from-agent` — creates a source connection tied to the agent, with ERP type + name + optional description

**Control Plane auth:**
- Added API key authentication handler to the ControlPlane project so internal calls are secured.

**Result:** The agent can register, the frontend can see if it's online, and a connection to an ERP system can be created once the agent is up.

---

## Sprint 4 — Data Plane Provisioner (Backend)

**What we did:**
- Extended the Control Plane so it can **activate** a customer's data plane and **monitor its health**.
- This is the manual provisioner — no Terraform or cloud automation yet. An admin manually calls an endpoint to mark a data plane as active and record where it lives.

**New fields added to DataPlane:**
- `AgentHubUrl` — where the agent WebSocket hub is for this data plane
- `ClickHouseConnectionString` — connection string to this data plane's ClickHouse warehouse
- `HealthStatus` — whether the data plane is Healthy, Unhealthy, or Unknown
- `LastHealthCheckAt` — when we last checked

**New endpoints:**
- `POST /api/v1/admin/data-planes/{id}/activate` — records the API URL, agent hub URL, and ClickHouse connection for a data plane, marks it Active
- `GET /api/v1/admin/data-planes/{id}/health` — pings the data plane's `/health` endpoint, records the result (latency + reachable/unreachable), saves status to DB

**New DTOs:**
- `ActivateDataPlaneDto` — body for the activate endpoint
- `DataPlaneHealthDto` — response with health result

**Database migration:**
- `AddDataPlaneProvisioningFields` — adds the 4 new columns to the `DataPlanes` table

**Result:** Admins can manually activate a customer's data plane and check if it's reachable.

---

## Frontend Planning (Sprint 2 & 3 Docs)

**Also cleaned up the frontend spec files:**
- `sprint2-frontend-prompt.md` — now covers **Part A only**: the Control Plane portal UI (signup form, dashboard, add data plane modal) for `aurora.io`
- `sprint3-frontend-onboarding.md` — the canonical spec for the **data plane onboarding flow**: ERP connection form → agent setup → schema discovery (3-page flow for `acme.aurora.io`)
- `sprint2-frontend-partb-dataplane.md` — marked as superseded, redirects to sprint3 file

**The frontend for these sprints has NOT been implemented yet** — these are spec/planning documents ready to hand to a frontend developer.

---

---

## Sprint 5 — Embedding Service + ERP Connector Foundations

**What we did:**
Sprint 5 had two parallel tracks — one about making embeddings cleaner and more reliable, and one about laying the groundwork for connecting to different ERP systems.

**Track A — Embedding Service cleanup:**

Previously, the code for generating text embeddings (turning text into numbers that AI uses for search) was mixed inside the main AI service alongside chat and completion logic. We pulled it out into its own dedicated service.

- Created a new `IEmbeddingService` interface — a clean, separate contract just for embeddings
- Created `OpenAiCompatibleEmbeddingService` — the actual implementation that calls the embedding endpoint
- Added an `IsConfigured` check — if the embedding endpoint isn't set up in config, every call gracefully skips instead of crashing
- Updated `DocumentReaderService` and `QueryCacheService` to use the new service directly instead of going through the AI service
- Created `EmbeddingBackfillWorker` — a background job that runs on startup and fills in any missing embeddings for old document chunks that were stored before embeddings were wired up. It runs in batches of 50 and exits cleanly if embeddings aren't configured.

**Track B — ERP connector interfaces (blueprints, no code yet):**

This track is about building the "blueprint" that all future ERP connectors will follow. No actual connector logic was written — just the shape/contract that connectors must follow. This is so future work (Sprints 8, 10, 12) can implement without redesigning the structure.

- `ISourceConnector` — the interface every ERP connector (BC, SAP, Oracle, etc.) will implement. Defines: harvest schema, supports agent mode, supports cloud mode.
- `ISchemaProbe` — the interface for probing a source and reading its tables/columns (the "Schema Harvester" in Sprint 12)
- `IPlatformIdentifier` — the interface for detecting which ERP system is connected (the "Platform Identifier" in Sprint 10)
- `HarvestedSchema` — the data model that represents what was read from the ERP: tables, columns, relationships, computed fields, customizations
- `SourceDescriptor` — the data model that represents what platform was detected: system type, version, deployment mode, confidence score, evidence
- Added two new enums to the shared enum file: `SourceSystemFamily` (BC, SAP, Oracle, etc.) and `SourceDeploymentMode` (OnPremise / Cloud / Hybrid)

**Result:** Embeddings are now a proper standalone service with graceful degradation. All future ERP connector work has a clear interface to implement against.

---

## The Connectors + Security Fix (DONE) — commits labeled "Sprint 6", blueprint Sprint 8

This had two parallel workstreams. Both are now complete.

### Workstream 1 — BackgroundJob security fix (DONE)

**What was wrong:**
Every background job (warehouse design, ETL, classification, etc.) had a `TenantId` column on it that was supposed to keep one customer's jobs separate from another's. The problem: the column was *nullable*, and the database's automatic tenant filter doesn't apply to nullable columns. Any code that used `FindAsync` to look up a job by ID was bypassing tenant scoping entirely — a cross-tenant leak waiting to happen. Seven places in the code were confirmed unsafe.

**What we did:**
Per ADR-015 (the formal decision document written in Sprint 1), we dropped the `TenantId` column entirely instead of trying to make it required. The reasoning: under the new architecture each customer gets their own isolated database (data plane), so filtering by tenant inside one customer's database achieves nothing. Removing the column eliminates the whole bug class rather than papering over it.

- Removed `TenantId` from the `BackgroundJob` entity and the `JobStatusDto`
- Removed the tenant-filtered database index, replaced with a simple created-date index
- Stripped tenant filters / assignments from 8 places: `JobsController`, `SchemaDiscoveryController`, `EtlController`, `DashboardsController`, `ClassificationController`, `ClientAppController`, `JobDispatcherWorker`, `AiEnrichmentDispatcherWorker`
- Dropped a no-longer-needed parameter from `WarehouseDesignJobEnqueuer.TryEnqueueDefaultAsync` and updated both callers
- New EF migration: `DropBackgroundJobTenantId`
- Updated `AutoEnqueueOnDiscoveryTests` — all 7 tests still pass

**Why this is safer than the alternative:** Making the column non-nullable would have required every caller to remember to filter by tenant. Dropping it means future code *cannot* re-introduce the bug — the field simply doesn't exist anymore.

---

### Workstream 2 — ERP connector implementations (all 5 done)

Sprint 5 only landed the *interfaces* for the connector system — there were no actual implementations. Sprint 6 is filling that in by writing one connector per supported ERP. Each connector wraps the existing schema-discovery code and exposes it through the common `ISourceConnector` contract.

**Why this matters:** Today the schema discovery code has if/else branches for each platform scattered around `SchemaDiscoveryService`. As we add more ERPs, that gets unmanageable. The connector pattern lets each platform plug in its own logic without touching the rest of the system.

**Connectors built so far:**

| # | Connector | Transport | Notes |
|---|-----------|-----------|-------|
| 1 | **BusinessCentralConnector** | Agent SQL (on-prem) OR Azure AD direct (cloud) | The reference implementation. Routes based on `IsCloudDirect`. |
| 2 | **BusinessCentralAdlsConnector** | ADLS Gen2 / CDM JSON files | A completely different transport — no SQL endpoint. Reads schema from CDM sidecar files in Azure Data Lake. |
| 3 | **LsCentralConnector** | Same as BC (LS Central is a BC extension) | Differs from BC only in the system-type label so downstream classification can branch on LS-specific tables. |
| 4 | **LsRetailConnector** | Agent SQL only | Legacy product. Cloud-direct mode is disabled — the base class honors this flag and routes via agent even if `IsCloudDirect=true` is set on the connection. |
| 5 | **CustomConnector** | Agent SQL (on-prem) OR Azure AD direct (cloud) | The customer's own/custom SQL database. Same dispatch as BC; differs only in the system-type label so it's treated as an unknown, fully-AI-driven schema (no BC table shortcuts). **This was the last connector — all 5 are now done.** |

**Shared base class — `AgentOrDirectSqlConnectorBase`:**
Three of the four (BC, LsCentral, LsRetail) share an abstract base. Each concrete class is now just ~15 lines: system type, display name, log tag, constructor. The base handles the dispatch (agent vs direct SQL), error handling, logging, and mapping to the shared `HarvestedSchema` format.

**Helper — `AgentMetadataMapper`:**
A pure (no DI, no network) static class that converts the raw agent/SQL output format (`AgentTableMetadata`) into the platform-agnostic `HarvestedSchema` that Phase 1+ consumes. Exercised by isolated unit tests.

**Registry — `SourceConnectorRegistry`:**
A lookup service that maps any `SourceSystemType` enum value to its connector. Callers don't need to know which connectors exist — they just ask the registry. Returns null for unsupported types.

**Important: this is additive.**
The existing schema discovery flow still works exactly as before. The connectors are registered in DI and ready to use, but `SchemaDiscoveryService` hasn't been switched over yet. The wholesale migration to use the registry is planned for Sprint 7+. This was the safe way to prove the abstraction works without breaking anything live.

---

### Test coverage for Sprint 6 so far

- **BackgroundJob fix:** 7/7 affected integration tests pass
- **Connectors:** 19/19 tests pass
  - Pure mapping tests (raw metadata → HarvestedSchema)
  - Contract tests for each connector (system type, display name, supports flags)
  - Dispatch routing tests (does BC route to agent or direct SQL correctly when cloud-direct is on/off?)
  - Failure-path tests (does an ADLS exception surface as a clean failure result?)
  - Registry lookup tests
- Full solution builds clean with 0 errors

### Connector commits on `newaurorabi`

1. `fe070bce` — Drop BackgroundJob.TenantId per ADR-015
2. `4b9c4064` — BusinessCentralConnector
3. `b13692e2` — BusinessCentralAdlsConnector
4. `fd7e6a8f` — LsCentralConnector
5. `71513c27` — LsRetailConnector + extract AgentOrDirectSqlConnectorBase
6. `42b800a9` — CustomConnector (the 5th and final connector)

---

## Blueprint Sprint 6 — The Foundation: Entities + DAG (DONE)

**This is the newest and biggest piece of work.** Before this, the connectors and control plane existed, but the core "plumbing" that the rest of the platform needs was missing. This sprint built that plumbing.

Think of it like laying the foundation and wiring of a house before you put up walls. None of it is flashy, but everything later depends on it.

### 1. 14 new database tables (the data model)

We added 14 new tables that the whole roadmap rests on. In plain terms:

- **`SourceSystem` + `SourceCompany`** — record each ERP a customer connected and the companies inside it (e.g. a Business Central install with 3 companies).
- **The DAG tables** (`EtlDagDefinition`, `EtlDagNode`, `EtlDagRun`, `EtlDagNodeRun`) — a "DAG" is just a to-do list where some steps must wait for earlier steps to finish (extract → transform → load). These tables store the recipe and track each run step-by-step.
- **`ExtractionWatermark`** — remembers "last time we pulled data up to here," so the next pull only grabs new/changed rows instead of everything.
- **`BronzeLoadRun`** — a record of each raw data load into the warehouse (how many rows, when, success/fail).
- **`SchemaProposalVersion`** — stores each version of the AI-designed warehouse layout the customer will approve later.
- **`IdempotencyLog`** — a "we already did this" ledger (explained below).
- **`AuditLog`** — a tamper-proof history of every important action (for compliance — SOX/HIPAA/GDPR).
- **`PlatformKnowledgeSource`, `PlatformPromptTemplate`, `PlatformBusinessRule`** — storage for the vendor docs, AI prompt templates, and business rules the AI will use later.

**Important:** none of these tables have a "TenantId" column. That's on purpose — each customer gets their own separate database, so there's no need to tag rows by customer (and it can't leak — the bug we fixed in Workstream 1).

### 2. The DAG Coordinator (the conductor)

A new service, `IDagCoordinator`, runs those to-do lists:
- It starts a run, creating one tracked step per task.
- A step can only start once all the steps it depends on have **succeeded** — it refuses to start early.
- It walks each step Pending → Running → Success.
- If a step **fails**, the whole run is marked failed and the steps that depended on it are marked "Skipped" (no point running them).

### 3. The Idempotency Service (the "don't do it twice" guard)

A new service, `IIdempotencyService`, makes jobs safe to retry. Before a job does something with side effects, it "claims a ticket." If someone tries to run the **same job again** after it already finished, it's **blocked** — no double-charging, no duplicate data. But if a job genuinely **failed**, a retry is allowed. This is what makes the whole system reliable when things hiccup.

### 4. The Audit Chain Service (the tamper-proof logbook)

A new service, `IAuditChainService`, writes the audit log so that each entry is mathematically linked to the one before it (a "hash chain"). If anyone edits or deletes a past entry, the chain breaks and we can detect it. There's a `VerifyChain` method that checks the whole history is intact.

### 5. Hangfire queue separation (fair traffic lanes)

Background jobs now run in **three separate lanes**: `default` (quick/interactive), `schema` (schema work), and `etl` (heavy bulk loads). The heavy ETL lane is lowest priority, so a giant data load can't block quick interactive jobs from running. Like an express lane at the checkout.

### Tests + build

- **6 new automated tests** prove the foundation works: a 3-step DAG advances start-to-finish, a finished step can't be re-run (idempotency blocks it), a failed step can be retried, steps wait for their dependencies, and a failure correctly fails the run and skips the rest. **All 6 pass.**
- Full solution builds clean — **0 errors**.
- One honest caveat: the new database tables have a migration written but **not yet applied to a live database**, and the end-to-end run hasn't been tested on a real deployed customer environment (we can't reach one from here). The logic is proven by the automated tests.

### Foundation commits on `newaurorabi`

1. `fa98b50e` — Phase 0 foundation: entities + DAG + idempotency + audit + queues
2. `f16b7db4` — the 6 unit tests
3. `d41a0e76` — updated the plan docs to match reality

---

## Blueprint Sprint 7 — Future-Proof Warehouse + Traffic Control (DONE)

This sprint had two independent goals: make the database engine upgradeable without touching any schema, and stop any one user from overloading the system.

### 1. The "flip a switch" warehouse upgrade (DDL emitter)

**The problem it solves:** ClickHouse (the analytics database Aurora uses) has two engine modes — a basic single-server mode (`MergeTree`) and a high-availability clustered mode (`ReplicatedMergeTree`). Today customers start on the basic mode. When they grow and need the clustered mode, you'd normally have to rewrite every table definition — a painful migration.

**What we built:** A new component called `ClickHouseDdlEmitter` (a DDL emitter — "DDL" just means the code that creates tables). It sits between Aurora and ClickHouse and decides which engine to use based on a single config flag:

- **Flag OFF** (default) → creates tables in basic single-server mode
- **Flag ON** → creates the exact same tables in clustered mode, with all the right ClickHouse ZooKeeper paths automatically

Upgrading a customer from single-server to clustered ClickHouse is now just changing one line in the config file. No schema rewrite, no migration, no downtime risk.

**What it produces (example):**

Flag OFF:
```
ENGINE = MergeTree() ORDER BY (date_key)
```

Flag ON:
```
ENGINE = ReplicatedMergeTree('/clickhouse/tables/aurora_warehouse/sales_fact', '{replica}') ORDER BY (date_key)
```

The warehouse table builder in the code (`WarehouseDesignService`) now calls this emitter instead of hard-coding the engine name, so all table creation automatically goes through it.

### 2. Per-user rate limiting (traffic control)

**The problem it solves:** Some API endpoints are expensive — the AI query endpoint, the schema discovery endpoint, the dashboard AI features. Without limits, a single user hammering these could slow down everyone else or rack up huge AI costs.

**What we built:** A traffic cop at the API layer. Every request is tagged by user (using the login token), and each user gets a limit:

| Endpoint group | Limit | Who it protects |
|---|---|---|
| AI/NLP queries, dashboards, clarifications | 20 requests per minute | AI cost + server load |
| Schema discovery, classification | 5 requests per minute | Heavy DB operations |
| Everything else | 100 requests per minute | General fairness |

If a user hits the limit, they get a clear `429 Too Many Requests` response:
```json
{ "success": false, "message": "Rate limit exceeded. Please try again shortly.", "errors": [] }
```

The limit is per-user (based on their login token), not per-IP — so one power user can't affect others sharing the same office network.

### Tests + build

- **9 new automated tests** prove the DDL emitter works in both modes: basic engine strings are correct, clustered engine strings have the right ZooKeeper path format, the engine type changes correctly per table type (fact table, dimension table, aggregate table), and the upgrade logic handles edge cases.
- Full solution builds clean — **0 errors**.

### Commits on `newaurorabi`

1. `2a2cc77e` — DDL emitter + rate limiting (20 files, 492 lines added)

---

## Blueprint Sprint 9 — The Onboarding Wizard (DONE)

This is the first thing a new customer sees when they log into their Aurora data plane. Instead of filling out a form, an AI holds a conversation with them — asking questions, learning about their business, and building up a complete picture of their ERP ecosystem.

### What happens across the 8 stages

Think of it like an intelligent interview that Aurora conducts with the customer's IT team:

| Stage | What happens |
|---|---|
| 1 — Welcome | Customer tells Aurora their company name, industry, country, and rough size |
| 2 — Platform Inventory | What ERP systems do you use? BC, SAP, Oracle, Salesforce? Any homegrown systems? |
| 3 — Integration Map | How do those systems talk to each other? APIs? File exports? A middleware bus? |
| 4 — Business Processes | Walk through your key workflows — purchasing, sales, payroll, financial close |
| 5 — Personas | Who will actually use the dashboards? CFO, analyst, store manager? |
| 6 — Reporting Goals | What questions do you most need answered from your data? |
| 7 — Regulatory Regime | SOX? GDPR? HIPAA? PCI? This determines how Aurora handles sensitive data |
| 8 — Review & Lock | Aurora shows everything it learned, with a confidence score per claim. Customer reviews and locks it. |

### What gets saved

At the end, Aurora has a `ClientEcosystemProfile` — a structured record of everything learned. It has 7 JSON data blocks (one per topic), a full conversation history, and an AI-written evidence trail that explains *why* Aurora believes what it does about the customer's systems.

### How AI is involved

The AI (Claude/DeepSeek) acts as the interviewer:
- It reads what's already been collected and decides what to ask next
- It parses the customer's answers into structured data
- At the end, it writes a summary of all findings with confidence scores

The AI only sees *structure* (field names, stage data, company metadata) — it never sees raw customer data values.

**Safeguards built in:**
- Conversation history is trimmed to the last 10 turns before each AI call (keeps costs low)
- If the AI API key runs out of credits, the endpoint returns a clear billing error — not a crash
- The wizard can only be finalized once all 8 stages have data — no skipping ahead
- Soft locking prevents two people from editing the same profile at the same time (auto-expires after 15 minutes)

### The API

The wizard is a REST API that a frontend (not yet built) will call:

- `POST /api/v1/onboarding` — start a new wizard
- `GET /api/v1/onboarding/active` — see the current in-progress wizard
- `POST /api/v1/onboarding/{id}/stages/{stage}` — submit data for a stage
- `POST /api/v1/onboarding/{id}/ai/ask` — send a chat message to the AI interviewer
- `POST /api/v1/onboarding/{id}/finalize` — lock the profile and trigger hand-off to the Platform Identifier

### Tests + build

- **6 new automated tests**: wizard starts at Stage 1, submitting a stage advances progress, re-submitting an old stage doesn't rewind progress, finalizing without completing all stages is blocked, lock contention returns a clear error, stale locks are correctly reclaimed.
- Full solution builds clean — **0 errors**.

### Commits on `newaurorabi`

1. `f37e5c19` — all 20 source files (6,723 lines added)
2. `4e979dae` — report + backend manual updates

---

## Blueprint Sprint 10 — The Platform Identifier (DONE)

After the onboarding wizard collects a customer's credentials, Aurora needs to automatically figure out *what* ERP they actually have — without asking them to select from a dropdown. That's what the Platform Identifier does.

### How it works

Aurora runs a series of **probes** — small, targeted checks against the customer's systems — and uses the results to determine the platform with a confidence score.

Three probes were built (Business Central family only for the POC):

| Probe | What it checks | Confidence if it works |
|---|---|---|
| **BC SaaS** | Calls the BC cloud API directly; asks for version info | 0.95 (95%) |
| **BC On-Prem** | Sends a command via the Aurora Agent to query the database for BC-specific internal tables | 0.97 (97%) |
| **BC + ADLS** | Reads the Azure Data Lake storage container, looks for BC-specific CDM data files | 0.95 if 3+ BC tables found, 0.75 if just the manifest |

### What the result looks like

Each successful probe returns a `SourceDescriptor`:
```
{
  Family: "BC",
  Version: "21.5",
  DeploymentMode: "OnPremise",
  Confidence: 0.97,
  EvidenceTrail: [
    "BC on-prem: agent online",
    "ApplicationVersion: 21.5",
    "LSCentralDetected: false"
  ]
}
```

The result is automatically saved to the database (`SourceSystem` table) so it doesn't need to be re-run every time.

### Safeguards

- If a probe throws an error (network timeout, agent offline, etc.) it is **caught silently** — it records a failed result instead of crashing
- If confidence is below 60%, the platform is considered unidentified and the API returns a clear error
- Re-running identification on the same connection **updates** the existing record rather than creating duplicates

### The API

- `POST /api/v1/platform-identifier/{connectionId}/identify` — run the probes now
- `GET /api/v1/platform-identifier/{connectionId}/result` — retrieve the last stored result

### Tests + build

- **5 new automated tests**: BC on-prem probe identified correctly, BC ADLS probe identified correctly, no matching probe returns a clear error, failed probe propagates cleanly, successful identification saves/updates the database record.
- Full solution builds clean — **0 errors**.

### Commit on `newaurorabi`

1. `61daaee3` — all 8 source files + report + manual (11 files, 809 lines)

---

## Non-BC ERP Connector Stubs (DONE) — post-POC, user-authorised

The blueprint originally marked SAP, Oracle, Workday, and Salesforce connectors as post-POC (after all 16 sprints). The team was given the green light to build them early as stubs — so the registry lists every supported ERP right now, and real integration logic can be dropped in later without any structural changes.

### What was built

Five new connectors were added, each implementing the same `ISourceConnector` interface that the BC connectors use. They are intentional stubs — they return a clear "not implemented yet" error (HTTP 501) from the data method, but their metadata (which ERP they represent, which connection modes they support) is fully declared.

| Connector | ERP | Connection mode |
|---|---|---|
| `SapEccConnector` | SAP ECC 6.x | Agent only (on-prem, no cloud API) |
| `SapS4HanaConnector` | SAP S/4HANA | Agent (on-prem) + cloud direct (OData v4) |
| `OracleEbsConnector` | Oracle E-Business Suite | Agent only (on-prem Oracle DB) |
| `WorkdayConnector` | Workday HCM / Financials | Cloud only (REST API) |
| `SalesforceConnector` | Salesforce CRM | Cloud only (REST API) |

### Why stubs rather than full connectors?

Each ERP has a completely different integration protocol (RFC/BAPI for SAP ECC, Oracle SQL for EBS, REST/SOAP for Workday, etc.). The connection protocol is baked into Phase 1.C (Schema Harvester, Sprint 12). Building full connectors now would mean implementing the harvest logic before the harvester framework exists. The stubs give the system a complete list of ERPs today; the harvest logic slots in when Phase 1.C arrives.

### How they slot into the existing system

The registry (`SourceConnectorRegistry`) already maps `SourceSystemType` → connector. The five new connectors were registered alongside the existing five. Any code that asks "give me the connector for Salesforce" will get a valid object back — it just can't harvest data yet.

### Important: no schema changes needed

The `SourceSystemType` enum already had values for `SapEcc`, `SapS4Hana`, `OracleEbs`, `Workday`, and `Salesforce` from Sprint 5. No database migration was needed — these are pure code additions.

### Tests + build

- **10 new automated tests** (2 per connector): one checks that the connector correctly identifies its ERP type, one checks that `HarvestSchemaAsync` returns a 501 "not implemented" result.
- Full solution builds clean — **0 errors**.

### Commit on `newaurorabi`

1. `a0d4c211` — all 5 connector stubs + 10 tests + DI registration + report + manual update (9 files, 409 lines)

---

## Blueprint Sprint 11 — The Knowledge Router (DONE)

After the Platform Identifier confirms which ERP a customer has, Aurora needs to understand that ERP well enough to design a sensible warehouse. That requires two things: a library of vendor documentation about the platform, and a way to measure how well the AI actually understands it. Sprint 11 builds both.

### 1. Knowledge Acquisition — indexing MS Learn

A new service (`KnowledgeAcquisitionService`) fetches BC documentation from Microsoft Learn and stores it in ClickHouse for later use by the agentic warehouse designer.

**What it does:**
- Fetches 10 known BC topic pages from `learn.microsoft.com` (setup, finance, sales, inventory, purchasing, projects, manufacturing, warehouse, HR, administration)
- Strips HTML tags to extract plain text
- Splits the text into ~500-word chunks
- Writes all chunks into a new ClickHouse table `_metadata.knowledge_chunks` (created on first run)

**Why these URLs:** MS Learn BC documentation is published under a Creative Commons (CC BY) license, meaning Aurora can legally cache and use it in full. Restricted sources (SAP Help, Oracle eTRM) would get excerpt-only treatment — that's wired up for later sprints.

**The ClickHouse table** stores: source name, ERP family, URL, chunk index, word count, content, and fetch timestamp. It's in a separate `_metadata` database (not the customer's warehouse) so it's shared infrastructure.

**Resilient by design:** if a URL fails (network error, rate limit), the service catches the error, records it, and continues with the remaining pages. It does not fail the whole batch.

### 2. Platform Knowledge Source seeding

A background service (`KnowledgeSourceSeeder`) runs once at startup and upserts the MS Learn record into the `PlatformKnowledgeSource` table (which was created in Sprint 6). Running it twice produces exactly one record — safe to restart without data duplication.

### 3. AI Competence Scoring

A new service (`KnowledgeCompetenceService`) measures how well a given AI model understands Business Central by running a fixed 5-question quiz and scoring the answers automatically.

**The 5 BC questions:**
1. What is the purpose of the G/L Entry table in BC? (keyword: "ledger")
2. What does Document No. represent on a Sales Header? (keywords: "document", "invoice", "order")
3. What is a Dimension used for in BC? (keywords: "dimension", "analysis", "reporting")
4. What table stores customer payment history? (keywords: "customer ledger", "ledger entry")
5. What does Item Ledger Entry track? (keywords: "inventory", "stock", "item")

The AI's answer is scored: 1 point if it contains any of the expected keywords, 0 if not. Total score = correct / 5. This gives a `PlatformAiCompetenceScore` like `(BC, deepseek-v4-flash, 0.80)` which the agentic loop will use in Phase 1.D to decide which AI tier to escalate to.

Each measurement is saved as a new row (append, not overwrite), so you get a historical record of how model quality changes over time. `GET /competence/{family}/{modelName}` returns the most recent measurement.

### The API

- `POST /api/v1/knowledge-router/acquire` — trigger a doc fetch for the BC MS Learn source. Rate-limited to 5/min (schema quota).
- `POST /api/v1/knowledge-router/competence/measure` — run the 5-question eval for a given family + model. Rate-limited to 20/min (AI quota). Requires AI credentials.
- `GET /api/v1/knowledge-router/competence/{family}/{modelName}` — retrieve the latest score.

### New database table (SQL Server)

- `PlatformAiCompetenceScores` — stores each competence measurement with fields: Family, ModelName, Score (decimal 0–1), QuestionsTotal, QuestionsPassed, DetailJson (full question/answer/score log for audit), MeasuredAt.

### Tests + build

- **5 new automated tests**: acquisition chunks HTML correctly, acquisition tolerates a failed URL, competence scoring computes the right score (4/5 = 0.80), competence persists a row to the database, seeder is idempotent.
- Full solution builds clean — **0 errors**.

### Housekeeping note (before applying migrations)

The migration tooling generated a second duplicate migration file (`Sprint10_KnowledgeRouter_Phase1B`). Delete it before running `dotnet ef database update` to avoid a duplicate-table error. The correct migration is `Sprint11_KnowledgeRouter`.

### Commit on `newaurorabi`

1. `cd72ae08` — all 13 new files + 6 modified files + migration + report + manual (27 files, 11,366 lines)

---

## Blueprint Sprint 12 — The Schema Harvester (DONE)

After the Platform Identifier confirms *which* ERP a customer has, the Schema Harvester asks: *what's in it?* It reads the ERP's tables, columns, foreign keys, computed fields, and customisations — producing a structured `HarvestedSchema` that is the ground truth for everything that follows (warehouse design, ETL generation, dashboard inference).

### What it does

`SchemaHarvesterService` orchestrates the harvest in a straightforward sequence:

1. **Look up the source system** — the Platform Identifier (Sprint 10) must have run first. If there is no `SourceSystem` row for the connection, the API returns a clear 422 directing the caller to run identification first.
2. **Resolve the connector** — the registry maps `SourceSystemType` → the right `ISourceConnector` implementation (BC SaaS / On-Prem / ADLS, or any of the five non-BC stubs). If nothing is registered for the type, returns 422.
3. **Call `HarvestSchemaAsync`** — each BC connector already has real OData-`$metadata` or CDM parsing logic. The five non-BC stubs return a 501 until their integration is built.
4. **Persist the result** — serialises the full `HarvestedSchema` to JSON and stores it in two new columns on the `SourceSystem` row: `HarvestedSchemaJson` (nvarchar(max)) and `LastHarvestedAt` (datetime2). Re-running harvest overwrites the previous snapshot.
5. **Log the run** — structured log: `[SchemaHarvester] Harvested {tableCount} tables, {columnCount} columns for connection {connectionId}`.

### What the result looks like

```json
{
  "connectionId": "...",
  "systemType": "BusinessCentral",
  "lastHarvestedAt": "2026-05-27T10:35:00Z",
  "tableCount": 112,
  "columnCount": 1847,
  "relationshipCount": 203,
  "tables": [ { "name": "G/L Entry", "classification": "Ledger", ... }, ... ],
  "columns": [ ... ],
  "relationships": [ ... ],
  "computedFields": [ ... ],
  "customizations": [ ... ]
}
```

The full array is stored server-side; `GET /result` deserialises and returns it on demand.

### The API

- `POST /api/v1/schema-harvester/{connectionId}/harvest` — trigger a harvest for the connection. Rate-limited to 5/min (schema quota). No AI credential required.
- `GET /api/v1/schema-harvester/{connectionId}/result` — retrieve the last persisted harvest snapshot.

### New database columns (SQL Server, `SourceSystems` table)

Two columns added to the existing `SourceSystem` entity via migration `Sprint12_SchemaHarvester`:

| Column | Type | Purpose |
|---|---|---|
| `HarvestedSchemaJson` | nvarchar(max) | Full JSON snapshot of the last harvest |
| `LastHarvestedAt` | datetime2 (nullable) | Timestamp of the last successful harvest |

### Tests + build

- **5 new automated tests**: harvest with a valid connection returns 3 tables; no connector registered returns 422; no SourceSystem row returns 422 (run Platform Identifier first); get-after-harvest deserialises correctly; get-before-harvest returns 404.
- Full solution builds clean — **0 errors**.

### Commit on `newaurorabi`

1. `8a04d84b` — all 11 source files (service, controller, DTO, entity update, EF config, migration, tests, DI registration) — 5 662 lines
2. `442f5a85` — report #106 + backend manual update

---

## Blueprint Sprint 13 — The Agentic Warehouse Designer (DONE)

This is where Aurora stops being a tool that helps a human design a warehouse and starts designing the warehouse itself — automatically, iteratively, and with proof that the result is correct.

### What it does

After the Schema Harvester (Sprint 12) has produced a full picture of the customer's ERP, Sprint 13 hands that picture to an AI and says: "Design me a data warehouse." But instead of trusting the AI blindly, it runs the AI's answer through 8 automated checks. If anything fails, it tells the AI exactly what's wrong and asks it to try again — up to 20 times — until the design passes all checks or the loop gives up.

Every attempt is saved in full: the prompt sent, the AI's response, which checks passed and which failed, and how much it cost. This means you can always see exactly how the final design was reached.

### The AI loop — how it works

```
Iteration 1:
  → Compose a prompt from the harvested schema
  → Send to DeepSeek-Chat (Tier A model)
  → Parse the JSON response into a warehouse design
  → Run all 8 validators
  → All passed? → Done (Status = Converged)
  → Some failed? → Tell AI exactly what's wrong → go to Iteration 2

...repeat up to 20 times...

If still failing after 20: Status = Failed
```

### The 8 validators (what gets checked each round)

| # | Validator | What it checks |
|---|-----------|----------------|
| 1 | **JSON Structure** | Does the AI's response parse as valid JSON with the required shape? (runs first — no point checking anything else if the JSON is broken) |
| 2 | **Table Exists** | Every table the AI mentions actually exists in the harvested schema |
| 3 | **Column Exists** | Every column the AI mentions actually exists in its table |
| 4 | **FK Joins Valid** | Every join the AI proposes maps to a real foreign key in the source database |
| 5 | **Type Compatible** | The ClickHouse data types the AI chose are compatible with the SQL Server types in the source (e.g. `nvarchar → String`, `datetime2 → DateTime`) |
| 6 | **Cardinality OK** | Fact tables have more rows than their dimension tables — if not, the fact/dimension labels are probably backwards |
| 7 | **No Cycles** | There are no circular references in the proposed joins (A joins B joins C joins A would break the ETL) |
| 8 | **Coverage Met** | Every table the customer marked as "must-have" appears in the design |

### What gets saved to the database

Three new tables were added:

- **`WarehouseDesignProposals`** — one row per design run: which source system, how many iterations it took, current status (Running / Converged / Failed / Cancelled), total cost in USD, and the final design JSON once done.
- **`DesignIterations`** — one row per AI round-trip: the prompt sent, the response received, cost, start/end time, and whether it converged.
- **`ValidatorResults`** — one row per validator per iteration: which validator, pass/fail, and the error detail if it failed.

All three cascade-delete (delete a proposal → all its iterations and validator results go with it). Cost columns use `decimal(18,6)` to handle sub-cent AI costs without rounding.

### The API

- `POST /api/v1/AgenticDesign/start` — body: `{ sourceSystemId, mustHaveTables[] }`. Creates the proposal and queues the background job. Returns 202 + `proposalId`.
- `GET /api/v1/AgenticDesign/{proposalId}` — returns the full proposal with all iterations and validator results. Poll this to watch the loop progress.

### An important design decision

The worker that runs the loop (`AgenticDesignWorker`) is a **dedicated background service** — it doesn't share the general job dispatcher with simpler jobs. This is deliberate: a 20-iteration AI loop can take several minutes. Putting it in the shared dispatcher would block quick interactive jobs from running. The dispatcher was updated to skip "AgenticDesign" job types so it never accidentally picks one up.

### Model routing — Tier A only for now

Sprint 13 always uses DeepSeek-Chat (Tier A — the cheapest, fastest model). A `ModelRouterService` was built to make this swappable without touching the loop logic. Sprint 14 will add Tier B (Claude Haiku for validation) and Tier C (Claude Sonnet as the arbiter when the loop gets stuck).

### Tests + build

- **24 new automated tests**: pass + fail case for each of the 8 validators (16 tests), prompt composition tests, model router tests.
- Full solution builds clean — **0 errors**, 67 tests pass total.

### Commit on `newaurorabi`

1. `5c23f701` — 41 files: 3 entities, 3 DTOs, 4 interfaces, 8 validators, orchestrator, worker, controller, EF migration, DI registration, 24 tests, report + manual update (7,582 lines added)

---

---

## Blueprint Sprint 14 — Full Agentic Loop: Smarter AI + Circuit Breakers (DONE)

Sprint 13 built the basic AI design loop (always using one AI model, up to 20 tries). Sprint 14 makes the loop smarter: it can switch to a better AI when stuck, slice large schemas into manageable chunks, and stop gracefully when something is clearly broken instead of grinding through all 20 iterations pointlessly.

### 1. Three-tier model escalation (trying harder AI when stuck)

The loop now tracks which model tier it is using and can escalate through three levels:

| Tier | Model | When used |
|------|-------|-----------|
| **A** | DeepSeek-Chat | Always starts here — cheapest, fastest |
| **B** | Claude Haiku | Escalates here when the same error repeats 5 times in a row |
| **C** | Claude Sonnet | Final escalation — the most capable model, used as last resort |

The escalation logic lives in `ModelRouterService`. It looks at the last 5 iterations: if they all failed with exactly the same validators, it escalates to the next tier. Escalation is one-way (A → B → C, never back down). `TierUsed` is now recorded on every iteration row so you can see in the database exactly which model was used when.

### 2. Six circuit breakers (stop when it's clearly not working)

Before Sprint 14, a broken design could grind through all 20 iterations and exhaust the full AI budget before giving up. Circuit breakers cut that short. Each circuit breaker watches for a specific warning sign:

| Circuit breaker | What triggers it | What it does |
|---|---|---|
| **Cost limit** | Total spend exceeds $0.50 USD | Stop immediately — budget exhausted |
| **Zero progress** | 5 consecutive iterations, every validator still failing | Stop — clearly stuck |
| **Empty design** | AI returned something unparseable 3 times in a row | Stop — model is not understanding the prompt |
| **Escalation ceiling** | Already on Tier C and still failing | Stop — nothing left to try |
| **Max duration** | Loop has been running for 10 minutes | Stop — something is very wrong |
| **Permanent failure** | Critical validator (JSON structure) fails after we already escalated to Tier C | Stop — the input is fundamentally broken |

All circuit breaker trips are recorded in the `ErrorMessage` field on the proposal, so you always know *why* a run was cut short.

### 3. Schema slicing (splitting a big schema into pieces)

Business Central installations with 30+ tables used to be sent to the AI as one giant prompt. That meant big prompts, more tokens, and a higher chance of the AI getting confused or missing tables.

Sprint 14 adds a `SchemaSlicerService`. Before the loop starts, it sends a cheap one-shot Tier A call to classify every table into a business domain:

| Domain | Example BC tables |
|--------|-------------------|
| **Master Data** | Customer, Vendor, Item, G/L Account |
| **Sales** | Sales Header, Sales Line, Sales Invoice |
| **Finance** | G/L Entry, Bank Account Ledger, VAT Entry |
| **Inventory** | Item Ledger Entry, Transfer Order |
| **HR** | Employee, Payroll |

Master Data is always designed first (because Sales and Finance need Customer and Item to exist). Then each other slice is designed separately — smaller, focused prompts that produce better results. The `SliceName` field on the proposal row records which slice each run covered.

If the schema has fewer than 30 tables, slicing is skipped and the whole schema is processed in one pass (as before).

### 4. Two new Tier B validators (extra safety net)

Two validators were added that use Claude Haiku (Tier B) as a second opinion — they run every 3rd iteration only, so they don't add cost on every round:

- **BusinessRuleValidator** — loads the `PlatformBusinessRule` records (the canonical BC/LS design rules stored in Sprint 6's foundation tables) and asks Haiku whether the proposed design follows them. For example: "Ledger entry tables should always be facts, not dimensions."
- **SelfConsistencyValidator** — checks that the AI's prose explanation (if any) actually matches the JSON it emitted. Prevents the model from *claiming* it designed dimension tables that don't appear in the output.

### 5. Exposed in the API

`TierUsed` (which model tier was used) now appears in the `DesignIterationDto` returned by `GET /api/v1/AgenticDesign/{proposalId}`. `SliceName` now appears in `WarehouseDesignProposalDto`. The frontend can use these to show "this iteration used Sonnet" or "this proposal covered the Sales slice."

### Database migration

A new migration (`Sprint14_AgenticDesignTierSlice`) adds the `TierUsed` column to `DesignIterations` and the `SliceName` column to `WarehouseDesignProposals`.

### Build note

Several Sprint 14 files were committed with incorrect using directives (`AuroraBI.Core.Infrastructure.AI` and `AuroraBI.Core.Models.Common` don't exist). These were fixed as part of this sprint's build-clean pass. The worker was also updated to pass the full `allIterationResults` history and current tier to `ModelRouterService.SelectTier`, which the Sprint 14 interface upgrade required.

### Commits on `newaurorabi`

1. `b6993ea3` — Sprint 14 source files (committed manually by developer)
2. `1f4f1816` — Build fix: DTO properties, namespace corrections, tier escalation wiring, migration

---

---

## Blueprint Sprint 15 — Codegen + First ETL E2E: Approve the Design, Build the Pipeline (DONE)

Sprints 13 and 14 designed the warehouse using AI. Sprint 15 is the payoff: the customer approves that design, and Aurora automatically generates all the code and wires up the pipeline that will load their data.

### What happens when you approve a design

A single API call — `POST /api/v1/AgenticDesign/{proposalId}/approve` — triggers a chain of four things:

**1. Convert the AI's design into real database rows**

The AI's converged answer (`FinalProposalJson`) is a JSON document describing the warehouse structure. Sprint 15 parses that JSON and saves it as proper `WarehouseTable` and `WarehouseColumn` rows in SQL Server — the same format used by the manual warehouse designer. Tables the AI identified as dimensions are tagged as `Dimension`; everything else is `WideFact`.

**2. Generate ClickHouse DDL (the CREATE TABLE statements)**

For each warehouse table, Aurora generates the `CREATE TABLE` SQL that will eventually run against ClickHouse. It uses the existing DDL emitter from Sprint 7, so it automatically respects the `UseReplicatedMergeTree` flag — the same table gets a single-server or clustered engine depending on configuration. The DDL is not executed yet; it is stored for the pipeline to use.

**3. Generate the ETL SQL (Bronze and Silver)**

For each table, two SQL statements are generated:
- **Bronze SELECT** — pulls raw data from the source SQL Server: `SELECT col1, col2, ... FROM SourceTable`
- **Silver INSERT** — copies and promotes data into the final warehouse table: `INSERT INTO aurora_warehouse.TargetTable (...) SELECT ... FROM bronze.SourceTable`

Again, these are stored as data — not executed yet.

**4. Create the ETL pipeline (the DAG)**

Aurora builds a 3-stage ordered pipeline for the entire design:

```
ddl_deploy
  └─▶ bronze_load:SalesFactTable
        └─▶ silver_transform:SalesFactTable
  └─▶ bronze_load:CustomerDimension
        └─▶ silver_transform:CustomerDimension
  └─▶ ... (one Bronze + Silver pair per table)
```

This is stored as an `EtlDagDefinition` (the recipe) + `EtlDagNode` rows (the steps) + an `EtlDagRun` (the execution instance, currently in Pending state). The DAG coordinator from Sprint 6 is used to kick it off.

After all this, the proposal is marked `Approved` and the response includes the DAG run ID.

### Check pipeline status

`GET /api/v1/AgenticDesign/{proposalId}/dag-status` returns the current state of the pipeline run — which nodes are Pending, Running, Succeeded, or Failed.

### What this sprint does NOT do

The DDL is not executed against ClickHouse yet, and no Bronze/Silver data is loaded. This sprint creates all the rows and wires up all the plumbing. The next sprint (ETL executor) will pick up the DAG nodes and actually run them. Think of this sprint as "laying the tracks" — the train runs in Sprint 16.

### Technical note: data consistency fix

A critical issue was caught during review: if the DAG coordinator failed to start, the `WarehouseDesignEntity` would have already been saved to the database and left orphaned (no parent relationship, dangling rows). This was fixed so the design entity is only persisted **after** the DAG coordinator confirms it started successfully.

### New API endpoints

| Endpoint | What it does |
|---|---|
| `POST /api/v1/AgenticDesign/{proposalId}/approve` | Approve a converged design — runs codegen + pipeline wiring |
| `GET /api/v1/AgenticDesign/{proposalId}/dag-status` | Check the ETL pipeline run status |

### Database changes

- `WarehouseDesignProposals` table gets 3 new columns: `ApprovedDesignId` (FK to the warehouse design), `ApprovedAt` (timestamp), `DagDefinitionId` (FK to the pipeline recipe)
- New enum value: `AgenticProposalStatus.Approved = 4`
- Migration: `Sprint15_ApprovalAndDag`

### Commits on `newaurorabi`

1. `c8e5647a` — 23 files: 5 service interfaces, 5 service implementations, 2 DTOs, 2 controller endpoints, 3 entity fields, migration, 8 integration tests, report + manual update (6,455 lines added)

---

## Blueprint Sprint 16 — ETL Executor: Run the Pipeline (DONE)

Sprint 15 laid the tracks (approval pipeline + DAG definition). Sprint 16 runs the train — a background worker picks up DAG nodes one by one and executes them against real databases, deploying DDL to ClickHouse and loading Bronze + Silver data. This is the sprint that produces real data in the warehouse.

### 1. Background worker — EtlDagExecutorWorker

A hosted background service (registered in `Program.cs`) that:
- **Polls every 5 seconds** for Pending DAG nodes across all active (Running) runs whose upstream dependencies are all Success — calls `IDagCoordinator.GetReadyNodesAsync()` (added in this sprint).
- **Atomically claims** one node at a time via `IDagNodeClaimService.TryClaimAsync()` — prevents duplicate execution if two workers race.
- **Dispatches to the right executor** by node type via `IEtlNodeExecutorRegistry.Resolve()`.
- **Reports success/failure** back via `IDagCoordinator.MarkNodeAsync()` — the coordinator advances the run, marks downstream nodes Skipped if a failure occurs, and completes the run when all nodes finish.
- Mirrors the `AgenticDesignWorker` pattern: scope-per-job, cancellation-aware, never throws out of the poll loop.

### 2. Three node executors (Cloud + On-Premise routing)

Each executor auto-routes based on the `SourceDeploymentMode` from the source system — no caller decision needed:

| Node Type | Executor | Cloud Mode | On-Premise Mode |
|-----------|----------|------------|-----------------|
| **DdlDeploy** | `DdlDeployNodeExecutor` | `IClickHouseService.ExecuteDdlAsync()` per CREATE TABLE statement | Agent dispatcher → agent's local ClickHouse |
| **BronzeLoad** | `BronzeLoadNodeExecutor` | Agent queries source SQL Server → bulk-inserts rows into `bronze.{table}` via `IClickHouseService` | Agent dispatcher sends full `AgentEtlCommand` to the agent's local ETL handler |
| **SilverTransform** | `SilverTransformNodeExecutor` | `IClickHouseService.ExecuteDdlAsync()` for `INSERT…SELECT` from bronze → silver | Agent dispatcher sends the transform SQL to the agent's local ClickHouse |

**BronzeLoad tracking:** A `BronzeLoadRun` row is created for every bronze load with status (Running → Success/Failed), row count, and error details. This provides per-table auditability.

**What each executor deserialises and validates:**

- **DdlDeploy** — reads `DdlNodeConfig` from node `ConfigJson`: a list of `(tableName, sql)` pairs. If config is missing or malformed, returns 422.
- **BronzeLoad** — reads `BronzeLoadNodeConfig`: `TargetTable`, `BronzeSelectSql` (source query), `BronzeTable` (target bronze table name). Cloud mode supports up to 100k rows per node; On-Premise delegates to the agent's `EtlExecutionHandler`.
- **SilverTransform** — reads `SilverTransformNodeConfig`: `TargetTable`, `SilverInsertSql` (the INSERT…SELECT). Ships the SQL as a single ClickHouse DDL/DML statement.

All three deserialise with case-insensitive `JsonSerializerOptions` because the DAG factory writes camelCase JSON via anonymous-object serialisation.

### 3. Atomic claim service — DagNodeClaimService

Prevents duplicate execution with a single conditional UPDATE:

```sql
UPDATE EtlDagNodeRuns SET Status = 1, StartedAt = @now, ...
WHERE Id = @nodeRunId AND Status = 0  -- 0 = Pending
```

Returns `true` only if exactly 1 row was affected. For the EF Core InMemory provider (used in tests), falls back to a scoped `SaveChanges` guard that achieves the same atomicity within a single `DbContext` scope.

### 4. Strongly typed node configs — DagNodeConfigs

Three immutable records defined in `DagNodeConfigs.cs` that model the `ConfigJson` column on `EtlDagNode`:

- **`DdlNodeConfig(Guid ProposalId, List<DdlStatementConfig> Statements)`** — the full DDL batch
- **`BronzeLoadNodeConfig(string TargetTable, string BronzeSelectSql, string BronzeTable)`** — source extract + target
- **`SilverTransformNodeConfig(string TargetTable, string SilverInsertSql)`** — the INSERT…SELECT

Executors deserialise into these instead of parsing raw JSON, and `ConfigJson` is always optional (falls back to `"{}"` if null/empty).

### 5. Executor registry — EtlNodeExecutorRegistry

Resolves `IEtlNodeExecutor` by `NodeType` string via a `Dictionary<string, IEtlNodeExecutor>`. DI injects all three executors as `IEnumerable<IEtlNodeExecutor>` and the registry indexes them by their `NodeType` property. Returns null for unrecognised types — the worker catches this and marks the node as Failed.

### 6. Coordinator extension — GetReadyNodesAsync

Added to `IDagCoordinator` and implemented in `DagCoordinatorService`:
- Pulls all Running DAG runs with their node-runs
- Loads dependency maps from `EtlDagNode.DependsOnJson` for all relevant definitions in one query
- For each Pending node-run, checks that every dependency has reached `DagNodeStatus.Success`
- Returns the frontier of ready-to-execute nodes

### 7. Source system resolution at runtime

The worker resolves each DAG run's `SourceSystem` (and tenant ID) from the `EtlDagDefinition.SourceSystemId` denormalised during DAG creation in Sprint 15. If that's null, it falls back to looking up the `WarehouseDesignProposal` row whose `DagDefinitionId` matches. This enables Cloud vs On-Premise routing without re-traversing the proposal graph at execution time.

### Database changes

**No new migration.** Sprint 16 is pure execution logic — all database tables it needs (`EtlDagRuns`, `EtlDagNodes`, `EtlDagNodeRuns`, `BronzeLoadRuns`, `SourceSystems`) were created in Sprint 6 and Sprint 15.

### DI registrations added

```csharp
// Sprint 16 — ETL DAG executor (node executors + registry + atomic claim)
services.AddScoped<IEtlNodeExecutor, DdlDeployNodeExecutor>();
services.AddScoped<IEtlNodeExecutor, BronzeLoadNodeExecutor>();
services.AddScoped<IEtlNodeExecutor, SilverTransformNodeExecutor>();
services.AddScoped<IEtlNodeExecutorRegistry, EtlNodeExecutorRegistry>();
services.AddScoped<IDagNodeClaimService, DagNodeClaimService>();
```

Worker in `Program.cs`:
```csharp
builder.Services.AddHostedService<EtlDagExecutorWorker>();
```

### Tests + build

- **8 new integration tests** (`EtlDagExecutorTests`): GetReadyNodes returns root node first; frontier advances after parent Success; atomic claim service blocks double-execution (first wins, second loses); DDL executor Cloud path calls `IClickHouseService`; DDL executor On-Premise path routes through agent dispatcher; Bronze executor creates `BronzeLoadRun` and bulk-inserts rows; Silver executor executes valid INSERT…SELECT; DDL failure returns failure result. All 8 pass.
- Full solution builds clean — **0 errors** (plus 1 pre-existing test compilation fix for `QueryCacheEvictionTests` that was missing an `IEmbeddingService` mock after a prior constructor signature change).
- Combined with Sprint 15's 8 tests: **16 total integration tests** for the end-to-end approval → execution pipeline.

### End-to-end flow

```
1. User approves converged design  (POST /approve)
2. DDL + SQL emitted, DAG created  (Sprint 15)
3. DAG run started, worker wakes   (Sprint 16)
4. ddl_deploy: CREATE TABLEs       (DdlDeployNodeExecutor → ClickHouse/agent)
5. bronze_load:{t}: extract rows   (BronzeLoadNodeExecutor → source DB → bronze.{t})
6. silver_transform:{t}: INSERT    (SilverTransformNodeExecutor → bronze → silver)
7. DAG run completes, status = Success
8. Dashboards can now render real data ⬛ POC PAYOFF
```

### Commit on `newaurorabi`

All Sprint 16 code was committed alongside Sprint 15 in `c8e5647a` — the approval/codegen (Sprint 15) + executor/worker (Sprint 16) are two halves of the same end-to-end feature (Phase 4 minimal).

---

## What's Next

**Pending migrations (apply before going live):**
Seven migrations are now pending: `Sprint6_Phase0Foundation`, `Sprint9_OnboardingWizard`, `Sprint11_KnowledgeRouter`, `Sprint12_SchemaHarvester`, `Sprint13_AgenticDesign`, `Sprint14_AgenticDesignTierSlice`, `Sprint15_ApprovalAndDag`. Delete the duplicate `Sprint10_KnowledgeRouter_Phase1B` file first. *(Requires VPN access to Azure SQL at `10.2.0.4`.)*

**Sprint 17 — Schema Studio (frontend):**
A React Flow diagram viewer where customers can see the AI-designed warehouse schema, compare versions, and approve or reject the design.

**Frontend catch-up (Sprints 10, 12, 13, 14, 15):**
Five backend sprints have no frontend yet. Implementation prompts are written and saved under `plans/` in the frontend project:
- `sprint10-platform-identifier.md` — page to trigger platform detection and show the result
- `sprint12-schema-harvester.md` — page to trigger schema harvesting and browse the table/column breakdown
- `sprint13-agentic-design.md` — page to start the AI design loop and watch iteration progress live
- `sprint14-agentic-design-full.md` — add tier badge, slice label, and circuit breaker status to the iteration view
- `sprint15-approve-and-dag.md` — approve button + DAG status panel showing node-by-node pipeline progress

**CI/CD:** GitHub Actions workflows still need to be written.
