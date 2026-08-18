# 14 — UI & Interaction Patterns ⭐

How the primitives in [13-components-library.md](13-components-library.md) assemble into the handful of
**canonical patterns** every screen reuses. A pattern is a fixed recipe: same components, same state
model, same a11y behaviour. If a screen needs a form, a dialog, a data view, a list, a wizard, or a
filter, it composes the pattern here — it does **not** invent a new one.

**Ground rules**
- Reuse the shared components by name; never re-implement a `Modal`, `Input`, `DataTable`, etc.
- Validation is defined **once** as a Zod schema in `packages/types` and reused by both the API
  (`ZodValidationPipe`) and the frontend (`zodResolver`). See
  [05-api-conventions.md](../architecture/05-api-conventions.md) §5.
- All server I/O goes through the **typed API client** generated from `packages/types`, and every
  response follows the [response envelope](../architecture/05-api-conventions.md) (`data` / `error` /
  `meta`).
- Colours/spacing/focus come from semantic tokens ([11-color-system.md](11-color-system.md)) — no raw
  hex, no one-off modals.
- Every pattern ships its accessibility behaviour by default (§10).

Stack: Next.js 14 (App Router), React Hook Form + Zod, TanStack Query, `sonner` toasts,
`@influencer/ui`, `@influencer/types`.

---

## 1. Form pattern (THE canonical form)

Every form in the product — registration, account/profile, profile-surveys, admin editors — follows
this exact recipe. There is **no per-form validation logic**; the same Zod schema validates on the
client and the server, so they can never drift.

**Recipe**
1. Import the schema + inferred type from `@influencer/types`.
2. `useForm({ resolver: zodResolver(schema), defaultValues })`.
3. Render controls with `FormField` + `Input`/`Select`/etc. from `@influencer/ui`, wired via
   `register` / `Controller`.
4. Submit through the **typed API client**.
5. On `VALIDATION_ERROR`, map `error.details[]` back onto fields with `setError`.
6. On success, show a success `toast` (and/or redirect).

```tsx
// apps/web/features/account/ProfileForm.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema, type UpdateProfileInput } from '@influencer/types';
import { Form, FormField, Input, Select, Button } from '@influencer/ui';
import { toast } from '@influencer/ui';
import { api, isApiError } from '@/lib/api-client';

export function ProfileForm({ initial }: { initial: UpdateProfileInput }) {
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema), // SAME schema the API validates with
    defaultValues: initial,
    mode: 'onBlur',
  });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  async function onSubmit(values: UpdateProfileInput) {
    try {
      const { data } = await api.account.updateProfile(values); // typed client
      toast.success('Profile saved', { description: 'Your changes are live.' });
      form.reset(data); // resync defaults so isDirty resets
    } catch (err) {
      // Map API VALIDATION_ERROR details[] back onto the exact fields
      if (isApiError(err, 'VALIDATION_ERROR')) {
        for (const d of err.error.details ?? []) {
          setError(d.field as keyof UpdateProfileInput, {
            type: 'server',
            message: humanizeIssue(d.issue), // 'invalid_format' -> 'Enter a valid value'
          });
        }
        // Surface a top-level summary too (see §4: form-level errors -> inline Alert)
        return;
      }
      toast.error('Could not save profile', {
        description: 'Please try again in a moment.',
      });
    }
  }

  return (
    <Form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormField label="Display name" required error={errors.displayName?.message}>
        <Input {...register('displayName')} autoComplete="name" />
      </FormField>

      <FormField label="Email" required error={errors.email?.message}>
        <Input type="email" {...register('email')} autoComplete="email" />
      </FormField>

      <FormField label="Gender" error={errors.gender?.message}>
        <Select
          {...register('gender')}
          options={[
            { value: 'FEMALE', label: 'Female' },
            { value: 'MALE', label: 'Male' },
            { value: 'NON_BINARY', label: 'Non-binary' },
            { value: 'UNDISCLOSED', label: 'Prefer not to say' },
          ]}
        />
      </FormField>

      <Button type="submit" variant="primary" loading={isSubmitting} disabled={!isDirty}>
        Save changes
      </Button>
    </Form>
  );
}
```

**Mapping the error envelope → fields.** The typed client throws a normalized error whose `error`
matches the [envelope](../architecture/05-api-conventions.md) §2. `details[]` is
`{ field, issue }[]`; `field` matches the Zod path, so `setError(field, …)` lights up exactly the
right `FormField`. A small `humanizeIssue()` map turns machine issues (`invalid_format`,
`too_small`, `already_taken`) into copy.

