// components/settings/flags/CategoryFilter.tsx
// Segmented control for filtering flag rules by category.
// Includes "All" at start and "Archived" at end.

'use client'

interface CategoryTab {
  key: string
  label: string
}

interface CategoryFilterProps {
  value: string
  onChange: (value: string) => void
  categories: CategoryTab[]
}

export function CategoryFilter({ value, onChange, categories }: CategoryFilterProps) {
  const tabs: CategoryTab[] = [
    { key: 'all', label: 'All' },
    ...categories,
    { key: 'archived', label: 'Archived' },
  ]

  return (
    <div className="inline-flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
      {tabs.map((tab) => {
        const isActive = value === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
