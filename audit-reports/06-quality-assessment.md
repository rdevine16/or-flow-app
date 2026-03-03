# Component Quality Assessment — ORbit Codebase Audit (Report 06 of 08)

## Methodology

Every shared component was evaluated across four quality dimensions:

1. **Props Interface Quality** — TypeScript typing, defaults, callback types, flexibility
2. **Composition Patterns** — Children support, compound components, render props, slots
3. **Accessibility** — ARIA attributes, keyboard interactions, label associations, focus management
4. **Design Token Usage** — Token adoption from `lib/design-tokens.ts`, no hardcoded colors/spacing

**Severity ratings:**
- 🔴 Critical — Must fix; accessibility violations, token system bypass, or API unsafety
- 🟡 Moderate — Should fix; inconsistencies, missing defaults, partial compliance
- 🟢 Minor/Good — Meets standards with minor suggestions

**Scope:** 45 web `ui/` components, 12 web `analytics/financials/shared/` components, 10 iOS shared components

---

## Overall Scorecard

### Web — `components/ui/` (45 files)

| Dimension | 🔴 Critical | 🟡 Moderate | 🟢 Good | Compliance |
|-----------|-------------|-------------|---------|------------|
| Props Interface | 1 | 2 | 42 | 93% |
| Composition | 1 | 1 | 43 | 96% |
| Accessibility | 0 | 17 | 28 | 62% |
| Design Tokens | 4 | 14 | 27 | 60% |

### Web — `analytics/financials/shared/` (12 files)

| Dimension | 🔴 Critical | 🟡 Moderate | 🟢 Good | Compliance |
|-----------|-------------|-------------|---------|------------|
| Props Interface | 0 | 0 | 12 | 100% |
| Composition | 0 | 1 | 11 | 92% |
| Accessibility | 5 | 5 | 2 | 17% |
| Design Tokens | 4 | 3 | 5 | 42% |

### iOS — Shared Components (10 files)

| Dimension | 🔴 Critical | 🟡 Moderate | 🟢 Good | Compliance |
|-----------|-------------|-------------|---------|------------|
| Init Parameters | 0 | 0 | 10 | 100% |
| Composition | 0 | 0 | 10 | 100% |
| Accessibility | 2 | 6 | 2 | 20% |
| Design Tokens | 0 | 2 | 8 | 80% |

---

## Web `components/ui/` — Detailed Assessments

### AccessDenied.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `AccessDeniedProps` interface. Default for `message`. Minor: hardcoded `/dashboard` return URL could be a prop. |
| Composition | 🟢 | Single-purpose component; no composition needed. |
| Accessibility | 🟡 | Missing `role="alert"` for screen readers. No focus management on mount. |
| Design Tokens | 🟡 | Hardcoded `bg-slate-100`, `text-slate-900` colors not from tokens. |

### Alert.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Well-typed `AlertProps`. Default values for all optional props. |
| Composition | 🟢 | Supports `children` for flexible content. Icon configurable via variant. |
| Accessibility | 🟢 | `role="alert"` present. Dismiss button has `aria-label`. Keyboard accessible. |
| Design Tokens | 🔴 | All colors hardcoded (`bg-blue-50`, `border-blue-200`). Should use `alertColors` from existing tokens. |

### Badge.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `BadgeProps`. Type-safe variant via `keyof typeof badgeVariants`. |
| Composition | 🟢 | Supports `children`. Simple, focused API. |
| Accessibility | 🟢 | Semantic `<span>`. |
| Design Tokens | 🟢 | Uses `badgeVariants` from design tokens. No hardcoded colors. |

### Breadcrumb.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named interface. Three exported variants (`Breadcrumb`, `BreadcrumbCompact`, `HeaderBreadcrumb`). |
| Composition | 🟢 | Good separation of concerns. Helper `ChevronIcon` for reuse. |
| Accessibility | 🟢 | `<nav>` with `aria-label="Breadcrumb"`. Semantic structure. |
| Design Tokens | 🟡 | Hardcoded `text-slate-500`, `text-slate-900` colors. |

### Button.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Extends `ButtonHTMLAttributes`. `forwardRef` for DOM access. `IconButton` enforces `aria-label`. |
| Composition | 🟢 | Supports `children`. Separate `IconButton` component. Loading spinner integrated. |
| Accessibility | 🟢 | Focus styles (`focus:ring-2`). Disabled states. `aria-label` required on `IconButton`. `type="button"` default. |
| Design Tokens | 🟢 | Uses `buttonVariants` and `buttonSpinnerColors` from tokens. |

### Card.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named interface. Default values. Likely superseded by `CardEnhanced.tsx`. |
| Composition | 🟢 | Supports `children`. Padding variants. |
| Accessibility | 🟢 | Semantic wrapper. |
| Design Tokens | 🟡 | Hardcoded `bg-white`, `border-slate-200`. |

### CardEnhanced.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Comprehensive type definitions. `forwardRef` support. Variant types well-defined. |
| Composition | 🟢 | **Exemplary compound component pattern:** `Card.Header`, `Card.Title`, `Card.Content`, `Card.Footer`. Specialized variants: `StatsCard`, `ListCard`, `ProfileCard`. |
| Accessibility | 🟢 | `role="dialog"` for loading overlay. `aria-label` and `aria-labelledby` support. Interactive cards use `<button>` when clickable. |
| Design Tokens | 🟡 | Uses `trendColors` and `alertColors` from tokens, but still has hardcoded `bg-white`, `border-slate-200`, z-index values. |