**Rules**
- Never write ad-hoc `if (!email.includes('@'))` checks — the schema owns validation.
- Never call `fetch` directly from a form; use the typed client so status/error codes are normalized.
- `disabled={!isDirty}` on submit for edit forms; always `loading` while `isSubmitting`.
- Field-level errors → `FormField error`. Non-field/form-level errors (e.g. `409 CONFLICT` on a
  whole submission) → inline `Alert` above the actions (§4), not a toast that vanishes.

---

## 2. Modal pattern (one dialog system)

**Every** dialog is a configuration of `Modal` (base) or `ConfirmModal` (confirm/cancel), both built on
the Radix Dialog primitive. Focus-trap, ESC/overlay dismiss, scroll-lock, and ARIA wiring come for free.
**Never build a bespoke modal, portal, or overlay in feature code.**

**Controlled open state.** Modals are controlled via `open` / `onOpenChange`. Keep the boolean in the
component that owns the action (or a small `useDisclosure()` helper).

### 2a. Confirm an action → `ConfirmModal`

Redeem a reward, delete a photo, log out, confirm an email change — all the same component.

```tsx
const redeem = useDisclosure();

<Button variant="primary" onClick={redeem.open}>Redeem</Button>

<ConfirmModal
  open={redeem.isOpen}
  onOpenChange={redeem.setOpen}
  title="Redeem 5,000 points?"
  description="You'll receive a ₹50 Amazon voucher by email. This can't be undone."
  confirmLabel="Redeem now"
  cancelLabel="Keep points"
  confirmVariant="primary"
  loading={mutation.isPending}
  onConfirm={() =>
    mutation.mutate(rewardId, {
      onSuccess: () => {
        redeem.close();
        toast.success('Voucher on its way', { description: 'Check your email.' });
      },
    })
  }
/>
```

### 2b. Informational / result modals → `Modal`

"You've already voted", spin result, insufficient-points — a `Modal` with a single acknowledge action.

```tsx
// "Already voted" — surfaced from a 409 CONFLICT on POST /polls/:id/vote
<Modal
  open={alreadyVoted}
  onOpenChange={setAlreadyVoted}
  title="You've already voted"
  description="Come back tomorrow for a new poll."
  footer={<Button onClick={() => setAlreadyVoted(false)}>Got it</Button>}
/>

// Spin result — celebratory (see §8)
<Modal open={result != null} onOpenChange={() => setResult(null)} size="sm" title="You won!">
  <SpinResult points={result?.points} />
  <PointsPill delta={result?.points} celebrate />
</Modal>

// Email-change confirm — a Modal that hosts a small Form (§1) for the OTP/confirm step
<Modal open={emailChange.isOpen} onOpenChange={emailChange.setOpen} title="Confirm your new email">
  <ConfirmEmailForm onDone={emailChange.close} />
</Modal>
```

**Rules**
- Reach for `ConfirmModal` for any yes/no destructive-or-costly action; `Modal` for everything else.
- Never trap the user: always provide a labelled dismiss (ConfirmModal's cancel, or an explicit
  acknowledge button). Don't disable ESC/overlay close unless a mutation is mid-flight.
- Modal `title` is the accessible name; always set it. Long bodies scroll inside the modal, not the page.

---

## 3. Empty / Loading / Error state pattern

**Every data view provides all three states.** No view renders "nothing" while loading and no view
renders a blank area when a request fails. TanStack Query gives us the state machine; shared components
render each branch:

