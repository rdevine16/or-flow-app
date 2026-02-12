# CLAUDE.md — ORbit Density Scaling Project

## Project Context

ORbit is a surgical analytics platform with a **Next.js web app** (Tailwind CSS, Supabase, TypeScript) and a **SwiftUI iOS app**. The current UI at 100% browser zoom feels too large/spacious. The goal: make the current 80% zoom appearance become the new 100% zoom default — a denser, more information-rich layout appropriate for enterprise surgical analytics software.

**This is a multi-phase project. Do NOT skip phases or combine them. Commit after each phase.**

---

## Phase 0: Codebase Analysis & Design Token Audit

> **Goal:** Before changing anything, analyze the entire codebase to understand what exists, what's inconsistent, and what needs to become the single source of truth.

### 0a. Map Existing Design Token Sources

Scan for ALL files that define design values (colors, spacing, font sizes, radii, shadows, z-indexes). Known locations to check:

```bash
# Find all potential design token / theme / constant files
grep -rl "spacing\|fontSize\|fontWeight\|radius\|shadow\|zIndex\|colors\|palette" \
  --include="*.ts" --include="*.tsx" --include="*.css" --include="*.swift" \
  lib/ components/ app/ styles/ hooks/ utils/ types/ constants/ config/ \
  2>/dev/null | sort

# Check CSS custom properties
grep -rn "^--" app/globals.css

# Check tailwind config for custom theme extensions
cat tailwind.config.ts

# Check for any existing token/theme files
find . -type f \( -name "*theme*" -o -name "*token*" -o -name "*constants*" -o -name "*design*" \) \
  -not -path "./node_modules/*" -not -path "./.next/*"

# iOS: Check Theme.swift and any constants files
find . -path "*/ORbit*" -name "*.swift" | xargs grep -l "OrbitFont\|OrbitSpacing\|OrbitRadius\|OrbitColors"
```

### 0b. Audit Inline Values

Find hardcoded values that should be tokens but aren't:

```bash
# Find px values in CSS and inline styles (these won't scale with rem)
grep -rn "[0-9]\+px" app/globals.css --include="*.css" | head -50

# Find inline style objects with pixel values
grep -rn "style={{" --include="*.tsx" --include="*.ts" | head -30

# Find hardcoded Tailwind spacing that should use tokens
# Look for inconsistent usage (e.g., p-3 in some places, p-4 in others for same purpose)
grep -rn "className=" --include="*.tsx" | grep -oP '(?:p|m|gap|space)-\d+' | sort | uniq -c | sort -rn | head -30

# Find font-size classes to see what's used
grep -rn "className=" --include="*.tsx" | grep -oP 'text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl)' | sort | uniq -c | sort -rn

# Find hardcoded color values (hex, rgb) that should use Tailwind classes
grep -rn "#[0-9a-fA-F]\{3,6\}" --include="*.tsx" --include="*.ts" | grep -v "node_modules\|\.next" | head -30
```

### 0c. Produce an Audit Report

Before proceeding, output a summary to the terminal:

