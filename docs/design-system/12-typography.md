# 12 — Typography ⭐

Typography is a **design token layer**, exactly like [color](11-color-system.md). Sizes, line-heights,
weights, and letter-spacing are named tokens mapped into the Tailwind theme in `packages/config` and
exposed through the `Text` and `Heading` components in
[13-components-library.md](13-components-library.md). Feature code **never** hard-codes `font-size`,
`text-[13px]`, or arbitrary `leading-*` values — it uses a **semantic role** (`variant="body"`,
`level={2}`) so the whole product stays visually consistent and a scale change is a config change, not a
find-and-replace.

Goal: a friendly, trustworthy, highly legible voice for an Indian-market (en-IN primary) rewards
platform, readable on low-end Android at 360px up to desktop, with points and ₹ amounts that align
cleanly in tables.

---

## 1. Font stack

### Primary UI font — **Inter**

We ship **Inter** as the single UI typeface for all product surfaces (body, headings, labels, numbers).

**Why Inter**

- **Legibility at small sizes** — Inter was designed for computer screens and UI; tall x-height and open
  apertures keep 12–14px text crisp on cheap Android panels, our most common device class.
- **Neutral + friendly** — modern humanist sans that reads approachable (fits a magenta, rewards-driven
  brand) without being quirky, so it never fights the content.
- **Complete weight range** — a true variable font covering the 400–700 range we use, with proper
  optical spacing and OpenType features (tabular figures — see §6).
- **Free, open, self-hostable** (SIL Open Font License) — no licensing cost or CDN privacy concern.
- **Excellent Latin coverage for en-IN**, including the currency symbols and diacritics we need.

**Fallback stack** (Inter fails to load, or a glyph is missing):

```css
--font-sans:
  "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
  "Helvetica Neue", Arial, "Noto Sans", sans-serif,
  "Apple Color Emoji", "Segoe UI Emoji";
```

The system-first fallback means first paint uses a native sans that closely matches Inter's metrics, so
the swap is near-invisible and there is no blank text (`font-display: swap`).

### Indic / multi-script consideration

en-IN is the **primary** locale, so Latin is the working script today. Inter does **not** cover Indic
scripts. We reserve a **Noto Sans** family as the sanctioned path for future Hindi/regional content, added
per-script so we never pull unused fonts:

```css
--font-sans-deva: "Inter", "Noto Sans Devanagari", var(--font-sans); /* future: hi-IN */
```

Rule: if/when a locale needs an Indic script, add the matching **Noto Sans <Script>** as a fallback
**after Inter** (Latin still uses Inter for numerals and mixed content). Do not swap the whole stack.

### Optional display font (hero / marketing only)

For marketing hero headlines and the spin-wheel "you won" moment **only**, an optional display face
(**Clash Display** or **Space Grotesk**) may be used via the `display` role. It is **never** used in
product chrome, forms, tables, or long text. If unset, `display` falls back to Inter 700.

```css
--font-display: "Clash Display", var(--font-sans);
```

### Loading — `next/font`, self-hosted

Fonts are loaded with **`next/font/local`** (self-hosted `.woff2` in `apps/web`), **not** the Google
Fonts CDN:

- **Performance** — files are served from our origin, fingerprinted, `preload`ed, and subset to `latin`
  (+ `latin-ext`). `next/font` inlines the `@font-face` and eliminates render-blocking network round-trips.
- **Zero layout shift** — `next/font` computes a size-adjusted fallback automatically, so CLS ≈ 0.
- **Privacy / compliance** — no requests to Google, which matters for an Indian data-privacy posture; no
  third-party font CDN in the critical path.

```ts
// apps/web/lib/fonts.ts
import localFont from "next/font/local";

export const inter = localFont({
  src: "../assets/fonts/InterVariable.woff2",
  variable: "--font-sans",
  display: "swap",
  weight: "400 700",
});
```

