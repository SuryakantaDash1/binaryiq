# 10 — Design Principles ⭐

The north-star for how the **BinaryIQ** looks, feels, and behaves. Every screen, component,
and micro-interaction should trace back to the vision and principles here. This document is the
_"why"_; the [color system](11-color-system.md), [typography](12-typography.md), and
[components library](13-components-library.md) are the _"what"_ and _"how"_.

Read this before designing or building any surface. When a decision is ambiguous, the principle that
appears **earliest** in this document wins.

---

## 1. Design vision & personality

We reward people for their opinions. The experience must make members feel that their time is
**valued, safe, and a little bit fun** — every session should end with a visible "I earned something"
moment. See the product framing in [project overview](../00-project-overview.md).

**Brand adjectives (in priority order):**

| Adjective | Means in the UI | Anti-pattern to avoid |
|---|---|---|
| **Friendly** | Warm microcopy, rounded corners, human illustrations, encouraging empty states | Corporate/cold, jargon, dead-ends |
| **Rewarding** | Points feedback is immediate, visible, and celebrated | Silent success, buried balances |
| **Trustworthy** | Auditable points ledger, clear consent, no dark patterns | Hidden terms, ambiguous CTAs |
| **Gamified — but clean** | One tasteful spin/confetti moment; scarce magenta accent (60/30/10) | Casino noise, flashing, banner clutter |
| **Effortless** | One primary action per screen, mobile-first, progressive disclosure | Wall-of-form, cognitive overload |

**Personality in one line:** _the encouraging friend who pays you for your opinion — never the pushy
salesperson or the slot machine._ Magenta pops **because it is scarce**; delight lands **because it is
rare and earned**.

---

## 2. Core UX principles

These are the operating rules for every screen. They are ordered; earlier principles override later
ones in a conflict.

1. **Clarity over cleverness.** The member always knows _where they are_, _what to do next_, and _what
   they will get_. Prefer a plain label ("Redeem 4,500 pts → ₹45 donation") over a clever one. If a
   clever interaction adds a comprehension cost, cut it.

