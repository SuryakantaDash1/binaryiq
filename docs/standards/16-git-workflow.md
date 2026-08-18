# 16 — Git Workflow ⭐

How the **Influencer Platform** team uses Git, GitHub, and CI/CD. This is the source of truth for
**branching, commits, pull requests, review, merge, releases, and monorepo hygiene**. It complements
but does not repeat the coding conventions in
[15-coding-standards.md](15-coding-standards.md) or the pipeline/deploy mechanics in
[../architecture/09-devops-cicd.md](../architecture/09-devops-cicd.md); where those exist they are
authoritative for their own concerns and are referenced, not duplicated.

> Context you should already have: monorepo layout and deployables in
> [../architecture/01-system-architecture.md §3](../architecture/01-system-architecture.md),
> the build order in [../phases/00-roadmap.md](../phases/00-roadmap.md), and the environment chain
> `local → staging → production` in
> [../phases/00-roadmap.md §Environments](../phases/00-roadmap.md).

**TL;DR**

- **Trunk-based** with short-lived branches. `main` is always releasable.
- Branch names: `feature/*`, `fix/*`, `chore/*` (+ `hotfix/*`, `docs/*`, `refactor/*`).
- **Conventional Commits**, scoped by package/module (`feat(polls): ...`).
- Every change ships via a **PR** → preview deploy → review → **squash merge**.
- `main` is protected: no direct pushes, required checks green, required reviewers, CODEOWNERS.
- One **backward-compatible** DB migration per PR.
- Releases are **SemVer tags** on `main`; hotfixes branch from the release tag.

---

## 1. Branching model

We use **trunk-based development** with short-lived feature branches (a GitHub-Flow variant). There is
**one long-lived branch**, `main`, which is always in a releasable state. There is **no** long-lived
`develop` branch — environments are driven by branch state and tags, not by a parallel integration
branch (see §2).

### 1.1 Long-lived branch

| Branch | Meaning | Deploys to |
|---|---|---|
| `main` | Trunk. Always green, always releasable. Protected. | **staging** on every merge; **production** on a release tag (§2, §7) |

### 1.2 Short-lived branches

Branch off the latest `main`, keep it small, keep it short (target **< 2 days**, ideally hours), and
delete it after merge.

| Prefix | Use | Example |
|---|---|---|
| `feature/*` | New user-facing capability or module work | `feature/polls-live-results` |
| `fix/*` | Bug fix (non-urgent) | `fix/points-balance-drift` |
| `chore/*` | Tooling, deps, config, CI, non-behavioral | `chore/bump-prisma-5.19` |
| `refactor/*` | Behavior-preserving restructuring | `refactor/points-service-tx` |
| `docs/*` | Docs-only change | `docs/git-workflow` |
| `hotfix/*` | Urgent production fix (branches from a release tag) | `hotfix/1.4.1-login-500` |

**Naming rules**

- `type/short-kebab-summary`, optionally prefixed with the issue key: `feature/PLAT-214-poll-results`.
- Lowercase, hyphen-separated, no spaces, no author names.
- The prefix should match the primary Conventional-Commit type of the work (§3).

### 1.3 Keeping branches current

- **Rebase** your branch on `main` to stay current (`git pull --rebase origin main`); do **not** merge
  `main` into your branch (keeps history linear; final squash merge makes the branch's internal history
  disposable anyway — §6).
- Never rebase/force-push a branch someone else is actively working on; coordinate first.
- Long-running work → land behind a **feature flag** in small PRs rather than a long-lived branch. This
  keeps trunk-based integration continuous and avoids big-bang merges.

---

## 2. Branch → environment / deploy mapping

Deploys are driven by GitHub events; the pipeline itself is defined in
[../architecture/09-devops-cicd.md](../architecture/09-devops-cicd.md). This table is the **contract**
between Git state and environments (`local → staging → production`, per
[../phases/00-roadmap.md §Environments](../phases/00-roadmap.md)). The two deployables — `apps/web`
(Vercel) and `apps/api` (Railway) — deploy independently but from the same Git event.

| Git event | Environment | Web (`apps/web`, Vercel) | API (`apps/api`, Railway) | DB migrations |
|---|---|---|---|---|
| **Open/update a PR** | **Preview** (ephemeral, per-PR) | Vercel Preview deployment (unique URL) | Railway PR/preview service | Applied to an **isolated preview/shadow DB**, never staging/prod |
| **Merge to `main`** | **Staging** | Vercel production build of the *staging project* | Railway `staging` service | `prisma migrate deploy` against **staging** DB |
| **Publish a release tag** `vX.Y.Z` | **Production** | Vercel production (prod project) | Railway `production` service | `prisma migrate deploy` against **production** DB (gated, §8) |