The exported `variable` (`--font-sans`) is applied to `<html>` and consumed by the Tailwind preset (§9).

---

## 2. Type scale

A harmonious scale spanning **12 → 48px**. Sizes are declared in **rem** (respect user zoom / root font
size); px shown for reference at a 16px root. Line-heights are unitless multipliers snapped to the 4pt
grid (§5). Tighter tracking on large text, slightly open tracking on the smallest.

| Token         | rem      | px  | Line-height   | Letter-spacing | Default weight | Example usage                              |
|---------------|----------|-----|---------------|----------------|----------------|--------------------------------------------|
| `text-xs`     | 0.75rem  | 12  | 1.333 (16px)  | +0.01em        | 400 / 500      | captions, timestamps, table meta, overline |
| `text-sm`     | 0.875rem | 14  | 1.429 (20px)  | 0              | 400 / 500      | secondary body, labels, hints, badges      |
| `text-base`   | 1rem     | 16  | 1.5 (24px)    | 0              | 400            | **default body text**, inputs, paragraphs  |
| `text-lg`     | 1.125rem | 18  | 1.556 (28px)  | 0              | 400 / 500      | lead paragraph, large body, card intro     |
| `text-xl`     | 1.25rem  | 20  | 1.4 (28px)    | −0.005em       | 600            | h6 / small section heading, card title     |
| `text-2xl`    | 1.5rem   | 24  | 1.333 (32px)  | −0.01em        | 600            | h5 / dialog title                          |
| `text-3xl`    | 1.875rem | 30  | 1.2 (36px)    | −0.015em       | 700            | h3 / page section heading                  |
| `text-4xl`    | 2.25rem  | 36  | 1.111 (40px)  | −0.02em        | 700            | h2 / page title                            |
| `display`     | 3rem     | 48  | 1.083 (52px)  | −0.025em       | 700            | h1 / hero headline (uses `--font-display`) |

Larger jumps between headings are intentional (a modular ~1.2–1.25 ratio at the top) so hierarchy reads
at a glance; body sizes stay dense for information-rich tables and lists.

---

## 3. Weights

We ship **four** weights only — anything else is off-scale. Fewer weights = smaller payload and clearer
hierarchy.

| Weight | Name     | Semantic use                                                                 |
|--------|----------|------------------------------------------------------------------------------|
| 400    | Regular  | **Body copy**, paragraphs, input values, most UI text. The default.          |
| 500    | Medium   | Labels, table headers, badges, nav items, subtle emphasis, buttons (`sm`).   |
| 600    | Semibold | **Headings h3–h6**, card titles, dialog titles, primary buttons, stat labels.|
| 700    | Bold     | **h1/h2, display**, key emphasis, points/₹ amounts you want to pop, alerts.  |

Rules:

- Do **not** use 300/light — it fails contrast and legibility at small sizes on low-end screens.
- Do **not** fake bold via CSS `font-weight` on a face that lacks the cut; all four are self-hosted.
- Emphasis inside body copy uses **600** (`<strong>`), not italics for weight — italics only for genuine
  titles/quotes.

---

## 4. Semantic text roles

Every piece of text maps to a **role**, not a raw size. Roles are exposed as **variants** of the shared
`Text` and `Heading` components ([13-components-library.md](13-components-library.md) §1). Color comes
from the text tokens in [11-color-system.md](11-color-system.md) (`--color-text`, `--color-text-secondary`,
`--color-text-muted`).

