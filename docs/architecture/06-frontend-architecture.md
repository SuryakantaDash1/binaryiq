# 06 — Frontend Architecture ⭐

How the Next.js web app (`apps/web`) is structured, renders, fetches data, manages state, and reuses
the shared design system. This is the **frontend backbone**: module docs describe *which* screens exist
and their flows; the **App Router structure, rendering rules, data-fetching pattern, forms pattern, and
theming wiring live here** and are not repeated per module.

Stack (confirmed): **Next.js 14 App Router + TypeScript**, Tailwind via a shared preset
(`packages/config`), the UI kit in `packages/ui` (`@influencer/ui`), shared **Zod schemas + types** in
`packages/types` (`@influencer/types`), **React Hook Form + Zod**, **TanStack Query** for client
server-state, a **typed API client** hitting the NestJS API, and **NextAuth.js** for session handling.

Read alongside: [00-project-overview](../00-project-overview.md),
[05-api-conventions](./05-api-conventions.md), [11-color-system](../design-system/11-color-system.md),
[13-components-library](../design-system/13-components-library.md), and the build order in
[phases/00-roadmap](../phases/00-roadmap.md).

---

## 1. App Router folder structure

The app is organised with **route groups** — parenthesised folders that group routes by concern and let
each group own its own `layout.tsx` **without adding a URL segment**. Marketing is public and SEO-first,
`(auth)` is public-but-unauthenticated, `(app)` is the authenticated member shell, and `/admin` is the
role-gated back office.

```text
apps/web/
├─ app/
│  ├─ layout.tsx                 # root: <html>, <body>, providers (Query, Theme, Session), fonts, tokens.css
│  ├─ globals.css                # imports @influencer/ui tokens.css + Tailwind layers
│  ├─ not-found.tsx              # global 404
│  ├─ error.tsx                  # global error boundary (root)
│  │
│  ├─ (marketing)/               # PUBLIC, SEO-optimised, mostly static/SSR
│  │  ├─ layout.tsx              # marketing chrome: top nav + footer
│  │  ├─ page.tsx                # landing "/"
│  │  ├─ how-it-works/page.tsx
│  │  ├─ rewards/page.tsx        # public rewards teaser
│  │  └─ legal/[slug]/page.tsx   # privacy, terms (DPDP/GDPR)
│  │
│  ├─ (auth)/                    # PUBLIC, unauthenticated flows
│  │  ├─ layout.tsx              # centred card shell (no app nav)
│  │  ├─ login/page.tsx
│  │  ├─ register/page.tsx       # 2-step signup (module-01)
│  │  ├─ verify/page.tsx         # email verification (+500)
│  │  ├─ forgot-password/page.tsx
│  │  └─ reset-password/page.tsx
│  │
│  ├─ (app)/                     # AUTHENTICATED member area
│  │  ├─ layout.tsx              # <AppShell>: Header (PointsPill, bell, avatar) + SidebarNav/BottomNav
│  │  ├─ loading.tsx             # shell-level skeleton
│  │  ├─ error.tsx               # authed error boundary
│  │  ├─ dashboard/
│  │  │  ├─ page.tsx             # RSC: balance, module teasers, unvoted count
│  │  │  └─ loading.tsx          # StatCard/Card skeletons
│  │  ├─ surveys/
│  │  │  ├─ page.tsx             # listings (priority/quick/premium)
│  │  │  ├─ loading.tsx
│  │  │  └─ [id]/page.tsx        # survey detail / take
│  │  ├─ polls/
│  │  │  ├─ page.tsx
│  │  │  └─ [id]/page.tsx        # vote + live results (client-interactive)
│  │  ├─ games/
│  │  │  └─ page.tsx             # Spin-the-Wheel (client)
│  │  ├─ rewards/
│  │  │  ├─ page.tsx             # catalogue
│  │  │  ├─ [id]/page.tsx        # reward detail + redeem
│  │  │  └─ history/page.tsx     # redemption history (DataTable)
│  │  └─ account/
│  │     ├─ layout.tsx           # account Tabs shell
│  │     ├─ profile/page.tsx
│  │     ├─ email/page.tsx
│  │     ├─ password/page.tsx
│  │     ├─ paypal/page.tsx
│  │     └─ about-you/page.tsx   # first profile survey
│  │
│  ├─ admin/                     # ROLE-GATED back office (AdminGuard equivalent on client)
│  │  ├─ layout.tsx              # admin shell + Breadcrumbs
│  │  ├─ page.tsx                # admin dashboard
│  │  ├─ polls/…                 # CRUD (DataTable + Modal forms)
│  │  ├─ surveys/…
│  │  ├─ rewards/…
│  │  └─ support/…               # tickets (module-08)
│  │
│  ├─ (api or route handlers)/
│  │  └─ api/auth/[...nextauth]/route.ts   # NextAuth handler (see §8)
│  │
│  ├─ components/                # app-only feature components (compose @influencer/ui)
│  ├─ features/                  # feature modules (see §11)
│  ├─ lib/                       # api client, query client, auth helpers (see §11)
│  ├─ hooks/                     # useApi, usePoints, useSession wrappers (see §11)
│  └─ middleware.ts              # route protection + redirects (see §8)
```

