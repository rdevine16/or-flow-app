# Tailwind Pattern Duplication — ORbit Codebase Audit (Report 04 of 08)

## Summary

Analyzed **13,297 className occurrences** across all `.tsx` files in `components/` and `app/` directories. Found significant duplication in badge/pill patterns (124+), icon containers (233+), info boxes (55+), and typography combinations (400+). Single-utility classes (e.g., `flex-1`, `shadow-sm`) are excluded — this report focuses on **multi-class combinations** that indicate missing components or utility classes.

### Action Categories

| Category | Recommendation | Occurrences |
|----------|---------------|-------------|
| Extract as component | New shared component needed | 412+ |
| Create utility class | `@apply` class in globals.css | 273+ |
| Adopt existing component | Component exists but isn't used | 200+ est. |
| Keep as-is | Contextual, no extraction value | Remaining |

---

## :red_circle: CRITICAL — Extract as Component

### 1. Badge/Pill Pattern (124+ occurrences)

**Pattern:**
```tsx
className="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 bg-{color}-50 text-{color}-700"
```

**Variations found:**
```tsx
// Green status
"inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 bg-green-50 text-green-700"

// Orange warning
"inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 bg-orange-50 text-orange-700"

// Blue info
"inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700"

// Red error
"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700"
```

**Top files:**
- `components/analytics/AnalyticsComponents.tsx` — 12 inline badges
- `components/integrations/ReviewDetailPanel.tsx` — 8 inline badges
- `components/cases/CaseFlagsSection.tsx` — 6 inline badges
- `app/analytics/surgeons/PageClient.tsx` — 5 inline badges
- `app/analytics/block-utilization/PageClient.tsx` — 5 inline badges

**Note:** `components/ui/Badge.tsx` already exists with `badgeVariants` but many files use inline class strings instead.

**Recommendation:** Refactor all inline badge patterns to use the existing `<Badge>` component. Add any missing color variants to `Badge.tsx`.

---

### 2. Icon Container Pattern (233+ occurrences)

**Pattern:**
```tsx
className="w-{size} h-{size} rounded-{radius} flex items-center justify-center bg-{color}-50 text-{color}-600"
```

**Variations found:**
```tsx
// Small icon (32px)
"w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600"

// Medium icon (40px)
"w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center"

// Large icon (48px)
"w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-600"

// Circular
"w-5 h-5 rounded-full bg-red-100 text-red-600"
```

**Top files:**
- `components/analytics/AnalyticsComponents.tsx` — 15 instances
- `components/settings/milestones/TemplateBuilder.tsx` — 10 instances
- `components/cases/CaseForm.tsx` — 8 instances
- `app/analytics/PageClient.tsx` — 7 instances
- `components/dashboard/EnhancedRoomCard.tsx` — 6 instances

**Recommendation:** Extract `<IconContainer>` component:
```typescript
interface IconContainerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg'   // 20, 32, 40, 48px
  variant?: 'blue' | 'green' | 'red' | 'amber' | 'slate'
  rounded?: 'md' | 'lg' | 'xl' | 'full'
  children: React.ReactNode
}

// Usage
<IconContainer size="md" variant="blue">
  <Clock className="w-5 h-5" />
</IconContainer>
```

---

### 3. Info/Alert Box Pattern (55+ occurrences)

**Pattern:**
```tsx
className="p-4 bg-{color}-50 border border-{color}-200 rounded-lg"
```

**Variations found:**
```tsx
// Info
"p-4 bg-blue-50 border border-blue-200 rounded-lg"

// Warning
"p-4 bg-amber-50 border border-amber-200 rounded-xl"

// Error
"p-4 bg-red-50 border border-red-200 rounded-xl text-red-600"

// Neutral
"p-4 bg-slate-50 border border-slate-200 rounded-lg"
```

**Top files:**
- `components/integrations/IntegrationOverviewTab.tsx` — 4 instances
- `app/admin/settings/hl7v2-test-harness/PageClient.tsx` — 4 instances
- `components/settings/milestones/TemplateBuilder.tsx` — 3 instances
- `components/cases/CaseForm.tsx` — 3 instances

**Note:** `components/ui/Alert.tsx` exists but many files use inline patterns.