| Role       | Component (variant)          | Scale token   | Weight | Default color             | Notes                                            |
|------------|------------------------------|---------------|--------|---------------------------|--------------------------------------------------|
| `display`  | `Heading level={1}` hero     | `display`     | 700    | `text` / brand            | `--font-display`; hero + spin-win only           |
| `h1`       | `Heading level={1}`          | `text-4xl`    | 700    | `text` (`neutral-800`)    | one per page                                     |
| `h2`       | `Heading level={2}`          | `text-4xl`    | 700    | `text`                    | major section                                    |
| `h3`       | `Heading level={3}`          | `text-3xl`    | 700    | `text`                    | section                                          |
| `h4`       | `Heading level={4}`          | `text-2xl`    | 600    | `text`                    | subsection / dialog title                        |
| `h5`       | `Heading level={5}`          | `text-xl`     | 600    | `text`                    | card title                                        |
| `h6`       | `Heading level={6}`          | `text-lg`     | 600    | `text`                    | small heading / overline group                   |
| `body`     | `Text variant="body"`        | `text-base`   | 400    | `text`                    | **default**; `<p>`                               |
| `body-sm`  | `Text variant="body-sm"`     | `text-sm`     | 400    | `text-secondary`          | secondary/dense copy, list meta                  |
| `caption`  | `Text variant="caption"`     | `text-xs`     | 400    | `text-muted`              | timestamps, helper text, footnotes               |
| `overline` | `Text variant="overline"`    | `text-xs`     | 600    | `text-muted`              | uppercase eyebrow, +0.06em tracking (short only) |
| `label`    | `Text variant="label"`       | `text-sm`     | 500    | `text`                    | form labels (via `FormField`), stat labels       |
| `code`     | `Text variant="code"`        | `text-sm`     | 400    | `text`                    | `--font-mono` (see §6), inline & block code       |

`Text` renders a `<span>`/`<p>` and accepts `color` + `weight` overrides mapped to tokens; `Heading`
renders the semantic `h1`–`h6` element for `level` while letting `variant` decouple **visual** size from
**document** level (e.g. a visually-small `h2` for SEO/a11y structure without a giant type size). This
keeps the heading outline correct for screen readers regardless of visual size.

```tsx
<Heading level={1}>My Rewards</Heading>
<Text variant="body">Earn points by taking polls and surveys.</Text>
<Text variant="label">Email</Text>            {/* used internally by FormField */}
<Text variant="caption" color="muted">Updated 2 min ago</Text>
```

---

## 5. Line length, spacing & vertical rhythm

- **Line length (measure)** — target **60–75 characters** for paragraphs. Use the `prose` container /
  `max-w-prose` (~65ch). Never let body text run the full width of a desktop card.
- **Paragraph spacing** — space **between** blocks, not inside: paragraphs get `margin-block: 0 1rem`
  (16px); list items `4–8px`. No double `<br>`.
- **Vertical rhythm (4/8pt grid)** — all line-heights resolve to multiples of **4px** (§2), and vertical
  spacing between typographic blocks uses the **8pt** spacing scale (`4 / 8 / 12 / 16 / 24 / 32 / 40 / 48`).
  Headings carry more space **above** than below (`margin-top` > `margin-bottom`) to bind a heading to the
  content it introduces.
- **Heading rhythm** — `h2` ≈ `32px` top / `12px` bottom; `h3` ≈ `24px` top / `8px` bottom. Encapsulated
  in `Heading`, so authors don't hand-tune margins.

| Element        | Space above | Space below |
|----------------|-------------|-------------|
| h1 / display   | —           | 16px        |
| h2             | 32px        | 12px        |
| h3             | 24px        | 8px         |
| h4–h6          | 16px        | 8px         |
| body paragraph | 0           | 16px        |
| list item      | —           | 4–8px       |

---

## 6. Numeric & currency styling

Points and money are core to the product, so numbers must **align in columns** and never jitter as they
change (e.g. a live points counter).

- **Tabular (monospaced) figures** — enable `font-feature-settings: "tnum" 1, "lnum" 1;` (Inter supports
  it) for **all numeric contexts**: `StatCard`, `PointsPill`, `DataTable` numeric columns, points history,
  ₹ amounts, and any animated counter. This is exposed as a utility `tabular-nums` / `.font-tnum` and
  baked into those components.
- **Proportional figures** are fine in flowing prose ("you earned 15 points"), where alignment doesn't
  matter.
