# Git Workflow — stylemint-creator-fe

---

## Branch Naming

```
feature/<ticket-id>-short-description    # new functionality
fix/<ticket-id>-short-description        # bug fix
chore/<description>                      # deps, config, tooling, no logic change
refactor/<description>                   # restructuring with no behavior change
```

Examples:
```
feature/SM-412-boost-countdown-component
fix/SM-391-activity-cursor-off-by-one
chore/upgrade-tanstack-query-v5
refactor/extract-analytics-formatters
```

---

## Commit Messages — Conventional Commits

Format: `<type>(<scope>): <subject>`

```
feat(reel-studio): add ExplanationTooltip to hook score badge
fix(boost-offer): stop polling after offer accepted
perf(activity): virtualize timeline with TanStack Virtual
test(analyze): cover soft 429 message scenario
chore(deps): upgrade date-fns to 3.6.0
refactor(formatters): extract formatMs from BoostCountdown
docs(readme): add codegen instructions
```

Types: `feat` · `fix` · `perf` · `test` · `chore` · `refactor` · `docs` · `ci`

Scopes match feature folder names: `reel-studio` · `story-arcs` · `post-publish` · `recipes` · `boost-offer` · `activity` · `analytics` · `auth` · `api`

Rules:
- Subject line: imperative mood, ≤ 72 characters, no period
- Body: explain **why**, not what (the diff shows what)
- Breaking changes: add `BREAKING CHANGE:` in the footer

---

## PR Size Guidelines

| Lines changed | Classification |
|---|---|
| < 200 | Small — fast to review |
| 200–500 | Medium — acceptable |
| 500–1000 | Large — split if possible |
| > 1000 | Too large — split required |

When scaffolding a new feature, open a skeleton PR first (routing, empty components, types) then stack feature PRs on top. Reviewers can approve incrementally.

---

## PR Checklist (author completes before requesting review)

**Functionality**
- [ ] Feature works end-to-end in a dev environment
- [ ] Loading, error, and empty states are implemented
- [ ] `briefingLoading`, `errorCode`, and hard invariants respected

**Code Quality**
- [ ] No `any` types without a `// eslint-disable` comment and justification
- [ ] No hardcoded hex colors — CSS variables only
- [ ] No raw `Date.now()` in countdown logic
- [ ] No `setInterval` for polling — TQ `refetchInterval` used
- [ ] `dangerouslySetInnerHTML` not used
- [ ] External links have `rel="noopener noreferrer"`

**Tests**
- [ ] Unit tests added for new utilities and hooks
- [ ] Edge cases covered (empty data, error states, 409 duplicate)
- [ ] No snapshot tests

**Performance**
- [ ] New routes are lazy-loaded
- [ ] Lists > 50 items use TanStack Virtual
- [ ] No unnecessary `React.memo` / `useMemo` / `useCallback` added without profiling

**Accessibility**
- [ ] All interactive elements are `<button>` or `<a>`
- [ ] Form inputs have visible labels
- [ ] Errors are announced via `role="alert"`
- [ ] Tab-key navigation tested manually

**Security**
- [ ] No `dangerouslySetInnerHTML`
- [ ] External URLs validated before use
- [ ] No new environment variables reading `import.meta.env` directly

---

## Review Standards

**Reviewer responsibilities:**
- Complete review within 1 business day for PRs < 400 lines
- Leave blocking comments only for correctness bugs, hard invariant violations, or security issues
- Leave non-blocking (nit) comments prefixed with `nit:` — author may address or explain why not

**Approval:**
- 1 approval required for `fix/` and `chore/` branches
- 2 approvals required for `feature/` branches touching auth, API interceptors, or router config

---

## Rebase, Don't Merge

Keep history linear. Rebase feature branches onto `main` before merging:

```bash
git fetch origin
git rebase origin/main
# resolve conflicts, then:
git push --force-with-lease
```

Use `--force-with-lease`, never `--force` — it prevents overwriting someone else's push.

---

## Post-Merge

After merging to `main`:
1. Delete the feature branch
2. If the PR bumped `briefingVersion` or `reportVersion` in API contracts: re-run `npm run codegen` and commit `schema.ts` to `main`