### ConfirmDialog.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Async callback support (`() => void | Promise<void>`). Loading state. `useConfirmDialog` hook. |
| Composition | 🟢 | Specialized variants: `DeleteConfirm`, `LeaveConfirm`, `ArchiveConfirm`. Render prop via hook. |
| Accessibility | 🟢 | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`. Keyboard (Escape, Enter). Focus trap. |
| Design Tokens | 🟢 | Uses `tokens.zIndex.modal` and `tokens.zIndex.modalBackdrop`. |

### Container.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named interface. Simple, focused API. |
| Composition | 🟢 | Supports `children`. |
| Accessibility | 🟢 | Semantic wrapper. |
| Design Tokens | 🟡 | Hardcoded padding (`px-6`). No responsive padding options or maxWidth variants. |

### DateFilter.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named interface. Callback properly typed. |
| Composition | 🟢 | Internal state management. Quick filters + custom range. |
| Accessibility | 🟡 | Buttons lack `aria-pressed` for selected state. Date inputs lack labels. No keyboard nav between filter buttons. |
| Design Tokens | 🔴 | All colors hardcoded: `bg-slate-900`, `text-white`, `border-slate-200`, `focus:ring-teal-500/20`. |

### DatePickerCalendar.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Comprehensive interface. Two variants (compact, form). Error handling, disabled, required, onBlur. |
| Composition | 🟢 | Dual rendering modes (chip vs form field). Clean internal state. |
| Accessibility | 🟡 | Calendar grid lacks `role="grid"` and `role="gridcell"`. No arrow key navigation. Date cells lack descriptive labels. |
| Design Tokens | 🔴 | All colors hardcoded: `bg-blue-600`, `text-slate-900`, `border-slate-200`, `ring-blue-500/20`. Z-index hardcoded. |

### DateRangeSelector.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Clear interface. Exported helpers (`getPresetDates`, `getPrevPeriodDates`, `toDateStr`). |
| Composition | 🟢 | Tab pattern (Presets vs Custom). Preset groups. Quick shortcuts. |
| Accessibility | 🟡 | Tab buttons lack `role="tablist"` and `aria-selected`. Preset buttons lack `aria-pressed`. Date inputs lack labels. |
| Design Tokens | 🔴 | All colors hardcoded throughout. Focus rings hardcoded. Z-index hardcoded. |

### DeltaBadge.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Format options (`percentage`, `time`, `currency`). `invert` for context-aware coloring. `severity` override. |
| Composition | 🟢 | Single-purpose. Smart auto-severity detection. |
| Accessibility | 🟢 | `aria-label` with descriptive text. `aria-hidden` on arrows. Screen reader-friendly. |
| Design Tokens | 🟡 | Severity colors hardcoded in `SEVERITY_STYLES`. Could use `trendColors` from tokens. |

### DrillDownLink.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Spreads remaining props to `Link`. Includes hook variant (`useDrillDownUrl`). |
| Composition | 🟢 | Wraps Next.js `Link` cleanly. Hook for non-component use cases. |
| Accessibility | 🟢 | Uses native `Link` (inherits Next.js accessibility). |
| Design Tokens | 🟢 | No styling applied (pure logic component). |

### EmptyState.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟡 | Named `EmptyStateProps`. `action` prop has mixed type (ReactNode | object) requiring type assertions. |
| Composition | 🟢 | Good use of optional slots (icon, description, action). Provides `EmptyStateIcons` convenience export. |
| Accessibility | 🟡 | Missing `role="status"` or `aria-live="polite"` for screen readers. |
| Design Tokens | 🟡 | Uses `buttonVariants.primary` from tokens, but icon container sizes hardcoded (`w-14 h-14`). |

### ErrorBanner.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `ErrorBannerProps` with JSDoc. Sensible `retryLabel` default. |
| Composition | 🟢 | Optional retry and dismiss actions. All parts composable. |
| Accessibility | 🟢 | `role="alert"`. Dismiss button has `aria-label="Dismiss error"`. |
| Design Tokens | 🟢 | Uses `alertColors.error` from design tokens. One hardcoded `text-red-800`. |

### FloatingActionButton.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟡 | Icon type is union of strings — inflexible. Should accept `ReactNode` for custom icons. |
| Composition | 🟡 | Icon limitation is significant constraint. Good action array pattern and internal state management. |
| Accessibility | 🟢 | `aria-label`, `aria-expanded` on main button. Escape key closes menu. Click-outside handling. |
| Design Tokens | 🔴 | Many hardcoded colors: `bg-white`, `border-slate-200`, `bg-blue-50`, `bg-slate-800`, gradient `from-blue-600 to-blue-500`. No design token imports. |

### Input.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Separate interfaces for Input, Textarea, Select, Label, FormField. Extends native types. `forwardRef` for form library integration. |
| Composition | 🟢 | `Select` and `Label` support children. `FormField` composes Label + input + error. |
| Accessibility | 🟢 | Label supports `htmlFor`. Required indicator. Disabled states. Focus rings. Minor: `FormField` doesn't auto-link label to input. |
| Design Tokens | 🟢 | Uses `inputColors` from design tokens. Error/normal states properly applied. |

### Loading.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Separate interfaces for Spinner, PageLoader, LoadingOverlay. `SpinnerSize` type alias. |
| Composition | 🟢 | `LoadingOverlay` supports children. Components build on each other (PageLoader uses Spinner). |
| Accessibility | 🟢 | `role="status"`. `sr-only` "Loading..." text. Status role = ARIA live region. |
| Design Tokens | 🟢 | Uses `spinnerColors` from tokens. Centralized `sizeClasses`. |

### MarginGauge.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `MarginGaugeProps` with JSDoc. Default for `size`. Well-typed `rating` prop. |
| Composition | 🟢 | Appropriate for SVG gauge visualization. |
| Accessibility | 🟢 | `role="img"` with descriptive `aria-label`. Handles null with "data unavailable". |
| Design Tokens | 🟡 | Hardcoded hex colors in `RATING_COLORS` (#0d9488, #16a34a, etc.). Hardcoded pixel values in `SIZE_CONFIG`. |

### MetricCard.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `MetricCardProps`. Multiple optional props. Comprehensive defaults. |
| Composition | 🟢 | Companion components: `MetricCardCompact`, `MetricCardGrid`. Grid accepts children. |
| Accessibility | 🟡 | No ARIA for animated counter. Trend arrows lack screen reader text. Should add `aria-live="polite"`. |
| Design Tokens | 🟢 | Uses `metricColors` and `trendColors` from tokens. |

### MilestoneButton.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `MilestoneButtonProps`. Proper callback typing. |
| Composition | 🟢 | Two variants: single and paired start/stop. `RunningTimer` internal component. |
| Accessibility | 🟡 | Buttons lack `aria-label`. Undo (X) button has no accessible text. No `aria-pressed` for recorded state. |
| Design Tokens | 🟢 | All colors via Tailwind classes. Consistent spacing. |

### Modal.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Extensive JSDoc with usage examples. Named interfaces for all sub-components. |
| Composition | 🟢 | **Exemplary compound pattern:** `Modal.Footer`, `Modal.Cancel`, `Modal.Action`. Portal rendering. |
| Accessibility | 🟢 | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`. Escape key. Focus trap. Body scroll lock. |
| Design Tokens | 🟢 | Uses `tokens.zIndex` and `buttonVariants`. |