Notes:

- **PR = preview deploy.** Every PR gets an isolated web + API preview so reviewers and QA can click
  through the change before it reaches staging. Preview databases are disposable and seeded, never
  pointed at real user data.
- **Merge to `main` = staging.** Because trunk is always releasable, staging always reflects the tip of
  `main`. Smoke tests run post-deploy (Definition of Done item 8 in
  [../phases/00-roadmap.md §Definition of Done](../phases/00-roadmap.md)).
- **Tag = production.** Production is only ever deployed from an annotated SemVer tag on `main` — never
  from a branch, never manually from a laptop. This gives an auditable, revertible release unit (§7).
- Migrations are **promoted with the app** (roadmap §Environments): the same migration files flow
  `preview → staging → production`; they are applied in-order by `prisma migrate deploy`, never `db push`
  outside local.

---

## 3. Conventional Commits

All commits follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/). This is
enforced by commitlint (`commit-msg` hook) and re-checked in CI. Conventional Commits drive the
**changelog** and **SemVer version bump** (§7).

### 3.1 Format

```
<type>(<scope>): <summary>

[optional body — the "why", wrapped at ~72 cols]

[optional footer(s) — BREAKING CHANGE:, Refs:, Closes #123]
```

- **summary**: imperative mood, lowercase, no trailing period, ≤ 72 chars
  (`add live poll results`, not `Added live poll results.`).

### 3.2 Types

| Type | When | SemVer effect |
|---|---|---|
| `feat` | New feature / capability | **minor** |
| `fix` | Bug fix | **patch** |
| `perf` | Performance improvement (no behavior change) | patch |
| `refactor` | Behavior-preserving code change | none |
| `docs` | Documentation only | none |
| `test` | Adding/adjusting tests only | none |
| `chore` | Tooling, deps, meta (no src behavior) | none |
| `ci` | CI/CD pipeline changes | none |
| `build` | Build system / bundler / packaging | none |
| `revert` | Reverts a previous commit | matches reverted |

A **breaking change** is flagged either with a `!` after the type/scope (`feat(api)!: ...`) or a
`BREAKING CHANGE:` footer → triggers a **major** bump.

### 3.3 Scope = package or module

Scope names the affected package or feature module so history is greppable and the changelog groups
cleanly. Use one of:

- **Packages** (from [../architecture/01-system-architecture.md §3](../architecture/01-system-architecture.md)):
  `web`, `api`, `ui`, `types`, `config`, `db`.
- **Feature modules** (from [../phases/00-roadmap.md](../phases/00-roadmap.md)):
  `auth`, `account`, `profile`, `points`, `rewards`, `surveys`, `polls`, `games`, `notifications`,
  `support`, `chatbot`, `admin`.
- **Cross-cutting**: `deps`, `release`, `ci`, `repo` (monorepo-root/tooling).

Prefer the **most specific** scope. For a genuinely cross-package atomic change (§10), scope by the
*primary* module and describe the rest in the body, or use a broad scope like `repo`.

### 3.4 Examples

```text
feat(polls): award +15 points on first vote via PointsService
fix(points): prevent double-credit by enforcing idempotencyKey on retry
feat(db): add poll_votes unique(pollId, userId) constraint
refactor(api): move ownership check from controller into PollsService
perf(surveys): index surveys(is_active, type) for listing hot path
docs(git-workflow): document squash-merge and release tagging
chore(deps): bump prisma to 5.19.0
feat(api)!: return cursor pagination for /points/transactions

BREAKING CHANGE: transactions list no longer returns offset `page`;
clients must use meta.pagination.nextCursor.
Closes #214
```

### 3.5 How commits drive changelog & versioning

- On release (§7), tooling (e.g. `changesets` or `semantic-release` — final choice in
  [../architecture/09-devops-cicd.md](../architecture/09-devops-cicd.md)) reads the Conventional Commits
  since the last tag, computes the SemVer bump (major/minor/patch per §3.2), and generates
  `CHANGELOG.md` grouped by type and scope.
- Because we **squash merge** (§6), the **PR title must itself be a valid Conventional Commit** — it
  becomes the squashed commit subject and therefore the changelog line. CI lints the PR title.

---

## 4. Pull Request process

