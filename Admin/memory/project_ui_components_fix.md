---
name: project-ui-components-fix
description: Missing src/components/ui/ shadcn components were created to fix broken imports across 19 files
metadata:
  type: project
---

Created `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, and `src/components/ui/dialog.tsx` — these were entirely absent, causing build failures across 19 files.

**Why:** The project was scaffolded with feature code already importing from `@/components/ui/` (shadcn/ui pattern) but the actual component files were never created.

**How to apply:** If adding new shadcn/ui-style components, place them in `src/components/ui/`. Never import Radix UI primitives directly in features — always wrap them here first.