### Navbar.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🔴 | **No props interface at all.** Hardcoded nav items array and facility name "Memorial General". Not reusable. |
| Composition | 🔴 | No composition support. Tightly coupled to specific data. Should accept children or nav items as props. |
| Accessibility | 🟡 | Missing mobile menu implementation. No `aria-current` on active nav items. Logo SVG lacks `aria-hidden`. |
| Design Tokens | 🟡 | Hardcoded gradient `from-teal-400 to-cyan-500`. |

### NoFacilitySelected.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `NoFacilitySelectedProps`. All optional with defaults. JSDoc usage notes. |
| Composition | 🟡 | Could accept `children` for custom action buttons. Currently limited to single link action. |
| Accessibility | 🟢 | Semantic heading. Link has clear label. |
| Design Tokens | 🟢 | All colors via Tailwind classes. No hardcoded values. |

### Pagination.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `PaginationProps`. Comprehensive with defaults. Optional per-page callback. JSDoc examples. |
| Composition | 🟢 | Smart page number windowing algorithm. |
| Accessibility | 🟢 | `aria-label` on prev/next buttons. Disabled states. Keyboard navigation. |
| Design Tokens | 🟢 | All via Tailwind classes. No hardcoded values. |

### PhaseBadge.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `PhaseBadgeProps`. Strongly typed with `CasePhase` enum. |
| Composition | 🟢 | Two variants: basic and with dot. |
| Accessibility | 🟡 | No `aria-label` or semantic text for screen readers. |
| Design Tokens | 🟢 | Uses `phaseColors` from design tokens. |

### ProcedureIcon.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `ProcedureIconProps`. Defaults for size and className. Handles nullable category. |
| Composition | 🟢 | Simple icon wrapper. |
| Accessibility | 🟡 | Icons should have `aria-hidden="true"` when decorative or `aria-label` when standalone. |
| Design Tokens | 🟢 | Flexible className prop. Default color via Tailwind. |

### ProfitBadge.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `ProfitBadgeProps`. Strongly typed with `MarginRating`. |
| Composition | 🟢 | Single-purpose badge. |
| Accessibility | 🟢 | `aria-label` provides full context. |
| Design Tokens | 🟢 | All via Tailwind classes. |

### ScoreRing.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `ScoreRingProps`. Sensible defaults for `size`, `ringWidth`. |
| Composition | 🟢 | Pure SVG rendering. |
| Accessibility | 🟡 | No `role="img"` on SVG. No `aria-label` for score value. |
| Design Tokens | 🟢 | Uses `getGrade()` function for colors. |

### SearchableDropdown.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Well-defined `SearchableDropdownProps` and `Option` interfaces. Proper callback typing. |
| Composition | 🟢 | Clean option-based API. |
| Accessibility | 🟡 | Missing `aria-expanded`, `aria-haspopup`. No keyboard navigation (arrow keys). Search input lacks `aria-label`. |
| Design Tokens | 🟡 | Hardcoded `border-red-400`, `ring-teal-500/20`, `bg-teal-50`. |