**No change reaches `main` except through a reviewed, green PR.** Direct pushes to `main` are blocked
by branch protection (§9).

### 4.1 Rules

1. Branch from latest `main`; open a PR early (draft is fine) for visibility.
2. **Link an issue** — `Closes #NNN` / `Refs #NNN` in the description. Every PR maps to a tracked item.
3. **PR title = Conventional Commit** (drives the squash subject + changelog, §3.5).
4. All **required checks must pass** (§4.4). A red PR is not reviewable.
5. Keep it **small** (§4.3). Split large work.
6. Fill in the **PR template** (§4.5) — no empty sections.
7. Resolve every review thread before merge; author (not reviewer) hits merge (§6).

### 4.2 Size guidance

| Size | Net lines changed (excl. generated/lockfiles) | Expectation |
|---|---|---|
| 🟢 Small | < 200 | Ideal. Fast review. |
| 🟡 Medium | 200–400 | Acceptable; ensure a clear description. |
| 🔴 Large | > 400 | Discouraged. Justify in the template or split. |

Generated files (Prisma client, lockfiles, snapshots) don't count toward size but should be in their own
commits. Prefer a **stack of small PRs** over one large one.

### 4.3 Required checks (CI gates)

Every PR must pass the Turborepo pipeline (only **affected** packages run, §10) before it is mergeable:

- **Lint** — ESLint (`packages/config` ruleset).
- **Typecheck** — `tsc --noEmit` across affected packages (a breaking DTO change in `packages/types`
  fails **both** `web` and `api`, by design — see
  [../architecture/01-system-architecture.md §6](../architecture/01-system-architecture.md)).
- **Unit + integration tests** — meeting coverage targets in
  [../architecture/08-testing-strategy.md](../architecture/08-testing-strategy.md).
- **Build** — production build of affected apps/packages.
- **Prisma validate / migrate check** — schema valid; a migration accompanies any schema change (§8).
- **Commit + PR-title lint** — commitlint / Conventional Commits.
- **Preview deploy** — web + API previews come up healthy.

### 4.4 PR template

Committed at `.github/pull_request_template.md`. Ready to use:

```markdown
## What
<!-- One or two sentences: what does this PR change? -->

## Why
<!-- The motivation / problem. Link the issue. -->
Closes #

## How
<!-- Key implementation notes a reviewer needs. Call out anything non-obvious. -->

## Testing
<!-- How was this verified? Unit/integration/e2e added or updated? Manual steps? -->
- [ ] Unit / integration tests added or updated
- [ ] Verified on the preview deploy
- [ ] Coverage targets met (docs/architecture/08-testing-strategy.md)

## Screenshots / Recordings
<!-- Required for any UI change (before / after). N/A otherwise. -->

## Database
- [ ] No schema change, OR
- [ ] Exactly one migration, backward-compatible (see docs/standards/16-git-workflow.md §8)
- [ ] Migration reviewed (expand → contract, no destructive change to in-use columns)
- [ ] Seed updated if needed

## Points / ledger
- [ ] No point movement, OR all point movement goes through `PointsService`
      inside the same `$transaction` as the domain write (docs/architecture/04-database-architecture.md §5)

## Risk & rollout
<!-- Blast radius, feature flag, rollback plan. Breaking change? Note it here and in the commit footer. -->
- Risk level: Low / Medium / High
- Behind feature flag: yes / no
- Rollback: <how to revert safely>

## Checklist
- [ ] PR title is a valid Conventional Commit
- [ ] Linked issue
- [ ] Self-reviewed the diff
- [ ] Docs updated (module doc / relevant architecture doc)
- [ ] No secrets, keys, or PII in code, tests, or fixtures
```

---

## 5. Code review

Review is a **gate**, not a formality. The reviewer co-owns correctness. Approve only what you'd be
comfortable shipping to production yourself.

### 5.1 Reviewer checklist

**Correctness**
- [ ] Does what the PR/issue says; edge cases and error paths handled.
- [ ] Concurrency/idempotency correct where relevant (retries, double-submits).

**Tests**
- [ ] New/changed behavior has tests; meaningful assertions (not just coverage padding).
- [ ] Coverage targets in [../architecture/08-testing-strategy.md](../architecture/08-testing-strategy.md) met.

**Security & authorization**
- [ ] AuthZ + **ownership** enforced in the **service**, not the controller
      ([../architecture/05-api-conventions.md §7](../architecture/05-api-conventions.md)).