### Special files (App Router conventions)

- **`layout.tsx`** — shared, persistent UI that wraps a segment and its children; **does not re-render on
  navigation** within its subtree. The **root layout** mounts global providers (TanStack Query, theme,
  NextAuth `SessionProvider`) and imports `tokens.css`. Each route group owns its chrome: `(marketing)`
  = nav+footer, `(auth)` = centred card, `(app)` = `<AppShell>`, `/admin` = admin shell + breadcrumbs.
- **`loading.tsx`** — an automatic React Suspense boundary for the segment. It renders instantly on
  navigation while the RSC streams. Always use shared **`Skeleton`** shapes that mirror the real layout
  (`StatCard`, `Card`, `DataTable` skeletons) — never a bare spinner for full pages.
- **`error.tsx`** — a **Client Component** error boundary (`"use client"`, receives `error` + `reset`).
  Renders a shared **`Alert`**/`EmptyState` with a retry action wired to `reset()`. Placed at the root
  and at `(app)` so an authed-page crash doesn't blow away the shell.
- **`not-found.tsx`** — rendered by `notFound()` or unmatched routes; uses the shared `EmptyState`.

```tsx
// app/(app)/error.tsx
'use client';
import { EmptyState, Button } from '@influencer/ui';

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      icon="alert-triangle"
      title="Something went wrong"
      description="We couldn't load this page. Please try again."
      action={<Button variant="primary" onClick={reset}>Retry</Button>}
    />
  );
}
```

---

## 2. Rendering strategy (Server vs Client Components)

Everything in `app/` is a **React Server Component (RSC) by default**. We only opt into a Client
Component (`"use client"`) when we need interactivity, browser APIs, or client-only libraries. Keep the
`"use client"` boundary **as deep in the tree as possible** so pages stay server-rendered and ship less
JS ("islands" of interactivity inside server-rendered pages).

