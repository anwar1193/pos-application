---
name: Etalase Back-Office
colors:
  surface: '#FFFFFF'
  surface-dim: '#ceded4'
  surface-bright: '#eefdf3'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#e8f7ed'
  surface-container: '#e2f2e8'
  surface-container-high: '#dcece2'
  surface-container-highest: '#d7e6dc'
  on-surface: '#111e18'
  on-surface-variant: '#404943'
  inverse-surface: '#26332d'
  inverse-on-surface: '#e5f4ea'
  outline: '#707973'
  outline-variant: '#c0c9c2'
  surface-tint: '#2f6950'
  primary: '#003a27'
  on-primary: '#ffffff'
  primary-container: '#14523b'
  on-primary-container: '#88c4a6'
  inverse-primary: '#97d3b5'
  secondary: '#58605b'
  on-secondary: '#ffffff'
  secondary-container: '#dce5de'
  on-secondary-container: '#5e6661'
  tertiary: '#27352e'
  on-tertiary: '#ffffff'
  tertiary-container: '#3d4b44'
  on-tertiary-container: '#acbbb1'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b2f0d0'
  primary-fixed-dim: '#97d3b5'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#12503a'
  secondary-fixed: '#dce5de'
  secondary-fixed-dim: '#c0c9c2'
  on-secondary-fixed: '#151d19'
  on-secondary-fixed-variant: '#404944'
  tertiary-fixed: '#d7e6dc'
  tertiary-fixed-dim: '#bbcac0'
  on-tertiary-fixed: '#111e18'
  on-tertiary-fixed-variant: '#3c4a42'
  background: '#eefdf3'
  on-background: '#111e18'
  surface-variant: '#d7e6dc'
  paper: '#F6F7F2'
  surface-muted: '#EEF2ED'
  border: '#DCE4DD'
  border-strong: '#C5D2C8'
  forest-hover: '#0E3F2D'
  text-muted: '#6E7B73'
  warning-amber: '#B45309'
  warning-amber-bg: '#FEF3C7'
  error-brick: '#B42318'
  error-brick-bg: '#FEE4E2'
  success: '#067647'
  success-bg: '#DCFAE6'
  focus-dark: '#FDE68A'
typography:
  display:
    fontFamily: Archivo Narrow
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 44px
  display-mobile:
    fontFamily: Archivo Narrow
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 36px
  stat-value:
    fontFamily: Archivo Narrow
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.01em
  stat-value-mobile:
    fontFamily: Archivo Narrow
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  h1:
    fontFamily: Archivo Narrow
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 36px
  h2:
    fontFamily: Archivo Narrow
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  h3:
    fontFamily: Archivo Narrow
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body:
    fontFamily: Archivo Narrow
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-compact:
    fontFamily: Archivo Narrow
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label:
    fontFamily: Archivo Narrow
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  caption:
    fontFamily: Archivo Narrow
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  wordmark:
    fontFamily: Archivo Narrow
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  margin-laptop: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 2.5rem
  space-3xl: 4rem
---

## Brand & Style

This design system embodies the utilitarian calm of an Indonesian physical store's operational core: the disciplined clarity of a paper ledger (*buku kas*), store price signage (*papan harga*), and tactile receipt slips. It deliberately rejects generic tech startup aesthetics—dispensing with soft floating drop-shadows, hyper-saturated indigo accents, and decorative illustrations—in favor of functional density, high scannability, and institutional trust.

The visual style is **Tactile Minimalism**: a strictly structured, flat architecture built upon a quiet paper canvas (`#F6F7F2`), crisp white ledger panels, dark ink typography, and forest green accents. Signature physical retail cues—such as a 3px spine indicator on active ledger tabs and a subtle micro-perforated receipt edge on login dividing screens—anchor the digital tool in familiar physical merchant operations.

The user experience evokes precision, composed control, and steady reliability during heavy operational shifts.

## Colors