- [ ] All input validated at the boundary via Zod from `packages/types`
      ([../architecture/05-api-conventions.md §5](../architecture/05-api-conventions.md)).
- [ ] **No secrets/keys/PII** committed; PII columns encrypted per
      [../architecture/04-database-architecture.md §1](../architecture/04-database-architecture.md).
- [ ] Rate-limited / business-rule guarded for sensitive actions (vote, spin, redeem).

**API conventions**
- [ ] Endpoints follow the envelope, error codes, status codes, and pagination in
      [../architecture/05-api-conventions.md](../architecture/05-api-conventions.md). Controllers return
      plain DTOs (no hand-built envelope).

**UI**
- [ ] Uses **only** shared tokens/components from `packages/ui`
      ([../design-system/13-components-library.md](../design-system/13-components-library.md),
      [../design-system/11-color-system.md](../design-system/11-color-system.md)). No one-off colors,
      no duplicate modal/input/button — never forks the design system.

**Points / ledger** (highest-risk area — [../phases/00-roadmap.md §Risk notes](../phases/00-roadmap.md))
- [ ] Every point movement goes through **`PointsService`** and writes exactly one
      `points_transactions` row inside the **same `$transaction`** as the domain write
      ([../architecture/04-database-architecture.md §5](../architecture/04-database-architecture.md)).
- [ ] Idempotency key set for retriable credits; ledger rows never updated/deleted (corrections =
      `ADJUSTMENT`).

**Migrations**
- [ ] One migration, backward-compatible, reviewed per §8.

**Docs**
- [ ] Module doc / architecture doc updated if a decision or contract changed
      (Definition of Done item 7, [../phases/00-roadmap.md](../phases/00-roadmap.md)).

### 5.2 Reviewer responsibilities & SLA

- **First response SLA: within 1 business day** of review request (sooner for `hotfix/*` — see §7.3).
- Reviews are **blocking for `main`** (§9). At least **one** approving review from a CODEOWNER of every
  touched area is required; two for high-risk areas (`points`, `rewards`, `db`, security) — see §9.
- Use GitHub's **Approve / Request changes / Comment**. Distinguish **blocking** comments from
  **nits** (prefix non-blocking ones with `nit:`).
- The **author** addresses/threads-resolves feedback; the **reviewer** re-reviews promptly after a
  re-request. Stale PRs (> 5 business days idle) are pinged or closed.
- Reviewers verify the **preview deploy** for UI/behavioral changes, not just the diff.

---

## 6. Merge strategy

- **Squash and merge only.** "Rebase" and "merge commit" are disabled in repo settings. Each PR lands as
  **one commit** on `main` → linear, bisectable, one changelog line per change.
- The **squash commit subject = the PR title** (a valid Conventional Commit, §3.5). Clean up the squash
  body to a meaningful summary; drop "fix typo"/"address review" noise.
- **The author merges** once approvals + required checks are green (author owns the timing and any
  post-merge watch). Reviewers approve; they don't merge someone else's PR unless asked.