| Concern | Choose | Why |
|---|---|---|
| Data **display** (dashboard, listings, reward detail, history tables' first page) | **Server** | Fetch on the server, no client JS for read-only content, faster TTFB, streamed via Suspense |
| **Interactive** UI — forms, poll vote, `SpinWheel`, `ChatWidget`, dropdowns, tabs with client state | **Client** | Needs event handlers, `useState`/effects, RHF, animation, Radix state |
| **Marketing** pages | **Server / static** | SSR + static generation for SEO, OpenGraph, fast first paint |
| Live/mutable numbers (points balance chip, poll live results) | **Client** (TanStack Query) | Needs revalidation/optimistic updates after mutations |

Rules of thumb:

- A page is an RSC that fetches initial data and renders shared display components. It embeds small
  **client islands** (`<VotePanel/>`, `<SpinWheel/>`) for the interactive parts.
- Never make a whole page a Client Component just to use one button handler — extract the interactive
  piece.
- Client Components **cannot** be `async` and cannot import server-only modules (the API client's
  server variant, secrets). Pass server-fetched data down as props, or refetch via TanStack Query.
- Marketing routes prefer static generation; use `generateMetadata` for SEO (title, description, OG).

```tsx
// app/(app)/polls/[id]/page.tsx  — Server Component
import { apiServer } from '@/lib/api/server';
import { PollHeader, VotePanel } from '@/features/polls/components';

export default async function PollPage({ params }: { params: { id: string } }) {
  const poll = await apiServer.polls.getById(params.id); // server fetch, no client JS
  return (
    <>
      <PollHeader poll={poll} />
      {/* interactive island: vote + optimistic live results */}
      <VotePanel pollId={poll.id} initialResults={poll.results} />
    </>
  );
}
```

---

## 3. Data fetching

Two complementary layers, chosen by *who owns the data lifecycle*:

### 3.1 Server-side fetch in RSC (initial data)

Read-only initial page data is fetched **on the server** in the RSC using the **server variant of the
typed API client**, which forwards the NextAuth session token and unwraps the response envelope. This
data streams to the browser with the HTML — no client round-trip, no loading flash for the first paint.

### 3.2 TanStack Query in Client Components (mutations + live data)

Anything that mutates or changes after load is owned by **TanStack Query** in a client island:

- **Mutations**: poll vote, spin the wheel, redeem reward, save profile, change email/password.
- **Live/derived reads**: points balance chip, poll live results, notification unread count.
- Query keys are namespaced per feature (`['points','balance']`, `['polls', id]`). Mutations
  **invalidate** the affected keys (a successful vote invalidates `['polls', id]` and
  `['points','balance']`) so the header points update everywhere. Use **optimistic updates** for
  vote/spin so the UI reacts instantly, rolling back on error.

Server-fetched RSC data can **hydrate** the client cache (pass `initialData` to `useQuery`), so the
client island starts from the server snapshot and takes over revalidation.

### 3.3 The typed API client wrapper (envelope-aware)

There is **one** API client (`app/lib/api/`). It wraps `fetch`, sets base URL + `Bearer` token +
`Content-Type`, and — critically — **reads the response envelope** defined in
[05-api-conventions §2](./05-api-conventions.md): on success it returns `data`; on error it throws a
typed `ApiError` built from the `error` object (`code`, `message`, `details[]`). Callers never see the
envelope; they get the resource or a typed error.

```ts
// app/lib/api/client.ts
import type { ApiEnvelope } from '@influencer/types';

export class ApiError extends Error {
  constructor(
    public code: string,        // e.g. VALIDATION_ERROR | CONFLICT | UNPROCESSABLE (see 05 §4)
    message: string,
    public details?: { field: string; issue: string }[],
    public status?: number,
  ) { super(message); }
}

export async function apiFetch<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...init.headers,
    },
  });

  const envelope = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || envelope.error) {
    const e = envelope.error!;
    throw new ApiError(e.code, e.message, e.details, res.status);
  }
  return envelope.data as T; // unwrapped
}
```

- **Server variant** (`api/server.ts`) pulls the token from the NextAuth session (server side) and never
  runs in the browser.
- **Client variant** is consumed only through TanStack Query hooks (`useApi`, §11); components never call
  `fetch` directly.
- **Types** for every request/response come from `@influencer/types`, so the client is end-to-end typed
  against the same DTOs the API validates ([05 §5](./05-api-conventions.md)).
- Pagination follows [05 §6](./05-api-conventions.md): cursor lists feed `useInfiniteQuery`, offset lists
  feed the `DataTable` server-pagination hook.

---

## 4. State management

Three clearly separated kinds of state. **No Redux.**

| Kind | Owner | Examples |
|---|---|---|
| **Server state** (async, remote, cached) | **TanStack Query** | balance, polls, surveys, rewards, redemption history, notifications |
| **Session state** | **NextAuth** (`useSession`) | authenticated user, roles, access token |
| **UI/global state** (small, synchronous) | local `useState` / a tiny **Zustand** store | theme (light/dark), sidebar/drawer open, active account tab, toast queue is `sonner` |

Rules:

- Remote data is **never** copied into a global store — TanStack Query *is* the cache. Duplicating it
  causes stale bugs (especially the points balance).
- Zustand is reserved for genuinely global **UI** concerns that many components read (theme, layout
  toggles). Keep stores tiny and colocated in `app/lib/stores/`.
- Component-local interaction state (form field focus, modal open for a single card) stays in `useState`.
- Derived values (INR from points: `points / 100`, see [05 §1](./05-api-conventions.md)) are computed in
  a selector/helper, never stored.

---

## 5. Forms (RHF + Zod, one schema everywhere)

Every form uses **React Hook Form + `zodResolver`** with the **same Zod schema imported from
`@influencer/types`** that the API validates against — so the frontend and backend cannot drift
([05 §5](./05-api-conventions.md)). Controls are the shared **`FormField` + `Input`/`Select`/…** from
`@influencer/ui` ([13 §3](../design-system/13-components-library.md)); no form re-implements validation,
layout, or a11y.

Error handling has two levels:

1. **Client-side** — Zod resolver populates field errors before submit.
2. **Server-side** — on an `ApiError` with `code: 'VALIDATION_ERROR'`, map `details[]` (`{ field, issue }`)
   back onto the form via `setError(field, …)`; other codes (`CONFLICT` email taken, `UNPROCESSABLE`
   insufficient points) surface as a form-level `Alert`/`Toast`.

```tsx
// app/features/account/EmailForm.tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChangeEmailSchema, type ChangeEmailInput } from '@influencer/types';
import { FormField, Input, Button, Alert } from '@influencer/ui';
import { toast } from 'sonner';
import { useChangeEmail } from '@/features/account/hooks';
import { ApiError } from '@/lib/api/client';

export function EmailForm({ current }: { current: string }) {
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } =
    useForm<ChangeEmailInput>({ resolver: zodResolver(ChangeEmailSchema), defaultValues: { email: current } });

  const changeEmail = useChangeEmail(); // TanStack Query mutation → typed API client

  const onSubmit = handleSubmit(async (values) => {
    try {
      await changeEmail.mutateAsync(values);
      toast.success('Verification sent to your new email');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        err.details?.forEach((d) => setError(d.field as keyof ChangeEmailInput, { message: d.issue }));
      } else if (err instanceof ApiError && err.code === 'CONFLICT') {
        setError('email', { message: 'That email is already in use' });
      } else {
        toast.error('Could not update email. Please try again.');
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      {changeEmail.isError && <Alert variant="danger">Update failed.</Alert>}
      <FormField label="New email" required error={errors.email?.message}>
        <Input type="email" autoComplete="email" {...register('email')} />
      </FormField>
      <Button type="submit" variant="primary" loading={isSubmitting}>Update email</Button>
    </form>
  );
}
```

The same pattern covers registration, login, password reset, profile-survey categories, PayPal details,
and every admin CRUD form — only the schema and the mutation hook change.

---

## 6. Component reuse strategy

Feature code **consumes `@influencer/ui` only**. It **never** ships one-off buttons, inputs, modals,
tables, or hard-coded colors — those are single-implementation in the UI kit
([13-components-library](../design-system/13-components-library.md)).

- **Feature components compose primitives.** `SurveyCard`, `PollCard` + `PollResultBars`, `RewardCard`,
  `StatCard` groupings, etc. are built by composing `Card`, `Badge`, `Button`, `ProgressBar`, `Text`.
- **Every dialog** is a configuration of `Modal`/`ConfirmModal` (redeem confirm, "already voted", spin
  result, email-change confirm) — no second modal system.
- **Every form control** is the shared `FormField` + input set (§5). Every list/table is `DataTable`.
- If a feature needs something new and reusable, it's **added to `packages/ui` first** (with a Storybook
  story + a11y pass), then consumed — per [13 §10](../design-system/13-components-library.md).
