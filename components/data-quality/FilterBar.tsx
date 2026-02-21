// FilterBar — issue type select, show resolved, bulk actions (Phase 4)
// Placeholder: will be implemented in Phase 4

interface FilterBarProps {
  filterType: string
  onFilterTypeChange: (value: string) => void
  showResolved: boolean
  onShowResolvedChange: (value: boolean) => void
}

export default function FilterBar({ filterType, onFilterTypeChange, showResolved, onShowResolvedChange }: FilterBarProps) {
  return <div data-testid="filter-bar">Filters</div>
}