- **Points display** — integer + unit, thin non-breaking space, unit not abbreviated inconsistently:
  `1,250 pts`. Grouping uses the **en-IN / Indian digit-group** convention (`1,25,000`) via
  `Intl.NumberFormat("en-IN")`. The `PointsPill` shows `+15 pts` (see [13](13-components-library.md) §6).
- **Currency (INR)** — render with `Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })`
  → `₹1,250.00`; drop `.00` for whole-rupee reward prices (`₹500`). The `₹` sign hugs the number (no
  space) and uses tabular figures so a rewards table's price column aligns.
- **Monospace font** (`--font-mono`) — for `code` role and any raw token/id display:
  `ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace`. Not used for prices/points
  (those stay Inter + `tnum`).

```tsx
// helpers in packages/ui (or packages/utils)
formatPoints(1250)  // "1,250"   -> rendered as "1,250 pts" with tabular-nums
formatINR(500)      // "₹500"
formatINR(1250.5)   // "₹1,250.50"
```

---

## 7. Responsive typography

- **Body stays 16px** at every breakpoint — do **not** shrink base body text on mobile (it hurts
  legibility and iOS zooms `<16px` inputs). `body-sm`/`caption` remain fixed too.
- **Headings scale down on small screens.** Large roles (`display`, `h1`, `h2`) use **fluid `clamp()`** so
  they shrink smoothly between 360px and desktop without hard jumps:

  ```css
  --font-size-display: clamp(2rem, 1.4rem + 3vw, 3rem);    /* 32 → 48 */
  --font-size-4xl:     clamp(1.75rem, 1.4rem + 1.75vw, 2.25rem); /* 28 → 36 */
  --font-size-3xl:     clamp(1.5rem, 1.3rem + 1vw, 1.875rem);    /* 24 → 30 */
  ```

  Roles `text-2xl` and below are fixed (no fluid scaling needed).
- **Breakpoint reference** — Tailwind defaults (`sm 640` / `md 768` / `lg 1024` / `xl 1280`). `clamp()`
  handles the in-between so we rarely need per-breakpoint `md:text-*` overrides.
- **Mobile adjustments** — tighter heading top-margins on `< sm`; hero `display` may drop the optional
  display font weight emphasis; line length naturally shortens (measure handled by container width).

---

## 8. Accessibility

- **Minimum size** — **12px (`text-xs`)** is the floor, reserved for captions/overline; **never** for
  primary reading text. Interactive/body text is ≥ 14px, default 16px.