2. **Reward feedback is immediate & visible.** The moment points are earned (vote, survey complete,
   spin win), the user sees it: an animated [`PointsPill`](13-components-library.md#6-feedback--status)
   delta (`+15 pts`), a [`Toast`](13-components-library.md#4-overlays-single-modal-system--reuse-everywhere),
   and an updated header balance. Never credit points silently.

3. **One primary action per screen.** Exactly one `Button variant="primary"` (magenta) is the hero
   action per view — Vote, Submit, Spin, Redeem. Everything else is `secondary`, `outline`, or `ghost`.
   This is a hard rule; two magenta CTAs competing on one screen is a defect.

4. **Progressive disclosure.** Don't demand everything up front. Registration is two steps
   ([overview §4](../00-project-overview.md#4-module-map-build-modules)); the profile enriches over 14
   categories over time. Advanced filters, admin controls, and long forms reveal on intent (accordions,
   drawers, tabs), not all at once. Match survey questions grow the profile gradually.

5. **Mobile-first, thumb-friendly.** Design the small screen first, then enhance up. Primary actions sit
   within thumb reach; the [`BottomNav`](13-components-library.md#7-navigation--shell) anchors core
   navigation on mobile. Responsive web is the only shipped surface this release (no native apps).

6. **Consistency is a feature.** A member learns the UI once. Buttons, inputs, modals, toasts, cards,
   and empty states are the **same everywhere** — always the shared components from
   [`packages/ui`](13-components-library.md). Novelty is reserved for celebratory moments, never for
   chrome.

7. **Forgiving by default.** Destructive actions (redeem, delete photo, logout) route through
   [`ConfirmModal`](13-components-library.md#4-overlays-single-modal-system--reuse-everywhere). Errors
   are recoverable, inline, and never blame the user. Optimistic UI is allowed only where it can safely
   roll back.

8. **Trust is visible.** Points history is transparent and auditable, consent is explicit, and security
   posture is shown, not implied (see [§10](#10-trust--compliance-ui)). We never trade member trust for
   a conversion bump.

---

## 3. Accessibility standard (WCAG 2.1 AA)

Accessibility is a baseline requirement, not a phase. Every shared component ships accessible
(keyboard, focus, ARIA) via Radix primitives; feature code must not regress this. Target conformance:
**WCAG 2.1 Level AA**.

### 3.1 Color & contrast
- Body text meets **≥ 4.5:1**; large text (≥ 24px, or ≥ 19px bold) and UI components/graphics meet
  **≥ 3:1**. The token pairings are pre-verified in the
  [color system §4](11-color-system.md#4-accessibility-rules-enforced) — e.g. `neutral-800` on
  `neutral-50`, and white on `magenta-600`, both pass AA.
- **Never** use `magenta-600` for long body text (it is for actions, links, accents, headings only).
- **Never rely on color alone.** Poll results, survey-type badges, and statuses also carry text and/or
  an icon. Success is green **and** a check; danger is red **and** an alert icon.

### 3.2 Keyboard navigation
- Every interactive element is reachable and operable by keyboard in a logical tab order.
- No keyboard traps (except intentional, escapable [`Modal`](13-components-library.md#4-overlays-single-modal-system--reuse-everywhere)
  focus traps, which close on `ESC`).
- Standard keys work: `Enter`/`Space` activate, `ESC` closes overlays, arrow keys move within
  `RadioGroup`, `Tabs`, `Select`, `MultiSelect`, and menus (Radix-provided).
- Provide a **"Skip to content"** link as the first focusable element in `AppShell`.

### 3.3 Focus visibility
- Focus is **always** visible using the `--focus-ring` token
  (`0 0 0 3px rgba(233,30,140,.35)` — see [color system §3](11-color-system.md#3-semantic-tokens-what-components-use)).
- Never remove an outline without an equivalent visible replacement. Use `:focus-visible` so pointer
  users aren't shown rings unnecessarily, but keyboard users always are.

### 3.4 ARIA & semantics
- Prefer native semantic HTML (`<button>`, `<nav>`, `<main>`, `<label>`) before ARIA.
- `IconButton` and any icon-only control **require** an `aria-label`.
- Live regions: point-earning toasts and balance updates use `aria-live="polite"`; blocking errors use
  `aria-live="assertive"`.
- Modals expose `aria-modal`, labelled title/description; the `NotificationBell` count is announced.
- Decorative illustrations/icons are `aria-hidden`; meaningful images have descriptive `alt` text.

### 3.5 Motion & reduced motion
- Honor `prefers-reduced-motion: reduce`. When set: **disable non-essential animation**, remove parallax
  and confetti, and reduce the [`SpinWheel`](13-components-library.md#8-feature-specific-shared-components-still-in-packagesui-or-appswebcomponents)
  to a **quick, minimal transition to the result** (no long spin, no strobing). The reward outcome is
  never gated on the animation completing.
- No content flashes more than **3 times per second** (seizure safety).

### 3.6 Forms & targets
- Every field has a programmatically associated visible `<label>` via
  [`FormField`](13-components-library.md#3-form-fields-the-reuse-backbone-for-all-forms) — placeholders
  are never the only label.
- Errors are conveyed by text (not color alone), linked with `aria-describedby`, and focus moves to the
  first error on submit.
- **Touch target ≥ 44×44 px** (WCAG 2.5.5 / AA target size); spacing prevents mis-taps on mobile.
- Inputs use correct `type`/`inputmode`/`autocomplete` (email, tel, one-time-code for
  [`PinInput`](13-components-library.md#3-form-fields-the-reuse-backbone-for-all-forms)).

---

## 4. Responsive & layout

**Mobile-first.** Author base styles for the smallest screen; layer enhancements upward with `min-width`
media queries.

### 4.1 Breakpoints
Align to the Tailwind preset in `packages/config`.

| Token | Min width | Typical target |
|---|---|---|
| `sm` | 640px | large phones / small tablets (landscape phone) |
| `md` | 768px | tablets |
| `lg` | 1024px | small laptops — **sidebar appears here** |
| `xl` | 1280px | desktop |
| `2xl` | 1536px | large desktop |

### 4.2 Spacing & grid — 4/8pt scale
- Base spacing unit is **4px**; the primary rhythm is **8pt** (8/16/24/32/48/64). Use scale steps only —
  no arbitrary `13px` gaps.
- Layout is built from [`Box` / `Stack` / `Inline`](13-components-library.md#1-foundations) with a `gap`
  token, never ad-hoc margins.
- Content grids: 4 columns (mobile) → 8 (tablet) → 12 (desktop), gutters on the 8pt scale.

### 4.3 Containers
- Page content lives inside [`Container`](13-components-library.md#1-foundations) with a max width
  (~`1200px` for app content, narrower ~`640px` for focused flows like auth/redeem). Full-bleed is
  reserved for heroes and the spin wheel.

### 4.4 Navigation shell
- **Mobile (`< lg`):** [`BottomNav`](13-components-library.md#7-navigation--shell) for core destinations
  (Home / Surveys / Polls / Rewards / Account); filters and secondary nav use a
  [`Drawer`](13-components-library.md#4-overlays-single-modal-system--reuse-everywhere). Header carries
  logo, [`PointsPill`](13-components-library.md#6-feedback--status), and `NotificationBell`.
- **Desktop (`≥ lg`):** persistent [`SidebarNav`](13-components-library.md#7-navigation--shell); no
  bottom nav. Same [`AppShell`](13-components-library.md#7-navigation--shell) swaps the nav component by
  breakpoint — one shell, two presentations.

---

## 5. Spacing, elevation, radius & motion tokens

Everything visual is a **token**. Extend the token set in
[`packages/ui/src/styles/tokens.css`](11-color-system.md#6-where-this-lives-in-code); never hard-code
values in feature code.

### 5.1 Radius (from the color system)
`--radius-sm: 6px` · `--radius-md: 10px` · `--radius-lg: 16px` · `--radius-full: 9999px`.
Cards/inputs use `md`; buttons `md`; pills/avatars/badges `full`; modals `lg`. Rounded corners reinforce
the _friendly_ personality — but stay consistent, don't mix radii within one component.

### 5.2 Elevation (shadows)
`--shadow-sm` (subtle borders/hover) · `--shadow-md` (cards, popovers) · `--shadow-lg` (modals, spin
result). Elevation communicates layering — resting surfaces are flat (`sm` or border only), overlays
lift. Don't stack heavy shadows to "decorate"; keep UI chrome calm (see
[color system §5, 60/30/10](11-color-system.md#5-usage-guidance)).

### 5.3 Motion tokens
Add duration/easing tokens alongside the existing effect tokens:

```css
:root {
  /* durations */
  --motion-fast:   120ms;  /* hover, focus, small state changes */
  --motion-base:   200ms;  /* toasts, popovers, tab/content swaps */
  --motion-slow:   320ms;  /* modal/drawer enter, progress fills */
  /* easing */
  --ease-standard: cubic-bezier(.2, 0, 0, 1);    /* most UI */
  --ease-emphasis: cubic-bezier(.2, 0, 0, 1.2);  /* celebratory pop */
}
```

**Animation guidelines**
- **When to animate:** state changes that benefit from continuity — hover/focus, entering/leaving
  overlays, points counting up, progress bar fills, list reflow.
- **When _not_ to:** never animate purely decoratively; never block input on animation; never animate
  on initial page load of static content.
- **Durations:** micro-interactions ≤ `--motion-fast`; standard transitions `--motion-base`; larger
  enters `--motion-slow`. Anything longer feels sluggish.
- **Easing:** `--ease-standard` for UI; `--ease-emphasis` only for reward "pops".
- **Celebratory exceptions (sanctioned):** the [`SpinWheel`](13-components-library.md#8-feature-specific-shared-components-still-in-packagesui-or-appswebcomponents)
  spin and **confetti** on a spin win / successful redemption may exceed normal durations. These are the
  _only_ places long/emphatic motion is allowed, and all are suppressed under `prefers-reduced-motion`
  ([§3.5](#35-motion--reduced-motion)).

---

## 6. Content & microcopy guidelines

Copy is part of the design. It carries the _friendly + trustworthy_ personality.

- **Tone:** warm, clear, encouraging, second person ("You earned…", "Let's finish your profile"). Never
  condescending, never hypey. Sentence case for UI labels; avoid ALL-CAPS except tiny badge labels.
- **Points phrasing:** always the short unit **`pts`**. Earnings show a signed delta: **`+15 pts`**,
  **`+500 pts`**; spends show **`−4,500 pts`**. Balances are grouped with thousands separators
  (`12,450 pts`). This exact style is what [`PointsPill`](13-components-library.md#6-feedback--status)
  renders everywhere.
- **INR / currency:** rupee symbol prefixes the amount with no space — **`₹45`**, **`₹900.00`** — using
  the Indian digit grouping (`₹1,00,000`). Show the conversion transparently near redemptions:
  _"4,500 pts = ₹45"_ (the `100 pts = ₹1` constant lives in config, per
  [overview §1](../00-project-overview.md#1-vision)).
- **Error messages:** calm, specific, actionable, blame-free. Say what happened and what to do —
  _"That code didn't match. Check the 6 digits and try again."_ — not _"Invalid input"_. Never expose
  raw server/technical errors.
- **Empty states:** every [`EmptyState`](13-components-library.md#5-data-display) is an opportunity, not
  a dead-end — a friendly line plus a CTA. _"No polls right now — check back soon, or try today's spin."_
- **Numbers & dates:** localize for India (DD MMM YYYY, 24h or 12h consistently); pluralize correctly
  ("1 point" vs "2 points" in prose, though the pill uses `pts`).

---

## 7. Gamification & feedback patterns

Gamification is **consistent and shared**, never re-invented per feature. The same patterns fire for the
same kinds of events across polls, surveys, and games.

| Pattern | Component | Fires when |
|---|---|---|
| **Points pill / delta** | [`PointsPill`](13-components-library.md#6-feedback--status) | Any earn/spend; header balance updates in sync |
| **Toast on earning** | [`Toast` (sonner)](13-components-library.md#4-overlays-single-modal-system--reuse-everywhere) | Vote counted (`+15 pts`), survey complete, spin credited, redemption confirmed |
| **Progress indicators** | [`ProgressBar` / `ProgressRing`](13-components-library.md#5-data-display) | Profile completion (14 categories), multi-step survey, redemption steps |
| **Celebratory moment** | `SpinWheel` + **confetti** / result [`Modal`](13-components-library.md#4-overlays-single-modal-system--reuse-everywhere) | Spin win, first profile milestone, successful redemption |

**Rules of the game:**
- Earning is **always acknowledged** — pill delta + toast, and the header balance visibly increments
  (count-up animation within `--motion-base`).
- **Celebration is scarce.** Confetti is reserved for genuine wins (spin, redemption, big milestones) —
  not for routine saves. Overusing it cheapens it and violates the _clean_ half of "gamified but clean".
- Progress uses **magenta for the user's own progress/selection**; other segments/bars use
  `neutral-300` (per [color system §5](11-color-system.md#5-usage-guidance)).
- Rewards/points success uses **green**, never magenta — magenta is never repurposed as "success".
- All celebratory motion respects reduced-motion ([§3.5](#35-motion--reduced-motion)).

---

## 8. Iconography & imagery

- **Icons:** [`lucide-react`](13-components-library.md#1-foundations) only, via the `Icon` wrapper with
  size tokens. One icon set, consistent stroke weight; never mix icon libraries. Icons that convey
  meaning pair with text or an `aria-label`; purely decorative icons are `aria-hidden`.
- **Icon sizing:** align to the type/spacing scale (16 / 20 / 24). Inline icons match the adjacent text
  cap height.
- **Illustration style:** friendly, rounded, flat-with-soft-shading, on-brand (magenta accents against
  neutral surfaces). Used for empty states, onboarding, celebratory moments, and marketing heroes —
  never as load-bearing UI. Keep humans warm and inclusive for the Indian market.
- **Reward & charity imagery:** authentic, respectful photography or illustration that communicates real
  impact (donation causes, payout). Charity/reward success states use **green**; imagery must not
  overpromise or misrepresent the reward value.
- **Gradients:** allowed only for heroes/marketing and the spin wheel
  ([color system §5](11-color-system.md#5-usage-guidance)); app chrome stays flat.

---

## 9. Consistency rules

The platform is a system, not a collection of pages. **Reuse components and tokens — do not re-create
them.** See the hard rules in [components library §10](13-components-library.md#10-rules).

**Do**
- ✅ Use semantic tokens (`bg-primary`, `text-muted`, `--radius-md`, `--shadow-md`, `--motion-base`).
- ✅ Compose from [`packages/ui`](13-components-library.md) — one `Button`, one `Modal`, one `FormField`.
- ✅ Add a genuinely new shared need **to the library first** (with a Storybook story + a11y pass), then
  consume it.
- ✅ Keep one primary action, 60/30/10 color balance, and the 4/8pt spacing rhythm on every screen.

**Don't**
- ❌ Hard-code hex or one-off Tailwind color classes in feature code (e.g. `text-[#E91E8C]`,
  `bg-pink-500`). Use tokens.
- ❌ Build a second button/modal/input/toast implementation, or fork a component's styles inline.
- ❌ Invent a new accent hue per feature — only the sanctioned feature accents exist
  ([color system §2](11-color-system.md#2-primitive-palette)).
- ❌ Use arbitrary spacing/radii/durations outside the token scale.

> **Example — right vs wrong.** Reward redemption confirm: **Do** configure
> [`ConfirmModal`](13-components-library.md#4-overlays-single-modal-system--reuse-everywhere) with
> title/body/`danger` action. **Don't** hand-roll a bespoke dialog with a custom overlay and a
> `bg-pink-600` button.

---

## 10. Trust & compliance UI

Trust is a first-class design outcome — the platform handles member data and real monetary value under
India's **DPDP Act 2023 / CERT-In 2022** and is GDPR-ready
([overview §1](../00-project-overview.md#1-vision)).

- **Consent, explicit & granular.** Registration and data-use consents are opt-in with plain-language
  labels and links to policy — never pre-ticked, never bundled. Notification preferences
  (Email/Push/SMS/WhatsApp) are user-controlled toggles
  ([`Switch`](13-components-library.md#3-form-fields-the-reuse-backbone-for-all-forms)), changeable any
  time.
- **Transparent points history.** The
  [points ledger](../00-project-overview.md#6-glossary) is presented as an auditable, read-only
  [`DataTable`](13-components-library.md#5-data-display): every credit/debit shows source, amount
  (`+15 pts` / `−4,500 pts`), balance-after, and timestamp. Balance is always _derived_ from the ledger
  and never silently edited — the UI reflects that immutability.
- **Redemption clarity.** Before confirming, show exactly what's spent and received
  (_"4,500 pts → ₹45 donation to [cause]"_), the resulting balance, and status afterward
  ([`Badge`](13-components-library.md#5-data-display): pending / completed).
- **Security & trust signals.** Surface security posture where it reassures — verified-email state,
  secure-connection/data-protection badges near sensitive flows (PayPal, password), and clear session
  controls. Signals must be **truthful**; no fake urgency or trust theater.
- **No dark patterns.** No pre-checked consents, disguised ads, hidden costs, confirm-shaming, or
  hard-to-find unsubscribe. Cancel/decline is always as easy as accept.
- **Privacy by default.** Collect only what's needed (progressive profiling), explain _why_ a field is
  asked, and make data-export/delete paths discoverable.

---

## Where to go next

- Palette, tokens, and contrast rules → [11-color-system.md](11-color-system.md)
- Type scale and text components → [12-typography.md](12-typography.md)
- The shared UI kit these principles govern → [13-components-library.md](13-components-library.md)
- How components assemble into forms, modals, and page states → [14-patterns.md](14-patterns.md)
- Product framing and constraints → [00-project-overview.md](../00-project-overview.md)