| Query state | Component | Notes |
|---|---|---|
| `isPending` | `Skeleton` (matches the final layout's shape) | never a bare spinner for whole pages |
| success + empty list | `EmptyState` (icon + copy + optional CTA) | actionable where possible |
| `isError` | `Alert variant="danger"` with a **Retry** action | error boundary for render-time faults |
| success + data | the real view | |

```tsx
// apps/web/features/points/PointsHistory.tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import { Skeleton, EmptyState, Alert, Button, DataTable } from '@influencer/ui';
import { Coins } from 'lucide-react';
import { api } from '@/lib/api-client';

export function PointsHistory() {
  const q = useQuery({
    queryKey: ['points', 'transactions'],
    queryFn: () => api.points.listTransactions({ limit: 20 }),
  });

  if (q.isPending) return <TableSkeleton rows={8} />; // Skeleton, shaped like the table

  if (q.isError) {
    return (
      <Alert variant="danger" title="Couldn't load your history">
        Something went wrong on our end.
        <Button variant="outline" size="sm" onClick={() => q.refetch()}>Retry</Button>
      </Alert>
    );
  }

  if (q.data.data.length === 0) {
    return (
      <EmptyState
        icon={Coins}
        title="No points activity yet"
        description="Vote in a poll or take a survey to start earning."
        action={<Button variant="primary" href="/polls">Explore polls</Button>}
      />
    );
  }

  return <DataTable columns={txColumns} data={q.data.data} pagination={q.data.meta.pagination} />;
}
```

Wrap route segments in a shared `<ErrorBoundary fallback={<Alert variant="danger" … />}>` (via the App
Router `error.tsx`) so render-time exceptions degrade to the same `Alert`, not a white screen.

**Rules**
- Skeletons mirror the real shape (table rows, card grid) to avoid layout shift.
- `EmptyState` copy is specific and, where sensible, offers the next action (CTA to earn/participate).
- Errors are recoverable: always give **Retry**; never dead-end.

---

## 4. Toast vs inline Alert (feedback pattern)

Two feedback channels, used for different things. Choosing correctly is the pattern.

| Use a **Toast** (`sonner`) when… | Use an inline **`Alert`** when… |
|---|---|
| Feedback is transient and the user's context doesn't change: "Profile saved", "Copied", "Voucher on its way" | The message is tied to a specific place on the page (form-level submit error, a warning above a section) |
| Points earned / celebratory moments: `+15 pts` after a vote/survey (§8) | Persistent state the user must read/act on: "Insufficient points to redeem", "Survey expired" |
| A background action finished (async job, save) | A `422 UNPROCESSABLE` business-rule outcome that blocks the current action |

```tsx
// Points earned — celebratory toast after a successful vote
toast.success('+15 points!', {
  description: 'Nice — you voted in today's poll.',
  icon: <PointsPill delta={15} celebrate />,
});

// Save confirmation
toast.success('Saved');

// Recoverable request failure
toast.error('Couldn't save', { description: 'Check your connection and try again.' });

// Blocking business rule -> inline Alert, NOT a toast (it must persist)
<Alert variant="warning" title="Not enough points">
  You need 5,000 points to redeem this reward. You have 3,200.
</Alert>
```

**Rules**
- Field errors never toast — they go on the `FormField` (§1).
- Anything the user must be able to re-read or that gates an action is an `Alert`, not a toast.
- One toast per outcome; don't stack a toast **and** an alert for the same event.

---

## 5. Data table pattern (server, cursor pagination)

`DataTable` + column defs + **cursor pagination bound to `meta.pagination`** from the
[envelope](../architecture/05-api-conventions.md) §6. Used for points history, rewards/redemption
history, and admin lists. The frontend never invents its own paging math — it passes the opaque
`nextCursor` back.

```tsx
// apps/web/features/rewards/RedemptionHistory.tsx
'use client';
import { useInfiniteQuery } from '@tanstack/react-query';
import { DataTable, Button } from '@influencer/ui';
import { api } from '@/lib/api-client';

export function RedemptionHistory() {
  const q = useInfiniteQuery({
    queryKey: ['redemptions'],
    queryFn: ({ pageParam }) => api.redemptions.list({ limit: 20, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    // bind directly to the API envelope's pagination meta
    getNextPageParam: (last) =>
      last.meta.pagination.hasMore ? last.meta.pagination.nextCursor : undefined,
  });

  const rows = q.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <DataTable
      columns={redemptionColumns}
      data={rows}
      loading={q.isPending}                 // renders row Skeletons (§3)
      empty={<RedemptionsEmpty />}          // EmptyState (§3)
      footer={
        q.hasNextPage && (
          <Button variant="outline" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
            Load more
          </Button>
        )
      }
    />
  );
}
```

**Rules**
- Cursor pagination for large/append-only lists (history, votes, notifications). Offset (`page`/
  `pageSize`) only for small admin tables — `DataTable` supports both via the `pagination` prop.
- Sorting uses server allow-listed `?sort=&order=` params; never sort the whole dataset client-side.
- The table owns its loading/empty states by delegating to the §3 components.

---

## 6. List + card pattern

Card grids for polls, surveys, rewards, and homepage module teasers share one structure so they scan
identically. Feature cards (`SurveyCard`, `PollCard`, `RewardCard`, `ModuleTeaserCard`) all wrap the
base `Card`; the grid, loading, and empty behaviour are the pattern.

```tsx
// apps/web/features/surveys/SurveyGrid.tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import { Box, SurveyCard, Skeleton, EmptyState, Badge } from '@influencer/ui';

export function SurveyGrid() {
  const q = useQuery({ queryKey: ['surveys'], queryFn: () => api.surveys.list() });

  if (q.isPending)
    return (
      <Box className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="card" />)}
      </Box>
    );

  if (q.data.data.length === 0)
    return <EmptyState icon={ClipboardList} title="No surveys right now" description="Check back soon." />;

  return (
    <Box className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {q.data.data.map((s) => (
        <SurveyCard
          key={s.id}
          title={s.title}
          points={s.points}
          // Priority=magenta, Quick=info blue, Premium=violet — the only sanctioned accents
          badge={<Badge tone={s.type}>{typeLabel(s.type)}</Badge>}
          href={`/surveys/${s.id}`}
        />
      ))}
    </Box>
  );
}
```

**Consistent card structure:** `Card` header (title + `Badge`), body (context/meta), footer (points via
`PointsPill` + primary CTA). Interactive cards set `Card interactive` for the whole-card hover/focus
target. Survey-type accents follow [11-color-system.md](11-color-system.md) §2 (Priority→magenta,
Quick→info blue, Premium→violet) — never introduce new hues per feature.

---

## 7. Multi-step flow pattern (wizard)

The 2-step registration wizard is the reference for **any** multi-step flow (profile completion, guided
redemption). Each step is a §1 form validated by its own slice of the Zod schema; a small state machine
owns the step index, accumulated values, and draft persistence.

**Model**
- `step` index + `values` accumulator (or a `useWizard()` hook / small reducer).
- Each step validates only its fields (`schema.pick({...})`) before `next()`.
- **Draft persistence**: debounce-persist `values` to `localStorage` (or a `POST /auth/register/draft`)
  so a refresh doesn't lose progress; clear on completion.
- A `ProgressBar`/stepper communicates position.

```tsx
// apps/web/features/auth/RegisterWizard.tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@influencer/types';
import { ProgressBar, Button, Form, FormField, Input, PhoneInput } from '@influencer/ui';
import { useWizardDraft } from '@/hooks/useWizardDraft';

const STEPS = ['Account', 'Profile'] as const;

export function RegisterWizard() {
  const [step, setStep] = useWizardDraft('register:step', 0);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: useWizardDraft('register:values', {})[0], // rehydrate draft
  });

  // validate only the current step's fields before advancing
  const stepFields: Record<number, (keyof RegisterInput)[]> = {
    0: ['email', 'password'],
    1: ['fullName', 'phone', 'dob'],
  };

  async function next() {
    if (await form.trigger(stepFields[step])) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function onSubmit(values: RegisterInput) {
    await api.auth.register(values); // full schema validated client + server
    clearDraft('register:*');
    // -> verify-email screen
  }

  return (
    <Form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <ProgressBar
        value={((step + 1) / STEPS.length) * 100}
        aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
      />

      {/* Keep both step panels mounted so RHF retains values; toggle visibility */}
      <div hidden={step !== 0}>
        <FormField label="Email" required error={form.formState.errors.email?.message}>
          <Input type="email" {...form.register('email')} />
        </FormField>
        {/* password ... */}
      </div>

      <div hidden={step !== 1}>
        <FormField label="Full name" required error={form.formState.errors.fullName?.message}>
          <Input {...form.register('fullName')} />
        </FormField>
        {/* PhoneInput, DatePicker(dob) ... */}
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" variant="primary" onClick={next}>Continue</Button>
        ) : (
          <Button type="submit" variant="primary" loading={form.formState.isSubmitting}>
            Create account
          </Button>
        )}
      </div>
    </Form>
  );
}
```

**Rules**
- One `useForm` for the whole wizard; validate per-step slices via `form.trigger(fields)`.
- Persist a draft and rehydrate on mount; clear it on success.
- The final submit re-validates the **entire** schema (the same one the API enforces).
- Move focus to the new step's heading on navigation (§10).

---

## 8. Points / reward feedback pattern

Earning points is the core loop, so feedback is consistent and celebratory.

- **`PointsPill` in the header** (`Header` → `PointsPill`) always shows the live balance; it animates a
  brief `+N` when the balance increases (invalidate the `['account','balance']` query after any awarding
  action so it updates everywhere at once).
- **Celebratory moments** (spin win, first survey, milestone) use a `Modal` (§2b) plus a `+N pts` toast
  (§4). Gradients/animation are allowed here per [11-color-system.md](11-color-system.md) §5; keep the
  rest of the UI flat.
- Points feedback uses **success green** (points/rewards accent), never magenta-as-success.

```tsx
async function onVoted() {
  const { data } = await api.polls.vote(pollId, { optionIds });
  queryClient.invalidateQueries({ queryKey: ['account', 'balance'] }); // PointsPill refreshes
  toast.success(`+${data.pointsAwarded} points!`, { icon: <PointsPill delta={data.pointsAwarded} celebrate /> });
}
```

**INR is display-only:** show `points / 100` client-side; never treat points as money in state or on the
wire ([05-api-conventions.md](../architecture/05-api-conventions.md) §1).

---

## 9. Filter pattern (RangeFilter)

History views (points, rewards/redemptions) filter by **date range** via the shared `RangeFilter`
(built on `DatePicker`). The selected range maps to explicit query params and becomes part of the query
key so caching + refetch are automatic.

```tsx
// apps/web/features/points/PointsHistoryFilterable.tsx
const [range, setRange] = useState<{ from?: string; to?: string }>({});

const q = useInfiniteQuery({
  queryKey: ['points', 'transactions', range],           // range in key => auto refetch on change
  queryFn: ({ pageParam }) =>
    api.points.listTransactions({ ...range, limit: 20, cursor: pageParam }),
  getNextPageParam: (l) => (l.meta.pagination.hasMore ? l.meta.pagination.nextCursor : undefined),
});

<RangeFilter
  value={range}
  onChange={setRange}                 // -> ?from=&to= explicit params (never SQL-ish strings)
  presets={['7d', '30d', '90d', 'ytd']}
  aria-label="Filter history by date range"
/>
```

**Rules**
- Filters are explicit query params (`?from=&to=&type=`), matching
  [05-api-conventions.md](../architecture/05-api-conventions.md) §6 — never free-form strings.
- Put filter values in the TanStack query key; don't manually re-fetch.
- On mobile, host filters in a `Drawer`; the `RangeFilter` component is identical inside it.

---

## 10. Accessibility per pattern (built in, not bolted on)

These are non-negotiable behaviours each pattern must preserve:

- **Forms (§1):** every control wrapped in `FormField` gets a programmatic `<label>`, `aria-describedby`
  for hint/error, and `aria-invalid` when errored. On submit failure, move focus to the first invalid
  field. Required fields carry the required marker **and** `aria-required`. Never rely on colour alone —
  errors always have text.
- **Modals (§2):** `Modal`/`ConfirmModal` (Radix Dialog) trap focus, restore focus to the trigger on
  close, close on ESC/overlay, and expose `title` as the accessible name via `aria-labelledby`
  (+ `aria-describedby` for the description). Don't remove ESC/overlay close except while a mutation is
  in flight.
- **Empty/Loading/Error (§3):** skeleton regions set `aria-busy="true"`; error `Alert` uses
  `role="alert"` so it's announced; keep a visible, keyboard-reachable **Retry**.
- **Toasts (§4):** `sonner` renders into an `aria-live="polite"` region (errors `assertive`). Toasts are
  supplementary — never the *only* place a blocking error appears (that's an `Alert`, §4).
- **Data table (§5):** real `<table>` semantics with `<th scope>`; sortable headers expose
  `aria-sort`; "Load more" keeps focus and announces new-row count via a live region.
- **Cards/lists (§6):** whole-card links use one anchor (no nested interactives); the accessible name is
  the card title; grids are a natural DOM reading order.
- **Wizard (§7):** on step change move focus to the step heading, update the `ProgressBar`
  `aria-label` ("Step 2 of 2"), and keep completed steps' values so Back never loses data. Announce
  step transitions politely.
- **Points feedback (§8):** the `+N` announcement goes through the toast live region; celebratory
  animation respects `prefers-reduced-motion` (fall back to a static pill).
- **Filters (§9):** `RangeFilter` is fully keyboard-operable (`DatePicker` is a Radix-based popover with
  arrow-key navigation) and labelled; applying a filter announces the updated result count politely.

**Global:** focus is always visible via `--focus-ring` ([11-color-system.md](11-color-system.md) §4);
never remove an outline without a replacement.

---

### See also
- [13-components-library.md](13-components-library.md) — the primitives these patterns compose.
- [11-color-system.md](11-color-system.md) — tokens, accents, focus ring, reduced-motion.
- [05-api-conventions.md](../architecture/05-api-conventions.md) — response envelope, error codes,
  pagination that patterns §1/§3/§4/§5/§9 bind to.
