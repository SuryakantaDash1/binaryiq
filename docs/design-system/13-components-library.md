# 13 — Components Library ⭐

The reusable UI kit in `packages/ui`. **Build once, use everywhere.** Module docs reference these by
name; they must not reinvent buttons, inputs, modals, tables, etc. If a module needs a new shared
component, it's added here first, then consumed.

**Principles**
- **Headless + tokens**: components are styled with the semantic tokens from
  [11-color-system.md](11-color-system.md); no hard-coded colors.
- **Composition over configuration**: small primitives compose into patterns; avoid mega-props.
- **Accessible by default**: keyboard, focus, ARIA built in (built on Radix UI primitives).
- **Typed**: every component has an explicit props interface exported from `packages/ui`.
- **Documented in Storybook**: each component has stories + a11y checks.

Tech: React + TypeScript, Tailwind (shared preset), Radix UI primitives, `class-variance-authority`
for variants, React Hook Form + Zod for forms, `lucide-react` icons, `sonner` for toasts.

---

## 1. Foundations

| Component | Purpose | Key props |
|---|---|---|
| `Box` / `Stack` / `Inline` | layout primitives (flex/grid, gap) | `gap`, `align`, `justify` |
| `Container` | max-width page container | `size` |
| `Text` | typographic text (see [12-typography.md](12-typography.md)) | `variant`, `color`, `weight` |
| `Heading` | h1–h6 with type scale | `level`, `variant` |
| `Icon` | wraps lucide icons w/ size tokens | `name`, `size` |

## 2. Actions

| Component | Variants | Notes |
|---|---|---|
| `Button` | `primary` \| `secondary` \| `outline` \| `ghost` \| `danger`; sizes `sm/md/lg`; `loading`, `disabled`, `iconLeft/iconRight`, `fullWidth` | primary = magenta-600; single source for all buttons |
| `IconButton` | same variants, square | requires `aria-label` |
| `LinkButton` | renders `<a>`/Next `<Link>` with button styling | |

## 3. Form fields (the reuse backbone for all forms)

All inputs share one `<FormField>` wrapper providing label, hint, error, required marker, and spacing —
so every form looks identical and a11y is automatic. Fields integrate with React Hook Form.

| Component | Purpose |
|---|---|
| `FormField` | label + control + hint + error slot; wraps any control |
| `Input` | text/email/number/password (with show/hide toggle) |
| `Textarea` | multiline |
| `Select` | single select (Radix) |
| `MultiSelect` | multi (used for multi-choice polls, assets) |
| `Checkbox` / `CheckboxGroup` | booleans / multi-choice |
| `RadioGroup` | single-choice (poll single, gender) |
| `DatePicker` | DOB, date-range filters |
| `PhoneInput` | country code + number (registration) |
| `PinInput` | OTP / verification code entry |
| `FileUpload` | profile photo (crop + preview) → returns URL |
| `Switch` | notification preference toggles |
| `FormError` / `FormHint` | inline messaging |

**Form pattern** (documented fully in [14-patterns.md](14-patterns.md)): `useForm(zodResolver(schema))`
with the **same Zod schema from `packages/types`** used by the API. Submit → typed API client → toast on
result. No form re-implements validation.

## 4. Overlays (single Modal system — reuse everywhere)

| Component | Purpose |
|---|---|
| `Modal` | base dialog (Radix Dialog): `open`, `onOpenChange`, `title`, `description`, `size`, `footer`. Focus-trapped, ESC/overlay close, scroll-lock. |
| `ConfirmModal` | built on `Modal` for confirm/cancel actions (redeem, delete photo, logout) |
| `Drawer` | side sheet (mobile filters, account nav) |
| `Popover` / `Tooltip` / `DropdownMenu` | Radix-based small overlays |
| `Toast` (`sonner`) | transient feedback: points earned, errors, saved |

**Every dialog in the app uses `Modal`/`ConfirmModal`.** Reward redemption, "already voted", spin result,
email-change confirm, etc. are configurations of these — not new components.

## 5. Data display

| Component | Purpose |
|---|---|
| `Card` | base surface: `header`, `body`, `footer`, `interactive`. Homepage module cards, reward cards, survey cards all use it. |
| `StatCard` | dashboard metric (balance, earned, spent) |
| `DataTable` | sortable, paginated table (points history, rewards history, admin lists). Column defs + server pagination hook. |
| `Badge` | status/labels: survey-type badges (Pink/Blue/Purple), redemption status, "New" |
| `Avatar` | profile photo w/ initials fallback |
| `ProgressBar` / `ProgressRing` | profile completion, poll result bars |
| `EmptyState` | no data (no polls, no history) — icon + message + optional CTA |
| `Skeleton` | loading placeholders (matches component shapes) |
| `Pagination` | cursor/offset controls bound to API pagination |
| `Tabs` | account tabs, points history/rewards history, survey types |

## 6. Feedback & status

| Component | Purpose |
|---|---|
| `Spinner` | inline loading |
| `Alert` | inline success/warning/danger/info banners (uses semantic tokens) |
| `Toast` | see overlays |
| `PointsPill` | shows `+15 pts` / balance chip in header — reused across polls, games, surveys |

## 7. Navigation & shell

| Component | Purpose |
|---|---|
| `AppShell` | authenticated layout: header + sidebar/nav + content |
| `Header` | logo, points balance (`PointsPill`), notifications bell, avatar menu |
| `SidebarNav` / `BottomNav` | desktop sidebar / mobile bottom nav |
| `Breadcrumbs` | admin + deep pages |
| `NotificationBell` | unread count + dropdown list |

## 8. Feature-specific shared components (still in `packages/ui` or `apps/web/components`)

These are reused within a feature area but standardized:
| Component | Used by |
|---|---|
| `SurveyCard` | surveys, priority/quick/premium listings (badge via `Badge`) |
| `PollCard` + `PollResultBars` | polls listing & results |
| `ModuleTeaserCard` | homepage "Polls / Games / Surveys" participate cards |
| `SpinWheel` | games module (SVG canvas, animation) — self-contained |
| `RewardCard` | rewards catalogue |
| `ChatWidget` | Luna chatbot floating button + panel |
| `RangeFilter` | date-range filter (points/rewards history) |

## 9. Component contract example

```tsx
// packages/ui/src/button/Button.tsx
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}
// styles via cva() using semantic tokens; primary => bg-primary text-on-primary hover:bg-primary-hover
```

## 10. Rules

- **Never** style with raw hex or one-off Tailwind color classes in feature code — use tokens/components.
- **Never** create a second modal/button/input implementation. Extend the shared one.
- New shared components require a Storybook story + a11y pass + an entry in this doc.
- Feature code imports from `@binaryiq/ui`; nothing imports Radix/Tailwind color directly except the UI
  package internals.

See [14-patterns.md](14-patterns.md) for how these assemble into forms, modals, and page states, and
[06-frontend-architecture.md](../architecture/06-frontend-architecture.md) for where they live.