### SearchInput.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `SearchInputProps`. Good defaults. |
| Composition | 🟢 | Input pattern with clear button. |
| Accessibility | 🟢 | Clear button has `aria-label="Clear search"`. Good keyboard support. |
| Design Tokens | 🟡 | Hardcoded `focus:ring-blue-500`, `focus:border-blue-500`, `border-slate-300`. |

### Skeleton.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟡 | **Duplicate `SkeletonProps` interface** defined twice (lines 8-12 and 14-18). |
| Composition | 🟢 | Good specialized variants (`SkeletonText`, `SkeletonTable`, `SkeletonCard`, etc.). |
| Accessibility | 🟢 | Uses `animate-pulse` for loading indication. |
| Design Tokens | 🟢 | Tailwind gradient classes consistently. No hardcoded hex colors. |

### Sparkline.tsx (ui/)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟡 | Named `SparklineProps`. Default color is hardcoded hex `#10b981`. |
| Composition | 🟢 | Helper function `dailyDataToSparkline` for data transformation. |
| Accessibility | 🟢 | `role="img"` on SVG. Descriptive `aria-label` with trend info. |
| Design Tokens | 🟡 | Default color `#10b981` is hardcoded hex instead of token reference. |

### StaffAvatar.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named interfaces. Multiple variants for different use cases. |
| Composition | 🟢 | Three variants: `StaffAvatar`, `DraggableStaffAvatarDisplay`, `AssignedStaffAvatar`. `GroupedStaffTooltip` wrapper. |
| Accessibility | 🟡 | Uses `title` attribute (not ideal for a11y). Remove button missing `aria-label`. |
| Design Tokens | 🟢 | Uses `getRoleColors()` design token function. |

### StaffBadge.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `StaffBadgeProps`. Optional `onRemove` callback properly typed. |
| Composition | 🟢 | Badge pattern. |
| Accessibility | 🟡 | Remove button missing `aria-label`. Inline SVG close icon (could use lucide-react). |
| Design Tokens | 🟢 | Uses `getRoleColors()` from tokens. |

### StaffPopover.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named interfaces: `Staff`, `StaffOption`, `StaffPopoverProps`. Well-typed callbacks. |
| Composition | 🟢 | Self-contained popover with search. |
| Accessibility | 🟡 | Missing `role="dialog"` or `aria-haspopup`. Search input lacks `aria-label`. No keyboard list navigation. |
| Design Tokens | 🟡 | Hardcoded `bg-teal-100`, `text-teal-700`, `ring-teal-500/20`, `bg-red-50`, `text-red-600`. |

### StatusBadge.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `StatusBadgeProps`, `StatusBadgeDotProps`. Good union types. |
| Composition | 🟢 | Two variants: basic and with dot indicator. |
| Accessibility | 🟢 | Semantic spans. Good visual hierarchy. |
| Design Tokens | 🟢 | Uses `getStatusColors()` from tokens. **Exemplary token usage.** |

### StatusIndicator.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `StatusIndicatorProps`. Config object pattern for status mapping. |
| Composition | 🟢 | Indicator pattern. |
| Accessibility | 🟢 | Descriptive text included. |
| Design Tokens | 🟡 | Colors defined inline in `statusConfig` (`bg-green-500`, `text-green-600`). Should use existing `statusColors`. |

### SurgeonAvatar.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `SurgeonAvatarProps`. Size variants. Helper for initials. |
| Composition | 🟢 | Avatar pattern. |
| Accessibility | 🟢 | Initials provide text alternative. |
| Design Tokens | 🟡 | Hardcoded gradient `from-blue-500 to-blue-700`, `shadow-blue-500/30`. |

### TableActions.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `TableActionsProps`. All callbacks optional with defaults. Tooltip text customizable. |
| Composition | 🟢 | Action button group. |
| Accessibility | 🟢 | All buttons have `title` and `aria-label`. Proper `stopPropagation`. |
| Design Tokens | 🟡 | Hardcoded hover colors: `hover:text-blue-600`, `hover:bg-blue-50`, `hover:text-red-600`, `hover:bg-red-50`. |

### TimePicker.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `TimePickerProps`. Well-typed callbacks. |
| Composition | 🟢 | Good separation of quick-select vs custom time. |
| Accessibility | 🟡 | Spinner buttons missing `aria-label`. Custom time section could use `role="group"`. |
| Design Tokens | 🟡 | Hardcoded `border-blue-500`, `ring-blue-500/20`, `bg-blue-600`, `border-red-400`. |

### Toggle.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `ToggleProps`. Custom `aria-label` support. Size variants. |
| Composition | 🟢 | Toggle switch pattern. |
| Accessibility | 🟢 | Proper `role="switch"`, `aria-checked`, `aria-label`. Disabled states. |
| Design Tokens | 🟢 | Uses `toggleColors` from tokens. **Exemplary token usage.** |

### Tooltip.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named interfaces for all variants. Shortcuts, positions, delays. |
| Composition | 🟢 | Requires `children`. Compound: `TooltipIconButton`, `TooltipHelp`, `TooltipTruncate`, `InfoTooltip`. |
| Accessibility | 🟢 | `role="tooltip"`. Good focus/blur handling. Keyboard Escape for InfoTooltip. Viewport edge detection. |
| Design Tokens | 🟢 | Uses `tokens.zIndex.tooltip`. Minor hardcoded `bg-slate-900` (acceptable for tooltips). |

