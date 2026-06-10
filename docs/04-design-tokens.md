# Hisably — Design Token Proposal

Goal: Stripe Dashboard / Linear-level calm and polish. Generous whitespace, strong
type hierarchy, one confident accent color, neutral grays, borders over shadows.

## Accent color — proposal: **Deep Teal**

Teal reads as "money/trust" without the generic-fintech feel of indigo/blue, and
gives good contrast in both light and dark mode. Indigo is the fallback if you'd
rather feel closer to Linear.

| Token | Value | Usage |
|---|---|---|
| `accent-50` | `#F0FDFA` | subtle backgrounds, selected row tint |
| `accent-100` | `#CCFBF1` | hover backgrounds |
| `accent-200` | `#99F6E4` | badges (light) |
| `accent-500` | `#14B8A6` | secondary actions, links |
| `accent-600` | `#0D9488` | **primary buttons, active nav, focus rings** |
| `accent-700` | `#0F766E` | hover/pressed state |
| `accent-900` | `#134E4A` | text-on-accent-light, dark mode accent |

Alt palette (indigo) — swap `accent-*` for Tailwind's `indigo` scale (`#EEF2FF` → `#312E81`) if you prefer that direction. Easy to change later since everything is a token, not hardcoded.

## Neutrals (Tailwind `slate` scale)
| Token | Value | Usage |
|---|---|---|
| `gray-25` | `#FBFCFD` | app background |
| `gray-50` | `#F8FAFC` | card/section background |
| `gray-100` | `#F1F5F9` | hover, subtle borders |
| `gray-200` | `#E2E8F0` | borders, dividers |
| `gray-400` | `#94A3B8` | placeholder text, disabled |
| `gray-500` | `#64748B` | secondary text |
| `gray-700` | `#334155` | body text |
| `gray-900` | `#0F172A` | headings, primary text |

## Semantic colors
| Token | Value | Usage |
|---|---|---|
| `success-500` | `#10B981` | positive deltas, paid badges |
| `success-50` | `#ECFDF5` | success badge background |
| `danger-500` | `#EF4444` | negative deltas, overdue, void |
| `danger-50` | `#FEF2F2` | danger badge background |
| `warning-500` | `#F59E0B` | partially-paid, low-stock |
| `warning-50` | `#FFFBEB` | warning badge background |
| `info-500` | `#3B82F6` | informational badges |

## Typography
| Token | Font | Notes |
|---|---|---|
| `font-sans` (Latin) | **Geist Sans** (fallback Inter) | Vercel-native, pairs cleanly with Next.js; Inter as drop-in if Geist licensing/availability is an issue |
| `font-arabic` | **IBM Plex Sans Arabic** | Strong Arabic readability, good weight range matching Geist/Inter |
| `font-mono` (numbers) | `font-variant-numeric: tabular-nums` applied via utility class `.tabular-nums` on all monetary values, not a separate font |

### Type scale
| Token | Size / Line-height | Weight | Usage |
|---|---|---|---|
| `display` | 32px / 40px | 600 | Dashboard page titles |
| `h1` | 24px / 32px | 600 | Page titles |
| `h2` | 20px / 28px | 600 | Section headers, card titles |
| `h3` | 16px / 24px | 600 | Sub-sections, table headers |
| `body-lg` | 16px / 24px | 400 | Primary content, form inputs |
| `body` | 14px / 20px | 400 | Default UI text, table cells |
| `body-sm` | 13px / 18px | 400 | Helper text, captions |
| `caption` | 12px / 16px | 500 | Badges, labels, timestamps |

## Spacing
4px base unit (Tailwind default): `0, 1(4px), 2(8px), 3(12px), 4(16px), 5(20px), 6(24px), 8(32px), 10(40px), 12(48px), 16(64px), 20(80px), 24(96px)`.
- Page padding: `24px` mobile, `32px` desktop
- Card padding: `20px`–`24px`
- Section gaps: `24px`–`32px`

## Radius
| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 6px | inputs, small buttons, badges |
| `radius-md` | 8px | buttons, dropdown menus |
| `radius-lg` | 12px | cards, modals |
| `radius-xl` | 16px | large feature panels (e.g. dashboard hero cards) |

## Elevation
Borders over shadows. Default card: `1px solid gray-200` + `bg-white` (or `gray-25`).
Reserve shadow for floating elements only:
| Token | Value | Usage |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(15,23,42,0.04)` | dropdowns, popovers |
| `shadow-md` | `0 4px 12px rgba(15,23,42,0.08)` | modals, command palette |

## Charts (Recharts theme)
- Line/area stroke: `accent-600`; previous-period comparison: `gray-400` dashed
- Bar fills: `accent-500` primary series, `gray-300` secondary series
- Grid lines: `gray-100`, axis text: `gray-500` at `caption` size
- Tooltips: white card, `shadow-md`, `radius-md`, AED-formatted with `tabular-nums`
- Donut (aging): `success-500` (current) → `warning-500` (1-30) → `accent-700` (31-60) → `danger-500` (60+)

## Dark mode (structure now, ship later)
Tokens defined as CSS variables (`--color-bg`, `--color-fg`, `--color-accent`, etc.)
in `:root` and overridden under `.dark`. Suggested dark neutrals: background
`#0B1220`, surface `#111827`, border `#1F2937`, text `#E5E7EB`. Accent shifts to
`accent-500` (lighter) for sufficient contrast on dark backgrounds.

## RTL
All spacing/alignment utilities use logical properties from day one:
`ps-*`/`pe-*` (padding-inline-start/end), `ms-*`/`me-*` (margin-inline),
`text-start`/`text-end`, `start-*`/`end-*` for absolute positioning. `dir="rtl"`
toggles at the `<html>` level when Arabic UI ships; icons that imply direction
(arrows, chevrons) get mirrored via a small `flip-rtl` utility class.

## Accessibility
- All interactive elements: visible focus ring `2px accent-600` offset `2px`
- Text contrast ≥ 4.5:1 (gray-700 on white = 9.7:1, gray-500 on white = 4.6:1 — used only for non-critical text)
- Touch targets ≥ 44×44px on mobile (buttons, row actions, bottom tabs)
- Form inputs: persistent labels (not placeholder-only), inline error text below field
