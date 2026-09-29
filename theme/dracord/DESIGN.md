---
name: Dracula Discord
colors:
  surface: '#11131e'
  surface-dim: '#11131e'
  surface-bright: '#373845'
  surface-container-lowest: '#0b0e18'
  surface-container-low: '#191b26'
  surface-container: '#1d1f2b'
  surface-container-high: '#272935'
  surface-container-highest: '#323440'
  on-surface: '#e1e1f1'
  on-surface-variant: '#ccc3d3'
  inverse-surface: '#e1e1f1'
  inverse-on-surface: '#2e303c'
  outline: '#968e9c'
  outline-variant: '#4a4451'
  surface-tint: '#d7baff'
  primary: '#d7baff'
  on-primary: '#411478'
  primary-container: '#bd93f9'
  on-primary-container: '#4e2484'
  inverse-primary: '#714aaa'
  secondary: '#b5c5fc'
  on-secondary: '#1d2e5c'
  secondary-container: '#374776'
  on-secondary-container: '#a7b7ed'
  tertiary: '#ffafd7'
  on-tertiary: '#620044'
  tertiary-container: '#fe78c5'
  on-tertiary-container: '#770054'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#eddcff'
  primary-fixed-dim: '#d7baff'
  on-primary-fixed: '#290055'
  on-primary-fixed-variant: '#593090'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b5c5fc'
  on-secondary-fixed: '#041846'
  on-secondary-fixed-variant: '#354574'
  tertiary-fixed: '#ffd8e9'
  tertiary-fixed-dim: '#ffafd7'
  on-tertiary-fixed: '#3c0029'
  on-tertiary-fixed-variant: '#860f60'
  background: '#11131e'
  on-background: '#e1e1f1'
  surface-variant: '#323440'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: '700'
    lineHeight: 1.875rem
  headline-lg:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.625rem
  headline-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '600'
    lineHeight: 1.375rem
  body-lg:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
  body-md:
    fontFamily: Inter
    fontSize: 0.9375rem
    fontWeight: '400'
    lineHeight: 1.375rem
  body-sm:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.125rem
  label-md:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '700'
    lineHeight: 1rem
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Inter
    fontSize: 0.6875rem
    fontWeight: '600'
    lineHeight: 0.875rem
    letterSpacing: 0.02em
  code-inline:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.25rem
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 0rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system synthesizes the utilitarian ergonomics of modern desktop chat applications with the refined, high-contrast palette of the Dracula theme. Tailored for software engineers, digital creators, and gaming communities, the aesthetic emphasizes deep, distraction-free workspaces illuminated by saturated, deliberate accents.

The design movement combines technical minimalism with tactile, functional paneling:
- **Tone:** Focused, atmospheric, engineered, and precise.
- **Ergonomics:** Multi-column split architecture, explicit spatial partitioning, and high-density information display.
- **Visual Impact:** Subdued, low-luminance canvas planes that recede into the periphery, allowing syntactical color highlights (`#bd93f9` Dracula Purple, `#50fa7b` Green, `#ff5555` Red) to guide immediate attention to unread states, active speakers, notifications, and code segments.

## Colors

The color palette establishes an unmistakable hierarchy through nuanced dark surfaces layered beneath bright synthetic accents:

- **Primary Accent (`#bd93f9`):** Replaces default interaction hues. Used for active navigation pills, primary action buttons, selected channel text, mention badges, and link focus states.
- **Secondary (`#6272a4`):** The Dracula comment tone; acts as the primary muted text color, subtle separators, inactive channel icons, and unfocused borders.
- **Tertiary Accent (`#ff79c6`):** Reserved for special highlights, user badges, nitro/booster identifiers, and pinned message callouts.
- **Base & Canvas Surfaces:**
  - *Server Rail / Window Frame:* `#1e1f29` (darkest anchoring foundation).
  - *Main Message Feed & Chat Stream:* `#21222c` (deep reading canvas).
  - *Sidebar & Channel Tree:* `#282a36` (the core Dracula background surface).
  - *Elevated Cards, Active Hover, Input Fields:* `#44475a` (interactive surface tier).
- **Foreground / Typography:**
  - *Primary Text:* `#f8f8f2` (high-readability soft white).
  - *Secondary / Timestamp Text:* `#6272a4` (receding utility tone).
- **Functional & Status Semantics:**
  - *Online / Success:* `#50fa7b`
  - *Idle / Pending:* `#ffb86c`
  - *Do Not Disturb / Danger / Muted:* `#ff5555`
  - *Voice Connected / Cyan Accent:* `#8be9fd`

## Typography

The type scale relies on Inter to guarantee neutral, rapid legibility across varying text densities:

- **Category Headers & Overlines (`label-md`):** Set in uppercase with expanded tracking (`0.04em`) to establish crisp section dividing lines without requiring heavy graphic rules.
- **Message Content (`body-md`):** Scaled to `0.9375rem` (15px) with a `1.375rem` line height, balancing information density with scannability during fast-scrolling message streams.
- **Names & Channel Headers (`headline-md`, `headline-lg`):** Weighted at semi-bold (600) to stand out cleanly against dark surfaces.
- **Code & Syntax Blocks:** When rendering code payloads within chat, use standard monospaced pairings (such as JetBrains Mono or Fira Code) at `0.875rem` embedded within `#1e1f29` container blocks.