- App-only feature components that are *not* generic enough for the kit live in
  `app/components/` or `app/features/<area>/components/` but still compose kit primitives.

Import boundary: feature code imports from `@influencer/ui`; **nothing** in `apps/web` imports Radix or
raw Tailwind color classes directly (only the UI package internals do).

---

## 7. Theming & tokens

Theming is a **config change, not a code change** — see
[11-color-system](../design-system/11-color-system.md).

- **Tokens** (primitives → semantic → component) are defined in `packages/ui/src/styles/tokens.css` and
  imported **once** in `app/globals.css`. Components use **semantic tokens** (`bg-primary`,
  `text-muted`, `border-default`, `ring-focus`) only — never raw hex.
- **Tailwind preset** (`packages/config/tailwind-preset.ts`) maps those CSS variables to utilities and is
  shared by `apps/web` and Storybook, so app and component library render identically. `apps/web`'s
  `tailwind.config.ts` just `presets: [preset]` and points `content` at `app/**` + `@influencer/ui`.
- **Dark mode** flips semantic tokens via **`data-theme="dark"`** on `<html>`. A small client
  `ThemeProvider` (in the root layout) reads the user preference + `localStorage`, sets the attribute,
  and avoids the flash-of-wrong-theme with an inline pre-hydration script. Persisted to the user's
  notification/account preferences when signed in.