The palette balances organic forest tones with physical ledger substrates. High-saturation colors are strictly reserved for operational feedback, ensuring operators maintain sustained focus without interface fatigue.

- **Canvas & Surfaces**: The base canvas is `paper` (`#F6F7F2`), paired with clean `surface` (`#FFFFFF`) containers and `surface-muted` (`#EEF2ED`) for table headers and inactive tracks. Containers are divided using a structural 1px hairline `border` (`#DCE4DD`).
- **Brand & Action**: Deep `forest` (`#14523B`) anchors primary buttons, active states, and dark brand panels, shifting to `forest-hover` (`#0E3F2D`) on interaction. Soft `moss` (`#E4EDE6`) provides low-contrast tinting for active indicators, bar tracks, and neutral tags.
- **Typography Tiers**: Primary reading copy is set in high-contrast `ink` (`#13201A`), supported by `text-secondary` (`#4C5A52`) for field labels and column headers, and `text-muted` (`#6E7B73`) for timestamps and auxiliary hints.
- **Status Semantics**: Alerts and system states utilize dedicated paired tokens: `warning-amber` (`#B45309` / `#FEF3C7`) for pending or throttled tasks, `error-brick` (`#B42318` / `#FEE4E2`) for validation blocks and suspensions, and `success` (`#067647` / `#DCFAE6`) for completed settlements and active accounts.
- **Focus Indicators**: Light surfaces utilize a crisp 3px amber ring (`rgba(180, 83, 9, 0.35)`), while dark surfaces use `focus-dark` (`#FDE68A`).

## Typography

The typography uses Archivo Narrow across all typographic tiers to evoke dense, space-efficient accounting ledgers and till receipts.

- **Tabular Numerals**: Every numeric value—including stat metrics, invoice totals, sku quantities, and price fields—must enforce `font-variant-numeric: tabular-nums` to guarantee strict vertical column alignment across rows and updates.
- **Editorial Density**: Headings use a condensed, structural weight (`600`) to anchor ledger panes. Body copy is capped at a maximum of 70 characters per line to maintain ergonomic scannability during sustained desktop back-office sessions.
- **Mobile Adaptations**: Hero display headings and large statistical values step down from 40px on viewports ≥1280px to 32px on screens under 1024px to prevent horizontal clipping.

## Layout & Spacing

The layout is built on a structured **12-column fluid grid** constrained to a maximum width of `1360px`, framed by a fixed persistent sidebar and topbar structure:

- **Sidebar Architecture**: Fixed at `248px` on standard desktop (≥1280px), compressing to `220px` on compact screens (1024–1279px), collapsible to a `72px` utility mode, and transitioning into an off-canvas drawer on screens below `1024px`.
- **Vertical Rhythm**: Top navigation maintains a rigid `64px` height with a 1px baseline border. Standard content margins adapt from `32px` (desktop) to `24px` (laptop) and `16px` (mobile).
- **Consolidated Ledger Paneling**: Instead of scattering cards across the canvas ("card soup"), metrics and modules are grouped inside continuous full-width ledger panels. Multi-metric strips segment individual stats with vertical 1px hairline dividers on desktop that transform into horizontal dividers on mobile screens.
- **Base Rhythm Scale**: Spacing strictly derives from a 4px/8px modular cadence (`space-xs` = 4px, `space-sm` = 8px, `space-md` = 16px, `space-lg` = 24px, `space-xl` = 32px).

## Elevation & Depth

This design system avoids decorative depth, relying on high-contrast surface placement and architectural lines:

- **Zero-Shadow Paneling**: Content cards, stat modules, table containers, and text fields feature zero box-shadow (`box-shadow: none`). Depth is communicated purely through tonal contrast—pure white containers resting on the `#F6F7F2` paper canvas, bounded by `#DCE4DD` borders.
- **Layered Overlays**: Drop shadows are exclusively restricted to transient floating elements (modals, dropdown popovers, and toast notifications) using an ambient ink tone:
  `box-shadow: 0 12px 32px rgba(19, 32, 26, 0.14);`