- **Delete the branch on merge** (auto-delete enabled).
- Merges to `main` must be **up to date** with `main` (branch protection "require branches to be up to
  date", §9) so CI ran against the final state.

---

## 7. Release & tagging

### 7.1 Versioning (SemVer)

Releases follow [Semantic Versioning](https://semver.org/) — `MAJOR.MINOR.PATCH` — derived from the
Conventional Commits since the last release (§3.5):

- **MAJOR** — a breaking change (`!` / `BREAKING CHANGE:`).
- **MINOR** — new `feat`.
- **PATCH** — `fix` / `perf`.

The product build order in [../phases/00-roadmap.md](../phases/00-roadmap.md) maps to minor/major
milestones (e.g. M1–M4); day-to-day fixes are patches.

### 7.2 Cutting a release

1. `main` is green and the desired changes are merged (staging already reflects them, §2).
2. Run the release tooling on `main` (CI job): it computes the next version, updates `CHANGELOG.md`, and
   creates an **annotated, signed tag** `vX.Y.Z`.
3. Publishing the tag triggers the **production** deploy of `apps/web` (Vercel) and `apps/api` (Railway),
   including gated `prisma migrate deploy` (§2, §8).
4. A **GitHub Release** is created from the tag with the generated notes; post-deploy smoke tests run.

Tags are the **only** production release unit — auditable and directly revertible (redeploy the previous
tag).

### 7.3 Hotfix flow

For an urgent production defect that can't wait for the normal train:

1. Branch `hotfix/<version>-<slug>` **from the release tag** currently in production (e.g. `v1.4.0`), not
   from the tip of `main` (which may contain unreleased work).
2. Make the minimal `fix:` change **+ a regression test**.
3. PR into `main` with **expedited review** (hotfix SLA: reviewers respond ASAP, same day). All required
   checks still run — hotfixes are **not** exempt from CI.
4. After merge, cut a **patch** release (`v1.4.1`) → production (§7.2).
5. Because the fix landed on `main`, no cherry-pick back-merge is needed; trunk carries it forward. If the
   hotfix was tagged before an intervening `main` merge, ensure the fix commit is present on `main`.

---

## 8. Database migrations in PRs

Migrations are the highest-blast-radius change type. Rules (aligned with
[../architecture/04-database-architecture.md §7](../architecture/04-database-architecture.md)):

1. **One migration per PR.** A PR that changes `schema.prisma` includes exactly one generated Prisma
   migration and the updated client. Bundling multiple schema changes hides risk and complicates
   rollback.
2. **Backward-compatible / expand-then-contract.** A migration must be safe to deploy **before** the code
   that depends on it (migrations promote with the app across `preview → staging → production`, §2):
   - **Additive first** — new nullable columns, new tables, new indexes. Add with a default or nullable,
     backfill, then make required in a *later* migration once all code paths write it.
   - **No destructive change to an in-use column/table** in the same release that still reads it. Drop
     columns only after code no longer references them (a subsequent "contract" PR).
   - Prefer `CREATE INDEX CONCURRENTLY` for large tables to avoid locks (note in the PR).
3. **Never edit an applied migration.** Applied migrations are immutable history; fix-forward with a new
   migration.
4. **Migration is reviewed as code.** The reviewer checks the generated SQL, not just the Prisma diff:
   locking behavior, data loss, backfill correctness, index cost, FK/cascade rules
   ([../architecture/04-database-architecture.md §4](../architecture/04-database-architecture.md)).
5. **Ledger tables are sacred.** `points_transactions` stays append-only; any change touching points
   tables requires a `points`/`db` CODEOWNER approval (§9) and must preserve the invariants in
   [../architecture/04-database-architecture.md §5](../architecture/04-database-architecture.md).
6. **Seed updated** when the change affects seeded reference data
   (`packages/db/prisma/seed.ts`).
7. Local uses `prisma migrate dev`; every deployed environment uses `prisma migrate deploy` (never
   `db push`). `DIRECT_URL` is used for migrations (bypasses PgBouncer), per
   [../architecture/01-system-architecture.md §7](../architecture/01-system-architecture.md).

---

## 9. Protecting `main`

`main` is a **protected branch**. Configure these rules in GitHub (Settings → Branches):

- ✅ **Require a pull request before merging** — no direct pushes.
- ✅ **Require approvals** — minimum **1** approving review; **dismiss stale approvals** on new commits.
- ✅ **Require review from Code Owners** — CODEOWNERS (below) must approve their areas.
- ✅ **Require status checks to pass** — lint, typecheck, test, build, prisma-check, commit/PR-title lint,
  preview deploy (§4.4).
- ✅ **Require branches to be up to date before merging.**
- ✅ **Require conversation resolution before merging.**
- ✅ **Require linear history** (enforces squash; no merge commits).
- ✅ **Require signed commits** (recommended).
- ✅ **Include administrators** — rules apply to everyone, including leads.
- ⛔ **Do not allow force pushes or deletions** of `main`.
- ✅ **Automatically delete head branches** after merge.

High-risk areas (`points`, `rewards`, `db`, security-sensitive code) require **2 approvals**, at least one
from the owning team — enforced via a CODEOWNERS rule + a branch-protection ruleset scoped to those paths.

### CODEOWNERS

Committed at `.github/CODEOWNERS`. Ownership is by **package and module**; last matching pattern wins, so
order specific rules **after** broad ones.

```gitignore
# .github/CODEOWNERS
# Default owners for everything not matched below.
*                                   @influencer-platform/leads

# ── Apps ────────────────────────────────────────────────
/apps/web/                          @influencer-platform/frontend
/apps/api/                          @influencer-platform/backend

# ── Shared packages ─────────────────────────────────────
/packages/ui/                       @influencer-platform/design-system
/packages/types/                    @influencer-platform/backend @influencer-platform/frontend
/packages/config/                   @influencer-platform/platform
/packages/db/                       @influencer-platform/backend @influencer-platform/data

# ── High-risk domains (require the owning team; 2 approvals) ──
/apps/api/src/modules/points/       @influencer-platform/payments
/apps/api/src/modules/rewards/      @influencer-platform/payments
/packages/db/prisma/                @influencer-platform/data @influencer-platform/backend
/apps/api/src/modules/auth/         @influencer-platform/security
/apps/api/src/common/               @influencer-platform/backend

# ── Feature modules ─────────────────────────────────────
/apps/api/src/modules/surveys/      @influencer-platform/backend
/apps/api/src/modules/polls/        @influencer-platform/backend
/apps/api/src/modules/games/        @influencer-platform/backend
/apps/api/src/modules/notifications/ @influencer-platform/backend @influencer-platform/platform
/apps/api/src/modules/admin/        @influencer-platform/backend @influencer-platform/security

# ── Docs, CI, and repo meta ─────────────────────────────
/docs/                              @influencer-platform/leads
/docs/architecture/04-database-architecture.md  @influencer-platform/data
/docs/architecture/05-api-conventions.md        @influencer-platform/backend
/.github/                           @influencer-platform/platform
/turbo.json                         @influencer-platform/platform
/pnpm-workspace.yaml                @influencer-platform/platform
```

> Replace `@influencer-platform/*` with the real GitHub team slugs. Every team referenced here must have
> **write** access to the repo, or CODEOWNERS review requirements won't be enforced.

---

## 10. Monorepo specifics (Turborepo)

The repo is a Turborepo monorepo — two apps, four packages
([../architecture/01-system-architecture.md §3](../architecture/01-system-architecture.md)). Git workflow
implications:

- **Atomic cross-package changes in one PR.** A change that spans packages ships as **one PR** so the repo
  is never left in a broken intermediate state. The canonical case: editing a Zod DTO in `packages/types`
  **and** its `apps/api` validation **and** its `apps/web` consumer in the same PR — because the shared
  type means a partial change fails compilation on both sides
  ([../architecture/01-system-architecture.md §6](../architecture/01-system-architecture.md)). Never split
  a contract change across PRs.
- **Turborepo affected builds.** CI runs only the tasks affected by the PR's diff, using Turborepo's
  dependency graph + remote cache (e.g. `turbo run lint typecheck test build --filter=...[origin/main]`).
  A change to `packages/db` re-runs everything that depends on it; a change isolated to `apps/web`
  doesn't rebuild `apps/api`. This keeps required checks (§4.4) fast without sacrificing correctness.
- **Migrations live with the schema.** DB changes are always in `packages/db` and follow §8; they
  auto-pull `apps/api` (which depends on the client) into the affected set.
- **Design system is never forked.** UI changes go into `packages/ui`, consumed by `apps/web`; a PR that
  hand-rolls a component instead of using/extending `packages/ui` fails review (§5,
  [../design-system/13-components-library.md](../design-system/13-components-library.md)).
- **Lockfile & generated artifacts** (pnpm lockfile, Prisma client) belong in their own commits within
  the PR and don't count toward size limits (§4.2).

---

## 11. Quick reference

```bash
# start work
git switch main && git pull --rebase origin main
git switch -c feature/PLAT-214-poll-results

# ... commit using Conventional Commits (commitlint enforces) ...
git commit -m "feat(polls): show live results after first vote"

# stay current
git pull --rebase origin main

# push & open PR (title = Conventional Commit; fill the template)
git push -u origin HEAD
gh pr create --fill

# after approvals + green checks: squash-merge via GitHub UI (author merges, branch auto-deletes)
```

---

## 12. Related docs

- [15-coding-standards.md](15-coding-standards.md) — TS/lint/naming conventions (commit *content* style).
- [../architecture/09-devops-cicd.md](../architecture/09-devops-cicd.md) — CI/CD pipeline, environments,
  deploy mechanics (the *how* behind §2 and §7).
- [../architecture/01-system-architecture.md](../architecture/01-system-architecture.md) — monorepo
  layout, deployables, shared-types flow.
- [../architecture/04-database-architecture.md](../architecture/04-database-architecture.md) — schema,
  migrations, **points ledger rules** (§8).
- [../architecture/05-api-conventions.md](../architecture/05-api-conventions.md) — envelope, errors,
  authZ/ownership (§5).
- [../architecture/08-testing-strategy.md](../architecture/08-testing-strategy.md) — coverage gates (§4.4).
- [../phases/00-roadmap.md](../phases/00-roadmap.md) — phases, environments, Definition of Done, risk notes.