### ViewToggle.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `ViewOption`, `ViewToggleProps`. Optional icon with `React.ReactNode`. |
| Composition | 🟢 | Option-based pattern. |
| Accessibility | 🟡 | Missing `role="group"` or `role="tablist"`. Buttons should use `aria-pressed`. Missing group `aria-label`. |
| Design Tokens | 🟡 | Hardcoded `bg-slate-100`, `bg-white`, `text-slate-900`, `text-slate-600`. |

### Toast/ToastProvider.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | `Toast`, `ToastOptions`, `ToastAction`, `ToastContextValue` interfaces. JSDoc with examples. |
| Composition | 🟢 | Provider pattern with hook (`useToast`). Helper hook (`useToastHelpers`). Provider → Container → Item. |
| Accessibility | 🟢 | `role="alert"` on toast items. Dismissible. Good keyboard support. |
| Design Tokens | 🟢 | Uses `tokens.zIndex.toast` and `alertColors`. **Exemplary token usage.** |

---

## Web `analytics/financials/shared/` — Detailed Assessments

### AnimatedNumber.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `AnimatedNumberProps`. Good defaults (`prefix='$'`, `decimals=0`, `duration=800`). |
| Composition | 🟡 | Returns bare `<span>` without `className` prop — cannot be styled by consumers. |
| Accessibility | 🟡 | No `aria-live="polite"` for value changes. No `prefers-reduced-motion` support. |
| Design Tokens | 🟢 | Relies on parent for styling (appropriate). |

### ComparisonPill.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `ComparisonPillProps`. Good defaults. `invert` for context-aware coloring. |
| Composition | 🟢 | Single-purpose pill. Good display logic separation. |
| Accessibility | 🔴 | **Color is only indicator of good/bad (WCAG violation).** No `aria-label` for screen readers. SVG arrow missing `aria-hidden`. |
| Design Tokens | 🟡 | Hardcoded sizes (`text-[10px]`, `w-2.5 h-2.5`). Uses Tailwind colors but not from centralized tokens. |

### ConsistencyBadge.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `ConsistencyBadgeProps`. Type-safe `ConsistencyRating` enum. |
| Composition | 🟢 | Config-driven styling. |
| Accessibility | 🟡 | No `aria-label` to explain consistency meaning. Color-only indicator. |
| Design Tokens | 🟢 | Uses Tailwind color tokens. Ring-based design. |

### InfoTip.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `InfoTipProps`. Single required `text` prop. |
| Composition | 🟡 | Hardcoded positioning. No placement prop. Fixed max-width. |
| Accessibility | 🔴 | **Completely inaccessible to keyboard users.** Hover-only tooltip. `pointer-events-none` on tooltip. No `aria-describedby`. No WCAG 1.4.13 compliance. Should use `<button>` with ARIA tooltip pattern. |
| Design Tokens | 🟢 | Uses Tailwind tokens. Minor hardcoded sizes. |

### MarginBadge.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `MarginBadgeProps`. Uses `formatPercent` utility. |
| Composition | 🟢 | Single-purpose badge. |
| Accessibility | 🟡 | Color is only indicator. Should have `aria-label` like "Good margin: 35%". |
| Design Tokens | 🟡 | Threshold values (30, 15, 0) hardcoded. Color palette should be centralized. |

### MarginDot.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `MarginDotProps`. Simple API. |
| Composition | 🟢 | Minimal, focused. |
| Accessibility | 🟡 | No `aria-hidden` on decorative dot. No semantic meaning conveyed. |
| Design Tokens | 🔴 | **Hardcoded hex colors:** `'#10b981'`, `'#f59e0b'`, `'#ef4444'`. Thresholds (25, 10) inconsistent with MarginBadge thresholds (30, 15, 0). |

### MicroBar.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `MicroBarProps`. `color` prop is `string` — should be union type. |
| Composition | 🟢 | Uses `fmt` utility. |
| Accessibility | 🟡 | No ARIA label for bar visualization. No `role="img"`. |
| Design Tokens | 🔴 | Accepts arbitrary `color` string — no design system constraint. Inline `style` attributes bypass Tailwind. Hardcoded opacity `0.15`. |

### PhasePill.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `PhasePillProps`. Type-safe `PhasePillColor`. Returns `null` for missing data. |
| Composition | 🟢 | Config-driven color mapping. |
| Accessibility | 🟡 | No `aria-label` for "Pre-op phase, 15 minutes". Dot should have `aria-hidden`. |
| Design Tokens | 🟢 | Tailwind color tokens consistently. |

### RankBadge.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `RankBadgeProps`. |
| Composition | 🟢 | Config-driven podium styles. |
| Accessibility | 🟡 | No `aria-label` for "Rank 1, First place". Color-only indicator. |
| Design Tokens | 🟡 | Podium colors hardcoded in array. Size `w-6 h-6` hardcoded. |

### SortTH.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `SortTHProps`. Type-safe `SortDir`. Good defaults. |
| Composition | 🟢 | Controlled component. |
| Accessibility | 🔴 | **`<th>` has `onClick` but no `onKeyDown`.** No `aria-sort`. No `role="button"`. No `tabIndex="0"`. Sort direction not announced. |
| Design Tokens | 🟡 | Hardcoded `text-[10px]`. Inline SVG chevrons instead of lucide-react. |