## Layout & Spacing

The layout model is a fixed-pane multi-column structure tailored for desktop communication:

- **Desktop Panes:**
  - *Guild/Server Strip:* Fixed 72px width, full viewport height (`#1e1f29`).
  - *Navigation/Channel Sidebar:* Fixed 240px width (`#282a36`).
  - *Main Message Canvas:* Fluid flex-1 width (`#21222c`).
  - *Member List / Activity Sidebar:* Collapsible 240px width (`#282a36`).
- **Responsive Adaptations:**
  - *Tablet (<1024px):* The right member panel collapses into an overlay drawer. The channel sidebar remains toggleable or docks to an icon rail.
  - *Mobile (<768px):* Single active view. The channel sidebar and server navigation become an off-canvas drawer; chat takes 100% viewport width.
- **Spacing Rhythm:**
  - Standard list item padding: `space-sm` vertical, `space-md` horizontal.
  - Message stream gaps: `space-xs` between consecutive lines by the same author; `space-lg` between distinct message blocks.
  - Outer margin is set to `0rem` to facilitate native edge-to-edge frame dockings.

## Elevation & Depth

Visual depth is achieved through structural color zoning rather than drop shadows:

- **Surface Tiers:**
  - *Tier 0 (Deepest, Canvas):* `#1e1f29` - Guild rail, status bar, and code block insets.
  - *Tier 1 (Base Viewports):* `#21222c` - Message stream and primary activity screens.
  - *Tier 2 (Secondary Viewports):* `#282a36` - Channel navigation lists, user profile footers, and member sidebars.
  - *Tier 3 (Floating & Raised Elements):* `#44475a` - Message hover states, input fields, popovers, and context menus.
- **Shadow Profile:**
  - Floating panels, autocomplete menus, and modals employ low-spread ambient shadows: `0 8px 24px rgba(0, 0, 0, 0.45)`.
  - Channel list headers and top bars cast a subtle bottom shadow: `0 1px 2px rgba(0, 0, 0, 0.20)`.

## Shapes

The system uses `roundedness: 2` (0.5rem base radius) to deliver a modern, ergonomic feel:

- **Interactive Nodes:** Channel rows, list items, and standard action buttons use `rounded` (0.5rem / 8px).
- **Server Icons:** Dynamic state transformation: circular (`rounded-full`) in default state, transitioning smoothly to `rounded-lg` (1rem / 16px) upon hover and active selection.
- **Avatars & Status Dots:** Avatars are rendered circular, with status rings anchored to the bottom-right quadrant clipped with a 2px boundary matching the parent background.
- **Tooltips & Badges:** Use `rounded` (0.375rem to 0.5rem) with crisp geometry.

## Components

### Buttons
- **Primary:** Filled with `#bd93f9` (Dracula Purple) with `#1e1f29` text. Hover transitions to `#caa6fa`.
- **Secondary:** Filled with `#44475a` with `#f8f8f2` text. Hover transitions to `#6272a4`.
- **Destructive:** Background `#ff5555` with `#f8f8f2` text.
- **Ghost:** Transparent background with `#f8f8f2` text; `#44475a` background on hover.

### Inputs & Chat Bar
- **Chat Input Area:** Contained in a rounded (0.5rem) block of `#44475a`, text in `#f8f8f2`, placeholder in `#6272a4`. Inline action icons (emoji, attachments, gifts) tinted `#6272a4` shift to `#bd93f9` on hover.
- **Search Fields:** Compact height (32px), surface `#1e1f29`, inset text padding, subtle placeholder `#6272a4`.

### Channel Lists & Tree Rows
- **Idle State:** Background transparent, text `#6272a4`, leading hash `#` or speaker icon muted.
- **Hover State:** Background `#44475a` at 40% opacity, text `#f8f8f2`.
- **Active / Selected State:** Background `#44475a`, text `#f8f8f2`, leading indicator pill `#bd93f9` rendered at the left viewport edge.
- **Unread Indicator:** 4px white/accent vertical bar on the extreme left gutter.

### Mentions & Badges
- **Mention In Text:** Inline span with `#bd93f9` text on a semi-transparent `rgba(189, 147, 249, 0.15)` background with 4px border radius. Hover raises opacity to 25%.
- **Unread Badge:** Solid `#ff5555` pill, bold white text (`label-sm`).

### Cards & Embeds
- **Message Embeds:** `#282a36` background with a solid 4px left-border colored dynamically (defaults to `#bd93f9`, or custom role/webhook colors). Nested media uses 0.5rem rounded corners.
- **User Popout Card:** Outer frame `#1e1f29`, header banner fill `#bd93f9` or `#44475a`, body `#282a36` with inner profile details partitioned by `#44475a` dividers.