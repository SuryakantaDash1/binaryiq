# 11 — Color System ⭐

One brand color architecture for the whole product. Colors are **design tokens** (CSS variables) mapped
into the Tailwind theme in `packages/config`. Components reference **semantic tokens** (e.g.
`bg-primary`, `text-muted`), never raw hex. This keeps the UI consistent and makes theming/dark-mode a
config change, not a code change.

Brand anchor: the reference platform (Toluna) magenta `#E91E8C`. We build a full, accessible scale
around it rather than using one flat pink.

---

## 1. Token layers

1. **Primitive tokens** — the raw palette (magenta 50–900, neutral 0–950, semantic hues). Never used
   directly by components.
2. **Semantic tokens** — role-based aliases (`--color-primary`, `--color-bg`, `--color-danger`) that map
   to primitives and **flip for dark mode**. Components use only these.
3. **Component tokens** — optional per-component overrides (e.g. `--btn-primary-bg`) that default to
   semantic tokens.

## 2. Primitive palette

### Brand — Magenta (primary)
| Token | Hex | Use |
|---|---|---|
| `magenta-50` | `#FDF2F8` | tint backgrounds, hover surfaces |
| `magenta-100` | `#FCE7F3` | subtle fills, badges |
| `magenta-200` | `#FBCFE8` | borders on tinted surfaces |
| `magenta-300` | `#F9A8D4` | disabled primary |
| `magenta-400` | `#F472B6` | hover on light |
| `magenta-500` | `#EC4899` | secondary brand accent |
| `magenta-600` | `#E91E8C` | **PRIMARY** (brand anchor) |
| `magenta-700` | `#C2186F` | primary hover/pressed |
| `magenta-800` | `#9D1458` | primary active, headings on light |
| `magenta-900` | `#6B0E3C` | deep accents |

### Neutral — Slate-warmed gray (text, surfaces, borders)
| Token | Hex | Use |
|---|---|---|
| `neutral-0` | `#FFFFFF` | base surface (light) |
| `neutral-50` | `#F8FAFC` | app background (light) |
| `neutral-100` | `#F1F5F9` | card alt / hover |
| `neutral-200` | `#E2E8F0` | borders / dividers |
| `neutral-300` | `#CBD5E1` | disabled borders |
| `neutral-400` | `#94A3B8` | placeholder text |
| `neutral-500` | `#64748B` | muted text |
| `neutral-600` | `#475569` | secondary text |
| `neutral-700` | `#334155` | body text |
| `neutral-800` | `#1E293B` | headings |
| `neutral-900` | `#0F172A` | strongest text; app bg (dark) |
| `neutral-950` | `#020617` | deepest bg (dark) |

### Semantic hues
| Role | 50 (tint) | 500 (base) | 700 (strong) |
|---|---|---|---|
| Success (green) | `#ECFDF5` | `#10B981` | `#047857` |
| Warning (amber) | `#FFFBEB` | `#F59E0B` | `#B45309` |
| Danger (red) | `#FEF2F2` | `#EF4444` | `#B91C1C` |
| Info (blue) | `#EFF6FF` | `#3B82F6` | `#1D4ED8` |

### Feature accents (used sparingly, mapped from spec)
- **Priority surveys** → magenta (primary). **Quick surveys** → info blue. **Premium surveys** →
  `#7C3AED` (violet 600). **Points/rewards** → success green. These are the only sanctioned accents;
  do not introduce new hues per feature.

## 3. Semantic tokens (what components use)

```css
:root {
  /* surfaces */
  --color-bg:            var(--neutral-50);
  --color-surface:       var(--neutral-0);
  --color-surface-alt:   var(--neutral-100);
  --color-border:        var(--neutral-200);
  --color-border-strong: var(--neutral-300);

  /* text */
  --color-text:          var(--neutral-800);
  --color-text-secondary:var(--neutral-600);
  --color-text-muted:    var(--neutral-500);
  --color-text-inverse:  var(--neutral-0);

  /* brand */
  --color-primary:       var(--magenta-600);
  --color-primary-hover: var(--magenta-700);
  --color-primary-active:var(--magenta-800);
  --color-primary-tint:  var(--magenta-50);
  --color-on-primary:    #ffffff;

  /* semantic */
  --color-success: var(--success-500);
  --color-warning: var(--warning-500);
  --color-danger:  var(--danger-500);
  --color-info:    var(--info-500);

  /* effects */
  --radius-sm: 6px;  --radius-md: 10px;  --radius-lg: 16px;  --radius-full: 9999px;
  --shadow-sm: 0 1px 2px rgba(15,23,42,.06);
  --shadow-md: 0 4px 12px rgba(15,23,42,.08);
  --shadow-lg: 0 12px 32px rgba(15,23,42,.12);
  --focus-ring: 0 0 0 3px rgba(233,30,140,.35);
}

[data-theme="dark"] {
  --color-bg:            var(--neutral-950);
  --color-surface:       var(--neutral-900);
  --color-surface-alt:   var(--neutral-800);
  --color-border:        var(--neutral-800);
  --color-border-strong: var(--neutral-700);
  --color-text:          var(--neutral-100);
  --color-text-secondary:var(--neutral-300);
  --color-text-muted:    var(--neutral-400);
  --color-text-inverse:  var(--neutral-900);
  --color-primary:       var(--magenta-500);   /* slightly lighter for contrast on dark */
  --color-primary-hover: var(--magenta-400);
  --color-primary-tint:  rgba(233,30,140,.12);
}
```

Tailwind (`packages/config/tailwind-preset.ts`) maps these to utilities: `bg-primary`,
`text-secondary`, `border-default`, `ring-focus`, etc. Components never hard-code hex.

## 4. Accessibility rules (enforced)

- Body text on background must meet **WCAG AA** (≥ 4.5:1). `neutral-800` on `neutral-50` and white on
  `magenta-600` both pass.
- Never use magenta-600 for long body text; it's for actions, links, accents, and headings.
- Primary buttons: white text on `magenta-600` (passes AA). Disabled: `magenta-300` bg, `neutral-0` text.
- Focus is always visible via `--focus-ring`; never remove outlines without a replacement.
- Do not rely on color alone to convey meaning (poll results, statuses also use text/icons).

## 5. Usage guidance

- **60/30/10**: ~60% neutral surfaces, ~30% secondary/structure, ~10% magenta accent. The brand pops
  because it's scarce.
- Gradients allowed only for hero/marketing and the spin wheel; UI chrome stays flat.
- Charity/rewards success states use green; never repurpose magenta for "success".
- Charts/poll bars: primary magenta for the user's selection, neutral-300 for others, semantic hues for
  categorical data from a fixed 6-color categorical ramp (define in `packages/ui` `chartColors`).

## 6. Where this lives in code

- Primitives + semantic tokens: `packages/ui/src/styles/tokens.css` (imported once in `apps/web`).
- Tailwind mapping: `packages/config/tailwind-preset.ts` (shared by web app + Storybook).
- Dark mode toggled via `data-theme` on `<html>`; persisted in localStorage + user preference.

See [12-typography.md](12-typography.md) and [13-components-library.md](13-components-library.md) for
how tokens combine into components.
