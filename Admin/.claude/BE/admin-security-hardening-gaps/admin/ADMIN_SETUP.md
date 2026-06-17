# Setup — Style Mint Admin Frontend

One-time bootstrap for a new `stylemint-admin-frontend` repo.

## 1. Create the project

```powershell
# Run from a directory NEXT TO stylemint-backend (not inside it)
npm create vite@latest stylemint-admin-frontend -- --template react-ts
cd stylemint-admin-frontend
```

## 2. Install dependencies

```powershell
# Core
npm i react-router-dom@^6 axios zustand @tanstack/react-query @tanstack/react-table

# Forms / validation
npm i react-hook-form zod @hookform/resolvers

# UI primitives (shadcn/ui base — install Radix bits as you adopt components)
npm i @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-toast `
       @radix-ui/react-tabs @radix-ui/react-select @radix-ui/react-popover `
       @radix-ui/react-tooltip @radix-ui/react-switch @radix-ui/react-checkbox `
       @radix-ui/react-label @radix-ui/react-slot
npm i class-variance-authority clsx tailwind-merge
npm i lucide-react sonner qrcode.react

# Date / time
npm i date-fns date-fns-tz

# SignalR (optional, only if you wire the notifications hub)
npm i @microsoft/signalr

# Dev
npm i -D tailwindcss@^3 postcss autoprefixer
npm i -D openapi-typescript
npm i -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm i -D @playwright/test
npm i -D eslint-plugin-react-hooks eslint-plugin-react-refresh
```

## 3. Tailwind

```powershell
npx tailwindcss init -p
```

`tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Pull from stylemint-backend/docs/DESKTOP_CSS_TOKENS.md
        // when the design team hands tokens over.
      },
    },
  },
  plugins: [],
} satisfies Config;
```

`src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Import `index.css` in `src/main.tsx`.

## 4. shadcn/ui

```powershell
npx shadcn@latest init
```

Choose: TypeScript, Default style, Slate base color, `src/index.css`,
`src/components/ui`, alias `@/components`, RSC=No.

Then add components on demand:

```powershell
npx shadcn@latest add button input label dialog table toast tabs `
                       dropdown-menu select switch checkbox tooltip badge `
                       skeleton card form alert
```

## 5. Environment

`.env.example` (commit this) and `.env.local` (gitignore — copy and fill in):

```env
VITE_API_BASE_URL=http://localhost:5020
VITE_SSO_AUTHORITY=https://<your-idp>/.well-known/openid-configuration
VITE_SSO_CLIENT_ID=<idp-client-id>
VITE_SSO_REDIRECT_URI=http://localhost:5173/sso/callback
```

`src/env.ts`:

```ts
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL as string,
  ssoAuthority: import.meta.env.VITE_SSO_AUTHORITY as string,
  ssoClientId: import.meta.env.VITE_SSO_CLIENT_ID as string,
  ssoRedirectUri: import.meta.env.VITE_SSO_REDIRECT_URI as string,
};

for (const [k, v] of Object.entries(env)) {
  if (!v) throw new Error(`Missing env: ${k}`);
}
```

## 6. OpenAPI codegen

The backend exposes Swagger at
`http://localhost:5020/swagger/v1/swagger.json` (verify by hitting
that URL in a browser once the backend is running — if the JSON
doesn't load, the backend's `AddSwaggerGen` config may need an
explicit `SwaggerDoc("v1", new OpenApiInfo { ... })` call; flag to
the backend dev).

`package.json` script:

```json
{
  "scripts": {
    "codegen": "openapi-typescript http://localhost:5020/swagger/v1/swagger.json -o src/api/schema.ts"
  }
}
```

Run:

```powershell
npm run codegen
```

This produces `src/api/schema.ts` — every DTO, ViewModel, and
endpoint shape as TypeScript types. Use them via:

```ts
import type { paths, components } from "./schema";

type AdminAccountDto = components["schemas"]["AdminAccountDto"];
type KycReviewItemDto = components["schemas"]["KycReviewItemDto"];
// etc.
```

Re-run `npm run codegen` whenever the backend changes.

## 7. Vite config

`vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/v1": "http://localhost:5020",
      "/hubs": { target: "http://localhost:5020", ws: true },
    },
  },
});
```

Backend CORS already accepts `http://localhost:5173` per the Core.Api
defaults; if not, ask the backend dev to add it. The proxy lets you
hit the API without dealing with CORS directly during dev.

## 8. React Query provider

`src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err: any) => {
        const status = err?.response?.status;
        if (status === 401 || status === 403 || status === 404) return false;
        return count < 2;
      },
      staleTime: 30_000,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  </StrictMode>,
);
```

## 9. Router skeleton

`src/router.tsx`:

```tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { SsoCallback } from "@/auth/SsoCallback";
import { RequireAuth, RequireRole } from "@/auth/guards";
import { KycQueuePage } from "@/features/kyc-review/KycQueuePage";
// ... other imports

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/sso/callback", element: <SsoCallback /> },
  {
    element: <RequireAuth><AppShell /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="/kyc" replace /> },
      { path: "/kyc", element: <RequireRole roles={["KycReviewer","SuperAdmin","Readonly"]}><KycQueuePage /></RequireRole> },
      { path: "/kyc/:id", element: <KycDetailPage /> },
      { path: "/moderation", element: <ModerationQueuePage /> },
      { path: "/moderation/:id", element: <ModerationDetailPage /> },
      { path: "/audit", element: <AuditLogPage /> },
      { path: "/feature-flags", element: <FeatureFlagsPage /> },
      { path: "/feature-flags/:key", element: <FeatureFlagDetail /> },
      { path: "/platform-config", element: <PlatformConfigPage /> },
      { path: "/payouts", element: <PayoutOverridesPage /> },
      { path: "/refunds", element: <IssueRefundPage /> },
      { path: "/admins", element: <RequireRole roles={["SuperAdmin"]}><AdminAccountsPage /></RequireRole> },
      { path: "/admins/:id", element: <AdminDetailPage /> },
      { path: "/me/sessions", element: <MySessionsPage /> },
      { path: "/settings/mfa", element: <MfaSetupPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
```

## 10. Scripts

`package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "codegen": "openapi-typescript http://localhost:5020/swagger/v1/swagger.json -o src/api/schema.ts",
    "lint": "eslint . --max-warnings 0",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

## 11. Smoke test the wiring

1. Start the backend: `dotnet run --project stylemint-backend/src/StyleMint.Core.Api`
2. Verify Swagger: open `http://localhost:5020/swagger` (UI) and
   `http://localhost:5020/swagger/v1/swagger.json` (raw spec — must
   return JSON, not HTML, for codegen to work)
3. Generate types: `npm run codegen`
4. Start the frontend: `npm run dev`
5. Open `http://localhost:5173/login`
6. Click "Sign in with corporate SSO" → IdP page → redirected back
7. Should land on `/kyc` (or wherever the index redirect points)
8. Check `Application > Local Storage` in DevTools — token should NOT be there. It lives in memory.
9. Hit the KYC queue endpoint via the browser network tab — should see `Authorization: Bearer adm_...` header.

## 12. CI

Minimal `.github/workflows/ci.yml`:

```yaml
name: ci
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
```

Skip codegen in CI — commit `src/api/schema.ts` alongside the
backend's swagger.json hash so the frontend always builds from a
known-good schema. Regenerate locally and commit when the backend
changes.

## 13. Deploy targets

The admin SPA is a static bundle (`dist/`) with one rewrite rule:
all non-asset paths fall back to `index.html`. Any static host works
(Vercel, Cloudflare Pages, Azure Static Web Apps, S3 + CloudFront).

**Backend access**: the SPA needs to call `https://api.stylemint.app/v1/admin/*`
from `https://admin.stylemint.app`. Backend CORS allowlist must
include the admin origin — coordinate with backend dev when adding
prod.

**CSP** (set at the host layer): a sensible baseline —

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  connect-src 'self' https://api.stylemint.app https://<idp-domain>;
  frame-ancestors 'none';
```

`'unsafe-inline'` on styles is for Tailwind's runtime style
injection — acceptable for an internal admin tool. Tighten with a
nonce if your hosting layer supports it.