### Sparkline.tsx (financials/shared/)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `SparklineProps`. Handles empty data. |
| Composition | 🟢 | Self-contained SVG. Returns null for insufficient data. |
| Accessibility | 🔴 | **SVG has no `role="img"` or `aria-label`.** Chart data completely inaccessible. |
| Design Tokens | 🔴 | Default color is hardcoded hex `'#3b82f6'`. No type safety on color prop. |

### SparklineLight.tsx

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Props Interface | 🟢 | Named `SparklineLightProps`. Handles empty data. |
| Composition | 🟢 | Variant for dark backgrounds. **DRY violation:** duplicates all logic from Sparkline.tsx. |
| Accessibility | 🔴 | Same as Sparkline — no role, no label, no screen reader support. |
| Design Tokens | 🔴 | Hardcoded `stroke="white"`, `opacity-40`. |

---

## iOS Shared Components — Detailed Assessments

### SkeletonView.swift

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Init Parameters | 🟢 | Structs are render-only (no init parameters needed). |
| Composition | 🟢 | Compound pattern: `SkeletonRoomCard`, `SkeletonCaseCard`, `SkeletonRoomsList`, `SkeletonCasesList`. |
| Accessibility | 🔴 | **No `accessibilityLabel` on any skeleton view.** VoiceOver will announce layout noise. Should use `.accessibilityElement(children: .ignore)` with "Loading content" label. |
| Design Tokens | 🟢 | Uses `OrbitRadius.sm`, `OrbitSpacing.lg`, `Color.orbitSlate`. |

### ToastView.swift

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Init Parameters | 🟢 | Well-typed `Toast` model with `ToastType` enum. Good defaults (`duration: 2.0`). |
| Composition | 🟢 | Compound: `Toast` model, `ToastView`, `ToastModifier`. View extension for ergonomic usage. |
| Accessibility | 🟡 | No explicit `accessibilityLabel`. Should use `UIAccessibility.post(notification:argument:)` for announcements. |
| Design Tokens | 🟢 | Uses `OrbitSpacing`, `OrbitFont`, `OrbitRadius`, `Color.orbitGreen`. |

### StatusBadge.swift

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Init Parameters | 🟢 | Well-typed with `BadgeSize` enum. Computed properties for sizing. |
| Composition | 🟢 | Includes separate `ActiveDot` component. |
| Accessibility | 🟢 | Has `accessibilityLabel("Status: \(displayText)")`. Minor: `ActiveDot` lacks label. |
| Design Tokens | 🟢 | Uses `OrbitRadius.full`, `Color.orbitSlate`, `Color.orbitGreen`. |

### RoomFilterBar.swift

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Init Parameters | 🟢 | Well-typed `@Binding var selectedDate: Date`. Good callback pattern. |
| Composition | 🟢 | Compound: `DateNavigationRow`, `RoomChipsRow`, `AllRoomsChip`, `RoomChipView`. |
| Accessibility | 🟡 | Buttons have no explicit `accessibilityLabel`. Chips should have `accessibilityHint`. |
| Design Tokens | 🟢 | Consistent use of design tokens throughout. |

### PressAnimations.swift

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Init Parameters | 🟢 | Well-parameterized with defaults (`scaleAmount: 0.97`). Clean ViewModifier pattern. |
| Composition | 🟢 | Multiple reusable types: `PressableCard`, `BounceIn`, `SlideUp`, `ShimmerEffect`. View extensions. |
| Accessibility | 🔴 | **No check for `UIAccessibility.isReduceMotionEnabled`.** All animations should be gated. Shimmer should be hidden from VoiceOver. |
| Design Tokens | 🟡 | Uses `Color.orbitPrimary`. Animation durations (0.15, 0.4, 1.5) and scale amounts (0.97, 0.8) hardcoded. |

### LoadingView.swift

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Init Parameters | 🟢 | Good defaults (`message: "Loading..."`). Optional action pattern. |
| Composition | 🟢 | Three related: `LoadingView`, `EmptyStateView`, `ErrorView`. |
| Accessibility | 🟡 | Missing `accessibilityLabel` on ProgressView. ErrorView retry button needs `accessibilityHint`. |
| Design Tokens | 🟢 | Uses `OrbitFont`, `OrbitSpacing`, `OrbitRadius`, `Color.orbitPrimary`. |

### HeaderBar.swift

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Init Parameters | 🟢 | Well-typed with `@Binding var unreadCount: Int`. |
| Composition | 🟢 | Clean header with logo integration. |
| Accessibility | 🟡 | Bell button needs `accessibilityLabel("Notifications")` and `accessibilityValue("\(unreadCount) unread")`. Badge should be `accessibilityHidden`. |
| Design Tokens | 🟢 | Uses `OrbitSpacing`, `Color.orbitPrimary`, `Color.orbitBackground`. |

### FloatingActionButton.swift

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Init Parameters | 🟢 | Simple `onTap: () -> Void`. |
| Composition | 🟢 | Gradient background. |
| Accessibility | 🟢 | Has `accessibilityLabel("Add")` and `accessibilityHint("Open actions menu")`. |
| Design Tokens | 🟡 | Uses color tokens. Sizes hardcoded (`56×56`). Shadow values hardcoded. |