- **Focus ring** uses `--focus-ring`; never removed without a replacement ([11 §4](../design-system/11-color-system.md)).

---

## 8. Auth on the client

Session handling is **NextAuth.js**; the NestJS API is the identity source of truth (JWT RS256, 15-min
access token, refresh via httpOnly cookie — [05 §1 & §7](./05-api-conventions.md)).

- **Session** is provided by NextAuth's `SessionProvider` in the root layout. Client components read it
  with `useSession()`; RSCs/route handlers read it with `getServerSession()`. The server API client
  attaches the access token from the session (§3.3).
- **Protected routes / middleware** — `apps/web/middleware.ts` guards the `(app)` and `/admin` route
  groups: no session → redirect to `/login?callbackUrl=…`; wrong role for `/admin` → redirect to
  `/dashboard` (client mirror of the API's `AdminGuard`, [05 §7](./05-api-conventions.md)). The API
  remains the real authority — middleware is UX, not the security boundary.

```ts
// apps/web/middleware.ts
export { default } from 'next-auth/middleware';
export const config = { matcher: ['/dashboard/:path*', '/surveys/:path*', '/polls/:path*',
  '/games/:path*', '/rewards/:path*', '/account/:path*', '/admin/:path*'] };
```

- **Token refresh** — the NextAuth JWT callback refreshes the short-lived access token using the
  httpOnly refresh cookie via `POST /v1/auth/refresh` before expiry. A `401 UNAUTHENTICATED` from the
  API triggers a one-time refresh-and-retry in the client; a second `401` signs the user out and
  redirects to `/login`.
- **Redirects** — post-login goes to `callbackUrl` or `/dashboard`; verify-email success lands on the
  dashboard with the +500 toast; sign-out clears the session and returns to `(marketing)` `/`.

---

## 9. Routing, code-splitting, image optimization

- **Navigation** uses `next/link` (`<Link>`) for client-side transitions and prefetching; the shared
  `LinkButton`/`SidebarNav`/`BottomNav`/`Breadcrumbs` wrap it. Programmatic nav uses `useRouter()` from
  `next/navigation`.
- **Code-splitting** is automatic per route segment. Heavy client-only widgets (`SpinWheel` with its
  animation, `ChatWidget`, charts) are additionally `next/dynamic`-imported with `ssr: false` and a
  `Skeleton` fallback, so they don't bloat the initial bundle or the server render.
- **Image optimization** — all photos and reward/catalogue images use **`next/image`** (automatic
  responsive `srcset`, lazy loading, modern formats, CDN optimization). Reward images, profile avatars
  (with `Avatar` initials fallback), and marketing hero art all go through it; remote hosts are
  allow-listed in `next.config.js` `images.remotePatterns`. Decorative-only images get empty `alt`.

---

## 10. Accessibility, responsive, i18n-readiness, page states

- **Accessibility** — the UI kit is accessible-by-default (Radix primitives: keyboard, focus trap, ARIA;
  [13 §Principles](../design-system/13-components-library.md)). Feature code preserves it: label every
  control via `FormField`, keep visible focus (`--focus-ring`), never convey meaning by color alone —
  poll result bars and status badges carry text/icons too ([11 §4](../design-system/11-color-system.md)).
  Target WCAG AA contrast (already guaranteed by tokens).
- **Responsive** — mobile-first Tailwind breakpoints. `AppShell` swaps `SidebarNav` (desktop) for
  `BottomNav` (mobile); filters move into a `Drawer` on small screens. The product is responsive-web
  only (no native app — [00 §3](../00-project-overview.md)).
- **i18n-readiness** — copy is centralised (no hard-coded strings in deep components) so a locale layer
  can be added without refactor. Formatting is locale-aware from day one: money renders via
  `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` on the derived `points / 100`
  value ([05 §1](./05-api-conventions.md)), dates via `Intl.DateTimeFormat`. Default locale **en-IN**,
  currency **INR**.
- **Error / loading / empty states via shared components** — this is mandatory, not per-feature:
  - **Loading**: `loading.tsx` + `Skeleton` shapes that mirror the real layout; inline `Spinner` for
    small in-place waits; `Button loading` during submits.
  - **Error**: `error.tsx` boundaries + `Alert` for inline/form errors, mapped from the API envelope (§5).
  - **Empty**: `EmptyState` (icon + message + optional CTA) for "no polls", "no history", "no rewards".

---

## 11. Folder conventions (feature code, hooks, API client)

Feature-oriented layout inside `apps/web`. Route files (`app/(app)/…/page.tsx`) stay thin — they fetch
initial data and compose feature components; the logic lives under `features/`.

```text
apps/web/
├─ app/…                         # routes only (thin pages, layouts, loading/error/not-found)
├─ features/                     # one folder per domain area
│  ├─ polls/
│  │  ├─ components/             # VotePanel, PollResultBars wrappers (compose @influencer/ui)
│  │  ├─ hooks/                  # usePoll, useVote (TanStack Query)
│  │  └─ index.ts
│  ├─ points/                    # usePoints (balance), points history hooks
│  ├─ games/                     # SpinWheel island, useSpin
│  ├─ rewards/ · surveys/ · account/ · auth/ …
├─ components/                   # cross-feature app-only components (still compose the kit)
├─ hooks/                        # cross-cutting client hooks
│  ├─ useApi.ts                  # wraps the client API + TanStack Query (query/mutation factories)
│  ├─ usePoints.ts               # points balance (['points','balance']) + INR helper
│  └─ useTheme.ts                # theme store binding (data-theme)
├─ lib/
│  ├─ api/
│  │  ├─ client.ts               # apiFetch + ApiError (envelope unwrap) — §3.3
│  │  ├─ server.ts               # RSC/server-action client (session token)
│  │  └─ endpoints/              # typed per-resource methods (polls, points, rewards…) using @influencer/types
│  ├─ query/queryClient.ts       # TanStack QueryClient + provider
│  ├─ auth/                       # NextAuth config, getServerSession helpers
│  └─ stores/                     # tiny Zustand stores (theme, layout)
└─ middleware.ts                  # route protection (§8)
```

Conventions:

- **API client location** is `app/lib/api/` — the **only** place `fetch` is called. Everything else goes
  through typed endpoint methods or the `useApi`/feature hooks.
- **Hooks**: cross-cutting ones (`useApi`, `usePoints`) live in `app/hooks/`; feature-specific ones
  (`useVote`, `useSpin`, `useRedeem`) live in `features/<area>/hooks/`.
- **Naming**: components `PascalCase.tsx`, hooks `useX.ts`, schemas/types imported from `@influencer/types`
  (never redefined locally).
- A feature exposes a small public surface via `features/<area>/index.ts`; pages import from there.

---

## Related docs

- [00-project-overview](../00-project-overview.md) — product, modules, points/INR constant.
- [05-api-conventions](./05-api-conventions.md) — response envelope, error codes, auth, pagination.
- [11-color-system](../design-system/11-color-system.md) — tokens, dark mode, Tailwind preset.
- [13-components-library](../design-system/13-components-library.md) — the shared UI kit this app consumes.
- [phases/00-roadmap](../phases/00-roadmap.md) — build order and definition of done.