1. **Token sources found** — list every file that defines design values
2. **Conflicts** — different files defining the same thing differently
3. **Inline violations** — count of hardcoded px values, inline styles, hex colors
4. **Tailwind usage patterns** — which spacing/font/color classes are most used
5. **iOS token alignment** — how `OrbitSpacing`, `OrbitFont`, `OrbitRadius` map (or don't) to web tokens

**Do NOT proceed to Phase 1 until this audit is complete and printed.**

---

## Phase 1: Consolidate Design Tokens (Single Source of Truth)

> **Goal:** Create ONE canonical token file for web and ensure iOS tokens align. All other sources of truth get eliminated or redirected.

### 1a. Web — Create `lib/design-tokens.ts`

This file becomes the single source of truth. It should export typed constants for:

```typescript
// Structure — adapt values based on audit findings
export const tokens = {
  // Spacing scale (used for padding, margin, gap)
  spacing: { ... },
  
  // Font sizes
  fontSize: { ... },
  
  // Font weights
  fontWeight: { ... },
  
  // Line heights
  lineHeight: { ... },
  
  // Border radius
  radius: { ... },
  
  // Shadows
  shadow: { ... },
  
  // Z-index scale
  zIndex: { ... },
  
  // Semantic colors (maps to Tailwind classes, not hex values)
  colors: {
    status: { ... },    // active, inactive, error, warning, success
    role: { ... },      // surgeon, admin, nurse, etc.
    ui: { ... },        // primary, secondary, muted, border, etc.
  },
  
  // Breakpoints
  breakpoints: { ... },
} as const;
```

**Rules:**
- Values should reflect what Tailwind already uses (rem-based)
- Semantic color tokens map to Tailwind class names, not raw hex
- Export type helpers: `type Spacing = keyof typeof tokens.spacing`
- This file does NOT replace Tailwind — it documents the approved subset of Tailwind values that ORbit uses

### 1b. Web — Create/Update `app/globals.css` Custom Properties

CSS custom properties in `:root` should mirror the token file for use in non-Tailwind contexts:

```css
:root {
  /* These must stay in sync with lib/design-tokens.ts */
  --orbit-font-xs: 0.75rem;
  --orbit-font-sm: 0.875rem;
  /* ... etc */
}
```

### 1c. Web — Reconcile `tailwind.config.ts`

Extend Tailwind theme with ORbit-specific semantic tokens where it makes sense:

```typescript
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      orbit: { /* import from tokens or define inline */ }
    }
  }
}
```

### 1d. iOS — Update `Theme.swift`

Ensure `OrbitSpacing`, `OrbitFont`, and `OrbitRadius` values are aligned with web tokens at the 0.8x scale (since iOS is being scaled separately).

### 1e. Remove Duplicate Sources

Delete or redirect any other files that were defining spacing, colors, typography, etc. independently. Replace their exports with re-exports from `lib/design-tokens.ts`.

**Commit: `chore: consolidate design tokens into single source of truth`**

---

## Phase 2: Web — Root Font Size Scaling

> **Goal:** Make the 80% zoom view the new 100% baseline by scaling the root font size.

### 2a. Set Root Font Size

In `app/globals.css`:

```css
html {
  font-size: 80%; /* 12.8px — scales all rem-based values to 80% */
}
```

This single line will proportionally shrink ALL Tailwind rem-based utilities: text sizes, padding, margins, gaps, widths, heights.

### 2b. Identify What Won't Scale

Run this audit after setting root font-size:

```bash
# Find px values in globals.css that won't scale
grep -n "px" app/globals.css | grep -v "border\|outline\|shadow\|--" | head -30

# Find px in component styles
grep -rn "px" --include="*.css" --include="*.module.css" | grep -v node_modules | head -30

# Find inline style pixel values in React components
grep -rn "style=" --include="*.tsx" | grep -oP "'?\d+px'?" | sort | uniq -c | sort -rn

# Find fixed-width/height Tailwind classes that use arbitrary values
grep -rn "\[.*px\]" --include="*.tsx" | head -30

# Find viewport-relative units that won't scale
grep -rn "vh\|vw\|dvh\|svh" --include="*.css" --include="*.tsx" | grep -v node_modules | head -20
```

### 2c. Convert px → rem Where Needed

For CSS values that should scale but are in px:
- Divide the px value by 16 (original base), multiply by 1rem
- Example: `48px` → `3rem` (which at 80% root = 38.4px visual)

**Do NOT convert these to rem (keep as px):**
- `1px` borders
- Box shadows
- Outline widths
- Scrollbar widths

### 2d. Fix Viewport Units

Elements using `100vh` for full-height layouts may need adjustment. Check:
- Sidebar height
- Modal overlays
- Full-page containers
- Login page

These should generally remain `vh`-based (they're relative to viewport, not font).

### 2e. Fix Third-Party Component Sizing

Check for third-party libraries that may render at their own scale:
- Tremor charts (used for analytics)
- Any icon libraries
- Date pickers or other form widgets

**Commit: `feat: apply 80% root font-size for denser UI baseline`**

---

## Phase 3: Web — Visual Audit & Component Fixes

> **Goal:** Page-by-page review of the most-used views to fix anything that looks wrong after the root font change.

### Priority pages to check (in order):

1. **Case Detail Page** — most-used page, complex layout
2. **Dashboard / Home** — first thing users see
3. **Scorecards / Analytics** — data-dense, charts
4. **Cases List** — table layouts
5. **Settings pages** — form layouts
6. **Admin pages** — table + form combos
7. **Login page** — standalone layout

### For each page, check:
- [ ] Text is readable (not too small at common screen sizes)
- [ ] Spacing feels balanced (not too cramped)
- [ ] Tables have adequate row height for touch/click targets
- [ ] Icons are proportional to adjacent text
- [ ] Modals and dropdowns are properly sized
- [ ] Charts (Tremor) render correctly
- [ ] Cards don't feel too compressed
- [ ] Empty states look intentional, not broken

### Minimum touch/click target rule:
Even at the new density, interactive elements must be at minimum **32px visual height** (which is `2.5rem` at the new 12.8px base). Check buttons, table rows, dropdown items, tabs.

**Commit per page group: `fix: adjust [page-name] layout for new density baseline`**

---

## Phase 4: iOS — Proportional Scaling

> **Goal:** Apply the same density philosophy to the SwiftUI app.

### 4a. Scale `Theme.swift` Values

`OrbitSpacing`, `OrbitFont`, and `OrbitRadius` in `Theme.swift` should be multiplied by 0.8:

```swift
// BEFORE
struct OrbitSpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    // ...
}

// AFTER (multiply by 0.8, round to nearest 0.5)
struct OrbitSpacing {
    static let xs: CGFloat = 3
    static let sm: CGFloat = 6.5
    static let md: CGFloat = 10
    // ...
}
```

**Use your judgment on rounding** — iOS renders at fractional points cleanly, but whole/half values are cleaner.

### 4b. Scale Font Sizes

```swift
// BEFORE
struct OrbitFont {
    static let caption: CGFloat = 12
    static let body: CGFloat = 16
    static let title: CGFloat = 20
    // ...
}

// AFTER (0.8x)
struct OrbitFont {
    static let caption: CGFloat = 10
    static let body: CGFloat = 13
    static let title: CGFloat = 16
    // ...
}
```

### 4c. Audit Every View

After changing Theme.swift, run through every view:
- `CasesView`
- `RoomsView`
- `CaseDetailView` (1,587 lines — most complex)
- `SurgeonHomeView`
- `ProfileView`
- `NotificationsView`
- Login/splash screens

Check for any hardcoded values that bypass Theme.swift:
```bash
grep -rn "\.font(.system(size:" --include="*.swift" | grep -v "OrbitFont"
grep -rn "\.padding(" --include="*.swift" | grep -v "OrbitSpacing"
grep -rn "\.frame(" --include="*.swift" | grep -v "OrbitSpacing"
```

### 4d. Minimum Touch Target Rule (iOS)

Apple HIG minimum: **44pt tap targets**. After scaling, verify all buttons, list rows, and interactive elements still meet this. At 0.8x scale, you need to ensure your pre-scale targets were at least 55pt.

**Commit: `feat: apply density scaling to iOS Theme.swift`**

---

## Phase 5: Cross-Platform Token Sync Documentation

> **Goal:** Ensure future developers know the system.

Create or update `docs/DESIGN_TOKENS.md`:

- Canonical source: `lib/design-tokens.ts` (web) and `Theme.swift` (iOS)
- Relationship: iOS values = web values × 0.8 (applied directly, not via root scaling)
- Web scaling mechanism: `html { font-size: 80% }` in `globals.css`
- Rules for adding new tokens
- Rules for when px is acceptable (borders, shadows)
- Link to Tailwind config showing extended theme values

**Commit: `docs: add design token documentation and cross-platform sync guide`**

---

## Session Management Rules

### Token Budget
- **At 70% token utilization, STOP working on new tasks.** Do not start a new phase, a new page audit, or a new file migration if you are at or above 70% context usage.
- Instead, use the remaining 30% to:
  1. **Commit** all current work with a descriptive message
  2. **Print a handoff summary** that includes:
     - What was completed in this session
     - What phase/step to resume at
     - Any files that were partially modified
     - Any issues discovered but not yet fixed
     - The exact git branch and last commit hash
  3. **List the next 3-5 concrete actions** the next session should take

### Why This Matters
Claude Code sessions that push past 70% context start losing track of earlier instructions, file contents, and audit results. The handoff summary ensures the next session can pick up cleanly without re-auditing or duplicating work.

### Between Sessions
- Always start a new session by reading this CLAUDE.md
- Check `git log --oneline -5` to see where the last session left off
- If a handoff summary was saved (e.g., `HANDOFF.md` in project root), read it before doing anything else

---

## Important Constraints

### Do NOT:
- Use CSS `zoom` property (inconsistent cross-browser, breaks layout calculations)
- Use CSS `transform: scale(0.8)` (breaks overflow, positioning, and event coordinates)
- Change Tailwind's base `rem` config — change the root font-size instead
- Remove or modify Tremor chart CSS without testing — charts have their own size logic
- Go below 12px visual equivalent for body text (accessibility minimum)
- Break the Supabase auth flow or any API integrations (they don't care about UI density)

### Do:
- Commit after every phase
- Print audit results before making changes
- Test at 1440px, 1920px, and 2560px viewport widths
- Test Chrome, Safari, Firefox
- Verify both light and dark mode if applicable
- Keep the git diff reviewable — don't rewrite files that only need one-line changes

---

## File Reference

### Web — Key Files

| File | Role |
|------|------|
| `app/globals.css` | Root CSS, custom properties, Tailwind v4 imports, Tremor config |
| `tailwind.config.ts` | Tailwind theme extensions |
| `lib/design-tokens.ts` | **NEW** — Single source of truth for design values |
| `components/ui/` | Shared UI components (Badge, Button, Loading, StatusBadge, etc.) |
| `components/layouts/DashboardLayout.tsx` | Main app shell — sidebar + header + content |
| `components/layouts/Container.tsx` | Content wrapper |
| `app/layout.tsx` | Root layout (does NOT wrap in DashboardLayout — each page wraps itself) |

### iOS — Key Files

| File | Role |
|------|------|
| `Theme.swift` | `OrbitSpacing`, `OrbitFont`, `OrbitRadius` — iOS design tokens |
| `ContentView.swift` | Root view with tab routing |
| `CaseDetailView.swift` | Most complex view (1,587 lines, 20+ @State vars) |
| `AuthManager.swift` | Auth state management |

### App Route Structure (Web)

Pages wrap themselves in `<DashboardLayout>` individually — there is no route-group layout that does this automatically. Keep this in mind when auditing pages.

---

## Success Criteria

When this project is complete:

1. At 100% browser zoom, the web app looks like it currently does at 80% zoom
2. All design values trace back to `lib/design-tokens.ts` or `Theme.swift`
3. No duplicate or conflicting token definitions across the codebase
4. All interactive elements meet minimum click/tap target sizes
5. Tremor charts and third-party components render correctly
6. iOS app has the same proportional density increase
7. A developer can look at `docs/DESIGN_TOKENS.md` and understand the system