### CustomRefreshControl.swift

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Init Parameters | 🟢 | Well-typed async action. `@ViewBuilder` for content. |
| Composition | 🟢 | Custom refresh view, loading indicator, success checkmark. View extension. |
| Accessibility | 🟡 | Custom indicators should have `accessibilityLabel("Refreshing")`. Success checkmark should announce. |
| Design Tokens | 🟢 | Uses `Color.orbitPrimary`, `OrbitFont`, `OrbitSpacing`. |

### ActiveCaseBar.swift

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Init Parameters | 🟢 | `@ObservedObject var activeCaseManager`. Clear callback pattern. |
| Composition | 🟢 | Compound: `PulsingDot`, `LiveTimer`. Drag gesture. |
| Accessibility | 🟡 | Has `accessibilityLabel` and `accessibilityHint` on button. `PulsingDot` should be `accessibilityHidden`. Drag gesture not accessible (no alternative dismiss). |
| Design Tokens | 🟢 | Uses `Color.orbitPrimary`, `Color.orbitDark`, `Color.orbitGreen`. |

---

## Critical Issues Summary (🔴)

### Web — Immediate Fixes Required

| # | Component | Issue | Impact |
|---|-----------|-------|--------|
| 1 | `Alert.tsx` | All colors hardcoded despite `alertColors` token existing | Token consistency |
| 2 | `DateFilter.tsx` | All styling hardcoded — zero token usage | Token consistency |
| 3 | `DatePickerCalendar.tsx` | Colors, focus rings, z-index all hardcoded | Token consistency |
| 4 | `DateRangeSelector.tsx` | Comprehensive hardcoded styling | Token consistency |
| 5 | `FloatingActionButton.tsx` | No design token imports. Many hardcoded colors/gradients | Token consistency |
| 6 | `Navbar.tsx` | No props interface, hardcoded data. Not reusable | Architecture |
| 7 | `InfoTip.tsx` (shared/) | Completely inaccessible to keyboard/screen reader users | WCAG violation |
| 8 | `SortTH.tsx` (shared/) | `<th onClick>` with no keyboard support, no `aria-sort` | WCAG violation |
| 9 | `ComparisonPill.tsx` (shared/) | Color-only semantics with no screen reader alternative | WCAG violation |
| 10 | `Sparkline.tsx` (shared/) | No `role="img"`, no `aria-label`. Hardcoded hex default color | WCAG + tokens |
| 11 | `SparklineLight.tsx` (shared/) | Same as Sparkline + code duplication | WCAG + DRY |
| 12 | `MarginDot.tsx` (shared/) | Hardcoded hex colors. Inconsistent thresholds with MarginBadge | Token + logic bug |
| 13 | `MicroBar.tsx` (shared/) | Accepts arbitrary color string. Inline styles bypass Tailwind | Token safety |

### iOS — Immediate Fixes Required

| # | Component | Issue | Impact |
|---|-----------|-------|--------|
| 14 | `SkeletonView.swift` | No VoiceOver labels — announces layout noise instead of "Loading" | VoiceOver |
| 15 | `PressAnimations.swift` | No `UIAccessibility.isReduceMotionEnabled` check | Motion accessibility |

---

## Exemplary Components (🟢 All Dimensions)

These components demonstrate best practices and should be used as reference implementations:

| Component | Why It's Exemplary |
|-----------|--------------------|
| **Button.tsx** | TypeScript extends native props, `forwardRef`, `aria-label` enforced on `IconButton`, token-based variants |
| **ConfirmDialog.tsx** | Full ARIA dialog pattern, focus trap, async callbacks, `useConfirmDialog` hook, `tokens.zIndex` |
| **Modal.tsx** | Compound component pattern (`Modal.Footer`, `Modal.Cancel`, `Modal.Action`), full a11y, tokens |
| **Loading.tsx** | `role="status"`, `sr-only` text, `spinnerColors` tokens, component composition |
| **Toggle.tsx** | `role="switch"`, `aria-checked`, `toggleColors` tokens, size variants |
| **StatusBadge.tsx** | `getStatusColors()` token function, two variants, semantic spans |
| **Toast/ToastProvider.tsx** | Provider + hook pattern, `alertColors` tokens, `role="alert"`, `tokens.zIndex.toast` |
| **Input.tsx** | Extends native types, `forwardRef`, `inputColors` tokens, `FormField` composition |
| **DeltaBadge.tsx** | `aria-label` with descriptive text, format options, severity detection |
| **ErrorBanner.tsx** | `role="alert"`, `alertColors.error` tokens, composable dismiss/retry |

---

## Cross-Cutting Findings

### 1. Design Token Adoption is Inconsistent

The design token system at `lib/design-tokens.ts` is comprehensive (40+ exports), but adoption is uneven:

