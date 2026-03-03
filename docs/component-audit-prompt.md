# ORbit Component Audit — Claude Code Prompt

## Objective

Perform a deep audit of the ORbit codebase (Next.js web app + SwiftUI iOS app) to identify every instance where UI elements are defined inline rather than as shared, reusable components. The goal is zero inline component definitions — everything reusable should live in the shared component library.

---

## Phase 1: Discovery & Inventory

### 1A — Map the Current Component Architecture

Scan the entire codebase and produce a complete inventory:

```
For the Next.js web app:
1. List every file in the shared/components directory (or equivalent)
2. List every file that defines a React component (export default, export const, function Component)
3. For each component, note:
   - File path
   - Component name
   - Whether it's exported from a barrel file (index.ts)
   - Props interface (if any)
   - Number of places it's imported
   - Dependencies on other components
```

```
For the SwiftUI iOS app:
1. List every file in shared/reusable Views directories
2. List every file that defines a View struct
3. For each View, note:
   - File path
   - View name
   - Whether it conforms to View protocol
   - Init parameters
   - Number of places it's referenced
   - Dependencies on other Views
```

Output this as: `audit-reports/01-component-inventory.md`

### 1B — Identify Inline Definitions

Search for components defined INSIDE other component files rather than in their own dedicated files:

**React patterns to flag:**
- `const ComponentName = () =>` or `function ComponentName()` defined inside another component's file but not exported as the primary component
- Anonymous components passed as props: `render={() => <div>...</div>}`
- Inline styled wrappers: `const Wrapper = styled.div` defined locally
- Complex JSX blocks (10+ lines) that repeat across files
- `React.memo()` wrapping inline definitions
- Render functions: `const renderItem = () =>` inside components

**SwiftUI patterns to flag:**
- `struct SomeView: View` defined inside another View's file
- Complex `@ViewBuilder` computed properties that could be standalone Views
- Repeated modifier chains (3+ modifiers) applied identically across files
- Inline shape/style definitions that repeat
- Custom `ButtonStyle`, `TextFieldStyle`, etc. defined inline rather than shared

Output this as: `audit-reports/02-inline-definitions.md`

---

## Phase 2: Duplication Analysis

### 2A — Near-Duplicate Detection

Compare all component files and identify:

1. **Exact duplicates**: Identical or near-identical component logic in different files
2. **Structural duplicates**: Same layout/structure with different data (e.g., two card components that only differ in field names)
3. **Pattern duplicates**: Same UI pattern reimplemented slightly differently (e.g., multiple loading states, empty states, error boundaries)

For each duplicate found, provide:
- File paths of all instances
- A diff showing what's identical vs. what varies
- Recommendation: merge into single shared component with props, or keep separate with justification

**Common duplication hotspots to check:**
- Loading/skeleton states
- Empty states ("No data" screens)
- Error displays
- Modal/dialog wrappers
- Form field components (labels + inputs + validation)
- Card/list item layouts
- Status badges/pills
- Table column renderers
- Chart wrapper components
- Navigation elements
- Metric display cards (KPI tiles)

Output this as: `audit-reports/03-duplication-analysis.md`

### 2B — Tailwind Pattern Duplication (Web)

Search for repeated Tailwind class combinations that indicate a missing component:

```
Find all className strings in the codebase.
Group by similarity (80%+ overlap in classes).
Flag any group that appears 3+ times as a candidate for component extraction.

Example finding:
"rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
  → Found in 12 files
  → Recommendation: Extract as <Card> component
```

Output this as: `audit-reports/04-tailwind-patterns.md`

---

## Phase 3: Dependency & Import Analysis

### 3A — Import Graph

Generate a component dependency graph:

```
For each component:
- What shared components does it import?
- What does it define inline that SHOULD be a shared import?
- Are there circular dependencies?
- Are there components imported but never used?
```

### 3B — Barrel File Audit