**Recommendation:** Refactor to use existing `<Alert>` component. Add `variant` prop if not already present.

---

## :yellow_circle: HIGH — Create Utility Classes

### 4. Uppercase Label Pattern (422+ occurrences)

**Pattern:**
```tsx
className="text-xs font-medium text-slate-400 uppercase tracking-wide"
```

**Common variations:**
```tsx
"text-xs font-medium text-slate-400 uppercase tracking-wide"     // Most common
"text-[10px] font-semibold uppercase tracking-wide text-slate-500" // Smaller variant
"text-xs font-semibold uppercase tracking-wider text-slate-400"    // Wider tracking
```

**Top files (by occurrence count):**
| File | Count |
|------|-------|
| `app/analytics/block-utilization/PageClient.tsx` | 16 |
| `app/spd/PageClient.tsx` | 15 |
| `components/analytics/financials/ProcedureDetail.tsx` | 12 |
| `components/cases/ImplantSection.tsx` | 10 |
| `components/cases/CaseDrawerFinancials.tsx` | 10 |
| `components/analytics/financials/SurgeonDetail.tsx` | 9 |
| `components/analytics/financials/OverviewTab.tsx` | 8 |

**Recommendation:** Add utility class to `globals.css`:
```css
.label-uppercase {
  @apply text-xs font-medium text-slate-500 uppercase tracking-wide;
}
```

---

### 5. Section Heading Pattern (72+ occurrences)

**Pattern:**
```tsx
className="text-lg font-semibold text-slate-900"
```

**Top files:**
| File | Count |
|------|-------|
| `app/admin/settings/hl7v2-test-harness/PageClient.tsx` | 5 |
| `app/settings/checkin/PageClient.tsx` | 4 |
| `app/profile/PageClient.tsx` | 4 |
| `app/checkin/PageClient.tsx` | 4 |

**Recommendation:** Add utility class:
```css
.heading-section {
  @apply text-lg font-semibold text-slate-900;
}
```

---

### 6. Metric Value Pattern (60+ occurrences)

**Patterns:**
```tsx
// Large metric
"text-2xl font-bold text-slate-900"                    // 47 occurrences
"text-2xl font-bold tabular-nums"                      // subset

// Medium metric
"text-xl font-bold text-slate-900"                     // 15 occurrences

// Extra-large metric
"text-3xl font-bold text-slate-900"                    // 13 occurrences
```

**Top files:**
| File | Count |
|------|-------|
| `app/spd/PageClient.tsx` | 4 |
| `app/settings/financials/PageClient.tsx` | 4 |
| `app/admin/settings/hl7v2-test-harness/PageClient.tsx` | 4 |
| `app/analytics/kpi/PageClient.tsx` | 4 |

**Recommendation:** Add utility classes:
```css
.metric-value-md { @apply text-xl font-bold text-slate-900 tabular-nums; }
.metric-value-lg { @apply text-2xl font-bold text-slate-900 tabular-nums; }
.metric-value-xl { @apply text-3xl font-bold text-slate-900 tabular-nums; }
```

---

### 7. Divider/Separator Pattern (132+ occurrences)

**Patterns:**
```tsx
"border-t border-slate-100"     // Light divider
"border-t border-slate-200"     // Standard divider
"border-t-2 border-slate-200"   // Thick divider
```

**Recommendation:** Add utility classes:
```css
.divider      { @apply border-t border-slate-200; }
.divider-light { @apply border-t border-slate-100; }
.divider-thick { @apply border-t-2 border-slate-200; }
```

---

## :yellow_circle: HIGH — Adopt Existing Components

### 8. Card Container Pattern (33+ inline occurrences)

**Pattern:**
```tsx
className="rounded-lg border border-slate-200 overflow-hidden"
className="rounded-lg border border-slate-200 p-4"
className="rounded-lg border border-slate-200 bg-white shadow-sm"
```

**Note:** `components/ui/Card.tsx` and `CardEnhanced.tsx` exist with compound component patterns.

**Recommendation:** Audit files using inline card patterns and refactor to use `<Card>` / `<CardEnhanced>`.

---

### 9. Input Field Pattern (241+ occurrences of `w-full border rounded`)

