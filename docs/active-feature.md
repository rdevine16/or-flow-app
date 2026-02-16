# Feature: Milestone Settings Pages Redesign

## Goal

Redesign the three milestone settings pages (Milestones, Procedure Milestones, Surgeon Milestones) to match the reference UI in `docs/orbit-milestones-combined.jsx`. The redesign introduces a unified visual language with phase-colored blocks, paired milestone brackets, boundary markers, inheritance breadcrumbs, and a master–detail layout for procedure and surgeon pages.

## Reference File

`apps/web/or-flow-app/docs/orbit-milestones-combined.jsx` — A standalone React demo containing all three pages in a single component. This is the **visual spec**, not production code. The actual implementation must use our existing stack (TypeScript, shadcn/ui, Supabase, DAL pattern, `useSupabaseQuery`). **Always read this file when implementing any milestone settings page** — it contains the exact layout, spacing, colors, and interaction patterns.

---

## Page 1: Milestones (Facility Level)

### Layout
- Full-width content area (max-width ~620px, centered)
- Header: title "Milestones", subtitle, "Add Milestone" button (blue, top-right)
- Pair issue banner in header if any pair violations exist

### Phase Blocks
- Milestones grouped by phase: **Pre-Op** (blue #3B82F6), **Surgical** (green #22C55E), **Closing** (amber #F59E0B), **Post-Op** (purple #8B5CF6)
- Each phase block has:
  - Left color border (2.5px solid phase color)
  - Collapsible header with phase label, milestone count, chevron
  - Background tint on header (`{phaseColor}06`)

### Boundary Milestones
- Displayed as pill-shaped markers **between** phase blocks (not inside them)
- Visual: colored dot (solid or split gradient) + vertical colored line + pill with milestone name + lock icon
- Examples: "Patient In Room" (before Pre-Op), "Incision" (between Pre-Op and Surgical), "Closing" (between Surgical and Closing), "Patient Out" (between Closing and Post-Op)
- **Cannot** be deleted, toggled, or reordered — always locked

### Optional Milestones (inside phase blocks)
- Numbered rows (sequential counter across all phases)
- Each row: grip handle (drag) + number + milestone name + delete button (on hover)
- Row height: 34px
- Drag-and-drop reorder within each phase
- Hover state: light gray background (#F8FAFC)

### Paired Milestones
- START/END pairs connected by SVG bracket visualization
- Bracket: vertical line with horizontal ticks at start/end, filled dots at endpoints
- Bracket colors per pair group:
  - Anesthesia: blue (#3B82F6)
  - Prep/Drape: green (#22C55E)
  - Closing: amber (#F59E0B)
  - Table Setup: pink (#EC4899)
- Each paired milestone shows: colored START/END badge + arrow + partner name
- Milestones between a pair get small dots on the bracket line (opacity 0.35)
- Bracket lanes: multiple pairs can nest without overlapping (lane allocation algorithm)

### Pair Issue Detection
- Red warning if: pair split across phases, or END appears before START
- Red alert icon on affected rows and in phase header
- Global pair issue count shown in page header

### Add Milestone Modal
- Fields: Milestone Name (text), Phase (button group for Pre-Op/Surgical/Closing/Post-Op), Pair With (optional dropdown of unpaired milestones in selected phase), Pair Role (START/END buttons, shown only when pairing)
- Auto-generates slug ID from name
- Inserts at end of selected phase's optional milestones

### Summary Footer
- "{total} total · {boundary} boundary · {optional} optional"

---

## Page 2: Procedure Milestones

### Layout — Master/Detail Split
- **Left panel** (280px): Searchable, filterable procedure list
- **Right panel** (flex): Selected procedure's milestone configuration

### Left Panel — Procedure List
- Search input at top (magnifying glass icon)
- Filter tabs below search: All ({count}), Customized ({count}), Default ({count}), Surg. Overrides ({count})
  - "Surg. Overrides" filter highlighted purple when active
- Each procedure row:
  - Procedure name (bold if selected)
  - Subtitle: "{N} override(s)" or "Default"
  - Surgeon override indicator: purple user icon + count (if surgeons override this procedure)
  - Status dots: amber dot = customized, purple dot = has surgeon overrides
  - Selected state: blue background (#EFF6FF) + blue border

### Right Panel — Procedure Detail
- **Header bar**: Procedure name + CUSTOMIZED/DEFAULT badge + "{N}/{total} milestones active" + Reset button (if customized)
- **Inheritance breadcrumb**: `Facility Default → {Procedure Name}` — active level highlighted blue
- **Surgeon override banner** (purple, shown when surgeons override this procedure):
  - "{N} surgeon(s) override this:"
  - Clickable surgeon name chips → navigate to surgeon page with that surgeon+procedure selected

### Milestone Configuration
- Same phase block structure as Page 1
- Phase headers show: phase label + "{enabled}/{total}" count
- Each row: checkbox (blue when on) + milestone name
- Toggling changes only the selected procedure's config
- **Override indicators**:
  - Amber "OVERRIDE" badge on milestones that differ from facility default
  - "was on/off" text showing the parent (facility default) value
  - Amber row background for overridden milestones
- Disabled milestones: line-through text, 0.4 opacity
- Boundary milestones: still shown as locked markers, cannot be toggled
- Drag-and-drop reorder within phases

---

## Page 3: Surgeon Milestones

### Layout — Master/Detail Split
- **Left panel** (280px): Searchable surgeon list
- **Right panel** (flex): Selected surgeon's procedure overrides

### Left Panel — Surgeon List
- Search input at top
- Each surgeon row:
  - Avatar circle (initials, 28px, purple background if has overrides, gray if not)
  - Surgeon name (bold if selected)
  - Subtitle: specialty + override count (e.g., "Orthopedic Spine · 2 procedures")
  - Purple dot if has overrides
  - Selected state: blue background + blue border
- Notification dot on sidebar icon if any surgeon has overrides

### Right Panel — Surgeon Detail
- **Header**: Avatar (larger, 30px) + surgeon name + specialty
- **Procedure Overrides section**:
  - Label: "Procedure Overrides ({count})"
  - Procedure chips/tabs: each shows procedure name + purple dot (if has diff) or "no diff" text
  - Each chip has X button to remove that procedure override
  - Selected chip: blue border + blue background
- **"Add Procedure Override" button**: dashed border, full width, opens dropdown
  - Dropdown: search input + scrollable procedure list (excludes already-added procedures)

### When a Procedure is Selected
- **Inheritance breadcrumb**: `Facility Default → {Procedure Name} → {Surgeon Last Name}` — active level highlighted blue
- **Active milestone count**: "{N}/{total} active · {N} override(s)"
- **Reset button** (if surgeon has customized this procedure)
- **Green info banner** (when matching parent config): "Matching {procedure/facility default} config. Toggle any milestone to create a surgeon override."
- **Phase blocks** with checkboxes:
  - Same visual structure as Procedure page
  - "SURGEON" badge (amber) on overridden milestones
  - "was on/off" showing the parent (procedure config) value
  - Boundary milestones locked
  - No drag-and-drop (draggable=false in reference)

### When No Procedure Selected
- Empty state: "No procedure overrides yet" + "Use 'Add Procedure Override' to configure surgeon-specific milestones."

---

## Shared UI Patterns

### Phase Color System
| Phase | Color | Hex |
|-------|-------|-----|
| Pre-Op | Blue | #3B82F6 |
| Surgical | Green | #22C55E |
| Closing | Amber | #F59E0B |
| Post-Op | Purple | #8B5CF6 |

### Pair Color System
| Pair Group | Dot | Background | Border |
|------------|-----|------------|--------|
| Anesthesia | #3B82F6 | #EFF6FF | #93C5FD |
| Prep/Drape | #22C55E | #F0FDF4 | #86EFAC |
| Closing | #F59E0B | #FFFBEB | #FCD34D |
| Table Setup | #EC4899 | #FDF2F8 | #F9A8D4 |

### Inheritance Model (3-tier)
```
Facility Default (base)
  └─ Procedure Override (per procedure type)
       └─ Surgeon Override (per surgeon × procedure)
```
- Each level only stores **diffs** from its parent
- If a level matches its parent exactly, the override record is removed (clean up)
- Reset at any level restores parent values

### Component Patterns
- **BoundaryMarker**: Pill between phases with colored dot + lock icon + vertical line
- **PhaseBlock**: Collapsible section with color border, header counts, milestone rows
- **InheritanceBreadcrumb**: Horizontal chain showing active inheritance level
- **Pair brackets**: SVG-drawn vertical line + ticks + dots connecting START/END pairs
- **Override badges**: Small colored pills (amber "OVERRIDE", amber "SURGEON")
- **Row height**: 34px consistent across all views
- **Drag indicators**: Blue line + dot at insert position during drag-and-drop

---

## Database Tables Involved

| Table | Role |
|-------|------|
| `facility_milestones` | Master milestone definitions (name, phase, boundary, pair info, display order) |
| `procedure_milestone_config` | Per-procedure milestone enable/disable + display order |
| `surgeon_milestone_config` | Per-surgeon per-procedure overrides of enable/disable + display order |
| `milestone_types` | Global milestone type catalog (source for facility milestones) |
| `procedures` | Procedure type lookup |
| `users` (surgeons) | Surgeon list |

## Data Access

- All queries through DAL (`lib/dal/`) using `useSupabaseQuery`
- Facility-scoped (every query filters by `facility_id`)
- Foreign key is `facility_milestone_id` (v2.0 pattern — never `milestone_type_id`)
- Soft deletes on milestone tables (`is_active = true` filter)

---

## UI/UX Notes

- The reference uses inline styles throughout — the real implementation should use Tailwind CSS classes
- The reference uses custom SVG icons — use lucide-react equivalents (Lock, Check, GripVertical, ChevronDown, AlertTriangle, Search, User, Layers, Clock, ArrowRight, Undo2, Plus, X, Trash2)
- The reference has a left icon sidebar — this maps to the existing settings sidebar navigation (Milestones, Procedure Milestones, Surgeon Milestones are already separate routes)
- Drag-and-drop should use existing DnD solution or `@dnd-kit`
- Modal pattern should use shadcn Dialog component
- Dropdowns should use shadcn Popover + Command for search

## iOS Parity
- [ ] iOS can wait — this is a web settings UI redesign

## Out of Scope
- Creating new database tables or migrations (use existing schema)
- Changing the underlying data model or inheritance logic
- Analytics/reporting pages
- Mobile responsiveness (settings pages are desktop-only)

## Acceptance Criteria
- [ ] Milestones page matches reference: phase blocks, boundary markers, pair brackets, drag reorder, add/delete
- [ ] Procedure Milestones page matches reference: master/detail layout, search/filter, checkboxes, override badges, inheritance breadcrumb, surgeon override banner
- [ ] Surgeon Milestones page matches reference: master/detail layout, surgeon list, procedure chips, add/remove procedure override, inheritance breadcrumb, green info banner
- [ ] Pair issue detection works (split phases, wrong order)
- [ ] Inheritance logic: toggling back to parent value removes override record
- [ ] Reset functionality works at procedure and surgeon levels
- [ ] All data persisted to Supabase via DAL
- [ ] TypeScript strict, no `any` types
- [ ] Tests pass