- **Contrast** — all text/background pairs meet **WCAG AA (≥ 4.5:1)**; large text (≥ 24px / ≥ 18.66px bold)
  meets **≥ 3:1**. Pairings are governed by [11-color-system.md](11-color-system.md#4-accessibility-rules-enforced):
  `neutral-800` on `neutral-50` and white on `magenta-600` pass. **Do not** use `magenta-600` for long
  body text — accents/links/headings only.
- **User zoom & rem** — sizes are in `rem`, so browser zoom and OS "large text" scale everything; never
  set `maximum-scale=1` or `user-scalable=no` on the viewport.
- **Avoid all-caps for long text** — `overline`/`overline`-style uppercase is for **short eyebrows only**
  (screen readers may spell out long uppercase; it also hurts readability). Use sentence case for
  headings and body. Apply caps via `text-transform: uppercase` on short labels, never by typing in caps
  (keeps the real string clean for search/SR).
- **Line-height & spacing** — body `line-height ≥ 1.5` and paragraph spacing satisfy WCAG 1.4.12; users
  can further increase text spacing without clipping (no fixed-height text containers).
- **Don't convey meaning by weight/color alone** — pair with text/icon (mirrors the color-system rule).

---

## 9. Tailwind mapping

The scale lives in the shared preset `packages/config/tailwind-preset.ts` (consumed by `apps/web` and
Storybook), mirroring the color token approach in [11-color-system.md](11-color-system.md#3-semantic-tokens-what-components-use).
CSS variables (fluid sizes, families) are declared in `packages/ui/src/styles/tokens.css` next to the
color tokens; Tailwind reads them so utilities and variables never drift.

```ts
// packages/config/tailwind-preset.ts (excerpt)
export default {
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", ...systemFallback],
        display: ["var(--font-display)", "var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      fontSize: {
        // [ size, { lineHeight, letterSpacing, fontWeight } ]
        xs:   ["0.75rem",  { lineHeight: "1rem",    letterSpacing: "0.01em"  }],
        sm:   ["0.875rem", { lineHeight: "1.25rem"  }],
        base: ["1rem",     { lineHeight: "1.5rem"   }],
        lg:   ["1.125rem", { lineHeight: "1.75rem"  }],
        xl:   ["1.25rem",  { lineHeight: "1.75rem",  letterSpacing: "-0.005em" }],
        "2xl":["1.5rem",   { lineHeight: "2rem",     letterSpacing: "-0.01em"  }],
        "3xl":["var(--font-size-3xl)", { lineHeight: "1.2",  letterSpacing: "-0.015em" }],
        "4xl":["var(--font-size-4xl)", { lineHeight: "1.111",letterSpacing: "-0.02em"  }],
        display:["var(--font-size-display)", { lineHeight: "1.083", letterSpacing: "-0.025em", fontWeight: "700" }],
      },
    },
  },
};
```

```css
/* packages/ui/src/styles/tokens.css (typography block) */
:root {
  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-display: "Clash Display", var(--font-sans);
  --font-mono: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace;

  --font-size-3xl:     clamp(1.5rem, 1.3rem + 1vw, 1.875rem);
  --font-size-4xl:     clamp(1.75rem, 1.4rem + 1.75vw, 2.25rem);
  --font-size-display: clamp(2rem, 1.4rem + 3vw, 3rem);
}

.font-tnum { font-feature-settings: "tnum" 1, "lnum" 1; } /* -> .tabular-nums utility */
```

- **`Text` / `Heading` consume tokens, not raw utilities** — each `variant` maps to one `fontSize` +
  `fontWeight` combination via `class-variance-authority` (same pattern as `Button` in
  [13](13-components-library.md#9-component-contract-example)). Feature code uses the component, so the
  scale is the single source of truth.
- **Dark mode** — typography is theme-agnostic; only **color** flips via the color tokens. No size/weight
  changes between themes.

---

## 10. Do's and don'ts

**Do**

- Use `Text` / `Heading` variants (semantic roles) for all text.
- Keep body at 16px; let `clamp()` scale headings.
- Use `tabular-nums` for points, ₹ amounts, and any table/counter numbers.
- Format numbers/currency with `Intl.NumberFormat("en-IN", …)`.
- Keep paragraphs to ~65ch; snap spacing to the 4/8pt grid.
- Use weight **600** for in-body emphasis; keep to the four shipped weights.
- Self-host Inter via `next/font`; subset to `latin`.

**Don't**

- Don't hard-code `font-size`, `text-[13px]`, or arbitrary `leading-*` in feature code.
- Don't use light (300) or introduce a fifth weight.
- Don't use `magenta-600` for long body text (accents/headings/links only).
- Don't set text below 12px, or use 12px for reading copy.
- Don't type strings in ALL CAPS or use all-caps for long text — transform short labels via CSS.
- Don't use the display font in product chrome, forms, or tables.
- Don't shrink mobile body text or disable user zoom.
- Don't load fonts from the Google Fonts CDN (privacy + performance).

---

See [11-color-system.md](11-color-system.md) for text color tokens and contrast rules, and
[13-components-library.md](13-components-library.md) for the `Text`/`Heading` components that expose these
roles. Patterns (forms, page states) assemble both in [14-patterns.md](14-patterns.md).