- **Linear Dividers**: Structure is created through `1px solid #DCE4DD` hairlines. When enhanced demarcation is required, `#C5D2C8` is used.
- **Spine & Perforation Accents**:
  - *Active Spine*: Active sidebar navigation tabs feature a flush `3px solid #E4EDE6` accent spine placed along the edge to signal selection without heavy background fills.
  - *Receipt Perforation Motif*: The split-screen login partition uses a 12px vertical perforation boundary containing repeated semi-circular notches to invoke physical till receipts.

## Shapes

The system uses an intentional two-tier border radius rule that balances modern digital precision with industrial stationery:

- **Components & Controls (`8px`)**: Buttons, text inputs, search fields, segmented controls, and table row selections use an 8px radius (`--radius-input`), offering an approachable touch and click area without looking bubbly.
- **Panels & Overlays (`12px`)**: Main content panels, ledger containers, modals, and sheets use a 12px radius (`--radius-panel`), framing large data sets cleanly.
- **Pills & Identifiers (`9999px`)**: Status badges, role tags, and avatar frames use full-pill encapsulation (`rounded-full`) to immediately distinguish metadata chips from rectangular data input controls.

## Components

### Buttons
- **Primary**: Solid `#14523B` fill, `#FFFFFF` text, 8px radius, height `40px` (desktop) / `48px` (mobile). Hover state transitions to `#0E3F2D` in 120ms. Active state applies a subtle 1px internal inset.
- **Secondary / Outline**: Background `#FFFFFF`, border `1px solid #DCE4DD`, text `#13201A`. Hover transitions to background `#EEF2ED`.
- **Destructive**: Background `#B42318`, text `#FFFFFF`. Hover transitions to `#911E14`. Focus applies amber focus ring.
- **No Drop Shadows**: All button variants maintain `box-shadow: none`.

### Input Fields & Controls
- **Text Inputs**: Height `40px` (desktop) / `48px` (mobile), 8px radius, border `1px solid #DCE4DD`, background `#FFFFFF`, text `13px` Archivo Narrow (`#13201A`). Placeholder text set in `#6E7B73`.
- **Focus State**: `border-color: #B45309; outline: 3px solid rgba(180, 83, 9, 0.35);`.
- **Error State**: `border-color: #B42318; outline: 3px solid rgba(180, 35, 24, 0.25);`.
- **Checkboxes & Radios**: 8px radius on checkboxes (18x18px), circular on radios. Checked fill `#14523B` with crisp white checkmark/dot.

### Status Badges & Chips
- **Geometry**: Height `24px`, padding `0 10px`, pill-shaped (`9999px`). Typographic styling: 12px Archivo Narrow, weight 500, tabular numbers.
- **Semantic Color Pairs**:
  - *Active / Success*: Fill `#DCFAE6`, text `#067647`.
  - *Pending / Caution*: Fill `#FEF3C7`, text `#B45309`.
  - *Suspended / Error*: Fill `#FEE4E2`, text `#B42318`.
  - *Neutral / Role Tag*: Fill `#E4EDE6`, text `#13201A`.

### Panels & Stat Tiles
- **Multi-Metric Ledger Strip**: Contained within a single `#FFFFFF` surface with a 12px radius and 1px `#DCE4DD` border. Individual statistics are divided internally by 1px vertical divider lines.
- **Tile Elements**: Label text at 13px (`#4C5A52`), large metric value at 40px tabular numbers (`#13201A`), and secondary caption/differential at 12px (`#6E7B73`).

### Tables & Activity Feeds
- **Header Rows**: Height `36px`, background `#EEF2ED`, text `12px` Archivo Narrow, uppercase, letter-spacing `0.04em`, color `#4C5A52`.
- **Data Rows**: Height `48px`, background `#FFFFFF`, bottom border `1px solid #DCE4DD`. Cells right-align currency and quantities using tabular numerals.
- **Hover State**: Subtle background shift to `#F6F7F2` with instant transition.