**Pattern:**
```tsx
"w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
"w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
```

**Note:** `components/ui/Input.tsx` exists with 5 exports.

**Recommendation:** Audit inline input patterns and refactor to use `<Input>`.

---

## :green_circle: MEDIUM — Lower Priority Patterns

### 10. Focus Ring Pattern (207+ occurrences)

```tsx
"focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
"focus:outline-none focus:ring-2 focus:ring-blue-500/20"
```

**Recommendation:** Keep as-is. Already handled by Button component. These are used on custom interactive elements where Button isn't appropriate.

---

### 11. Flex Layout Patterns (1,500+ occurrences)

```tsx
"flex items-center gap-3"              // 1,203 occurrences
"flex items-center justify-between"    // 331 occurrences
```

**Recommendation:** Keep as-is. These are fundamental Tailwind composition patterns — extracting them as components would be over-abstraction. The duplication is acceptable because:
- Each usage has different children/content
- The pattern is 3-4 classes, not 8+
- A `<FlexRow>` component adds indirection without value

---

### 12. Skeleton Loading Pattern (90+ `animate-pulse` occurrences)

```tsx
"animate-pulse bg-slate-200 rounded"
"space-y-4 animate-pulse"
```

**Recommendation:** Keep as-is where used with existing `Skeleton` component. Refactor inline skeleton patterns to use shared `Skeleton.tsx` variants (covered in Report 03).

---

## Files with Highest Pattern Density

These files would benefit most from refactoring to shared components/utilities:

| Rank | File | Pattern Hotspots |
|------|------|-----------------|
| 1 | `components/analytics/AnalyticsComponents.tsx` | 47 flex patterns, 12 inline badges, 15 icon containers |
| 2 | `app/admin/settings/hl7v2-test-harness/PageClient.tsx` | 23 flex patterns, 5 section headings, 4 info boxes |
| 3 | `components/integrations/ReviewDetailPanel.tsx` | 19 flex patterns, 8 inline badges |
| 4 | `components/settings/milestones/TemplateBuilder.tsx` | 18 flex patterns, 10 icon containers |
| 5 | `components/cases/CaseDrawerFinancials.tsx` | 11 grid patterns, 10 uppercase labels |
| 6 | `app/analytics/block-utilization/PageClient.tsx` | 16 uppercase labels, 5 inline badges |
| 7 | `app/spd/PageClient.tsx` | 15 uppercase labels, 4 metric values |
| 8 | `components/analytics/financials/ProcedureDetail.tsx` | 12 uppercase labels, metric patterns |

---

## Implementation Plan

### Phase A: Utility Classes (1-2 hours)

Add to `app/globals.css`:
```css
/* Typography utilities */
.label-uppercase   { @apply text-xs font-medium text-slate-500 uppercase tracking-wide; }
.heading-section   { @apply text-lg font-semibold text-slate-900; }
.metric-value-md   { @apply text-xl font-bold text-slate-900 tabular-nums; }
.metric-value-lg   { @apply text-2xl font-bold text-slate-900 tabular-nums; }
.metric-value-xl   { @apply text-3xl font-bold text-slate-900 tabular-nums; }

/* Dividers */
.divider           { @apply border-t border-slate-200; }
.divider-light     { @apply border-t border-slate-100; }
.divider-thick     { @apply border-t-2 border-slate-200; }
```

### Phase B: New Component — IconContainer (2-3 hours)

Extract `<IconContainer>` component to replace 233+ inline icon wrappers.

### Phase C: Adopt Existing Components (4-6 hours)

Refactor files to use existing `<Badge>`, `<Card>`, `<Alert>`, `<Input>` instead of inline class strings.

### Estimated Impact

| Action | Occurrences Reduced | Files Affected |
|--------|-------------------|----------------|
| Utility classes | ~550 | 40+ |
| IconContainer component | ~233 | 20+ |
| Badge adoption | ~124 | 15+ |
| Card/Alert adoption | ~88 | 15+ |
| Input adoption | ~241 est. | 20+ est. |
| **Total** | **~1,236** | **50+ files** |

---

*Generated by Phase 2B of ORbit Component Audit*
*Next: Phase 3 — Dependency & Import Analysis*