| Token Category | Available | Adopted By |
|----------------|-----------|------------|
| `statusColors` / `getStatusColors()` | ✅ | StatusBadge, CardEnhanced |
| `alertColors` / `getAlertColors()` | ✅ | Toast, ErrorBanner. **NOT** Alert.tsx |
| `buttonVariants` | ✅ | Button, ConfirmDialog, Modal, EmptyState |
| `inputColors` | ✅ | Input |
| `toggleColors` | ✅ | Toggle |
| `spinnerColors` | ✅ | Loading |
| `metricColors` / `trendColors` | ✅ | MetricCard, CardEnhanced, DeltaBadge |
| `phaseColors` | ✅ | PhaseBadge |
| `tokens.zIndex` | ✅ | Modal, ConfirmDialog, Toast, Tooltip |
| `badgeVariants` | ✅ | Badge |
| `getRoleColors()` | ✅ | StaffAvatar, StaffBadge |

**Gap:** 14 components use hardcoded colors where tokens exist. The `analytics/financials/shared/` directory is the worst offender — most components predate the token system.

### 2. Accessibility Pattern Gaps

| Pattern | Present In | Missing From |
|---------|-----------|-------------|
| `role="alert"` | Alert, ErrorBanner, Toast | AccessDenied, EmptyState |
| `role="dialog"` + `aria-modal` | Modal, ConfirmDialog | — |
| `role="img"` + `aria-label` | MarginGauge, Sparkline (ui/) | ScoreRing, Sparkline (shared/), SparklineLight |
| `role="switch"` + `aria-checked` | Toggle | — |
| `role="status"` | Loading | — |
| `aria-sort` on sortable headers | — | SortTH |
| `aria-expanded` + `aria-haspopup` | FloatingActionButton | SearchableDropdown |
| `aria-pressed` for toggleable buttons | — | DateFilter, DateRangeSelector, ViewToggle |
| Keyboard navigation for lists | — | SearchableDropdown, StaffPopover |
| `prefers-reduced-motion` | — | AnimatedNumber |

### 3. iOS Accessibility Gaps

| Pattern | Present In | Missing From |
|---------|-----------|-------------|
| `accessibilityLabel` | StatusBadge, FloatingActionButton, ActiveCaseBar | SkeletonView, RoomFilterBar buttons, HeaderBar bell |
| `accessibilityHint` | FloatingActionButton | RoomFilterBar chips, LoadingView retry |
| `accessibilityHidden` (decorative) | — | PulsingDot, SkeletonView icons |
| `isReduceMotionEnabled` | — | PressAnimations (all modifiers) |
| Accessibility announcements | — | ToastView, CustomRefreshControl |

### 4. Composition Quality Is High

The codebase demonstrates strong composition patterns:
- **Compound components:** CardEnhanced, Modal, ConfirmDialog, Toast
- **Hook patterns:** `useConfirmDialog`, `useToast`, `useToastHelpers`, `useDrillDownUrl`
- **Config-driven styling:** StatusBadge, PhaseBadge, ConsistencyBadge, Loading
- **ForwardRef:** Button, Input, Textarea, Select

Only `Navbar.tsx` is flagged as architecturally broken (no props, hardcoded data).

---

## Recommendations by Priority

### P0 — Fix Immediately

1. **Migrate 5 date/filter components to design tokens:** Alert, DateFilter, DatePickerCalendar, DateRangeSelector, FloatingActionButton already have matching token exports. Estimated: ~2 hours.

2. **Fix SortTH keyboard accessibility:** Add `tabIndex={0}`, `onKeyDown`, `aria-sort`, `role="columnheader"`. Estimated: 30 min.

3. **Fix InfoTip a11y:** Replace hover-only tooltip with `<button>` trigger + proper ARIA tooltip pattern. Estimated: 1 hour.

4. **Add VoiceOver labels to iOS SkeletonView:** `.accessibilityElement(children: .ignore)` with `.accessibilityLabel("Loading content")`. Estimated: 15 min.

5. **Add reduced motion check to PressAnimations.swift:** Gate all animations with `UIAccessibility.isReduceMotionEnabled`. Estimated: 30 min.

### P1 — Fix Soon

6. **Add `aria-label` to ComparisonPill, Sparkline (shared/), SparklineLight:** These data visualization components are invisible to screen readers. Estimated: 1 hour.

7. **Fix MarginDot hardcoded hex colors and threshold inconsistency:** Align thresholds with MarginBadge (30, 15, 0). Use Tailwind tokens. Estimated: 30 min.

8. **Merge Sparkline + SparklineLight:** Extract shared SVG logic. Accept `theme` prop for light/dark variants. Estimated: 1 hour.

9. **Add `aria-pressed` to toggle-style buttons:** DateFilter, DateRangeSelector, ViewToggle. Estimated: 30 min.

10. **Add `aria-expanded`/`aria-haspopup` to SearchableDropdown and StaffPopover.** Estimated: 30 min.

### P2 — Fix When Touched

11. Refactor `Navbar.tsx` to accept props (only if ever reused — currently single-instance).
12. Fix duplicate `SkeletonProps` interface in Skeleton.tsx.
13. Add `className` prop to `AnimatedNumber.tsx`.
14. Add `prefers-reduced-motion` support to AnimatedNumber.
15. Replace `title` attribute tooltips in StaffAvatar with proper ARIA tooltips.
16. Add `accessibilityLabel` to iOS HeaderBar bell button.
17. Add `accessibilityHint` to iOS RoomFilterBar chips.
18. Consolidate `StatusIndicator.tsx` inline colors to use `statusColors` from tokens.

---

*Generated by Phase 4 of ORbit Component Audit*
*Next: Phase 5 — Extraction Recommendations*