Check that the shared component library has proper barrel files:

```
- Does components/index.ts exist and export everything?
- Are there components in the shared directory NOT exported from the barrel?
- Are imports using the barrel (@/components) or direct paths (@/components/Button/Button)?
- Recommend consistent import strategy
```

Output this as: `audit-reports/05-dependency-analysis.md`

---

## Phase 4: Component Quality Assessment

For each existing shared component, evaluate:

### Props Interface Quality
- Are props typed with TypeScript interfaces (not inline types)?
- Are default values provided where sensible?
- Are callback props properly typed (not `any`)?
- Is the component flexible enough, or are there hardcoded values that should be props?

### Composition Patterns
- Does the component support `children` where appropriate?
- Does it use compound component patterns where needed (e.g., `<Card><Card.Header /><Card.Body /></Card>`)?
- Are there render props or slot patterns that would improve flexibility?

### Accessibility
- Do interactive components have proper ARIA attributes?
- Are keyboard interactions handled?
- Do form components have proper label associations?

### Design Token Usage
- Is the component using design tokens from the Tailwind config (not hardcoded colors/spacing)?
- Is it following the 8px grid system?
- Are enterprise design patterns (Linear/Stripe/Vercel inspired) consistently applied?

Output this as: `audit-reports/06-quality-assessment.md`

---

## Phase 5: Extraction Recommendations

### Priority Tiers

Categorize every finding into:

**P0 — Extract Immediately** (used 5+ times, or duplicated with bugs/inconsistencies)
- Component name
- Current locations (all file paths)
- Proposed shared component API (props interface)
- Migration steps

**P1 — Extract Soon** (used 3-4 times, or growing pattern)
- Same details as P0

**P2 — Extract When Touched** (used 2 times, or potential future reuse)
- Same details as P0

**P3 — Keep Inline** (truly one-off, tightly coupled to parent)
- Justification for keeping inline

### For Each Extraction Recommendation, Provide:

```typescript
// Proposed component signature
interface ProposedComponentProps {
  // typed props
}

// Example usage showing how current inline code becomes a shared import
// Before:
<div className="rounded-lg border...">
  <h3>{title}</h3>
  <p>{description}</p>
</div>

// After:
<Card title={title} description={description} />
```

Output this as: `audit-reports/07-extraction-plan.md`

---

## Phase 6: Summary Report

Create an executive summary with:

1. **Metrics:**
   - Total components in shared library
   - Total inline component definitions found
   - Total duplicate patterns found
   - Estimated number of new shared components needed

2. **Top 10 highest-impact extractions** (by frequency × complexity)

3. **Architecture recommendations:**
   - Proposed component directory structure
   - Naming conventions
   - File organization patterns (co-located styles, tests, stories)

4. **Estimated effort:** T-shirt size (S/M/L) for each extraction

Output this as: `audit-reports/00-executive-summary.md`

---

## Execution Instructions

1. Start by examining the project root directory structure
2. Work through each phase sequentially — do NOT skip phases
3. Create all output files in the `audit-reports/` directory at the project root
4. Use concrete file paths and line numbers in every finding
5. Include code snippets showing the actual inline definitions found
6. Cross-reference findings between web and iOS — shared patterns should be noted
7. If the project uses a monorepo structure, audit each package independently then cross-reference
8. Run `grep -r` and AST-level analysis, not just file browsing
9. For each finding, include a severity indicator: 🔴 Critical, 🟡 Moderate, 🟢 Minor
10. Keep the tone constructive — this is about improving architecture, not criticizing existing code

---

## Expected File Structure

```
audit-reports/
├── 00-executive-summary.md
├── 01-component-inventory.md
├── 02-inline-definitions.md
├── 03-duplication-analysis.md
├── 04-tailwind-patterns.md
├── 05-dependency-analysis.md
├── 06-quality-assessment.md
└── 07-extraction-plan.md
```
