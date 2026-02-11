// components/ui/SearchInput.tsx
import { Search, X } from 'lucide-react'
'use client'


interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onClear?: () => void
  className?: string
  autoFocus?: boolean
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  onClear,
  className = '',
  autoFocus = false,
}: SearchInputProps) {
  const handleClear = () => {
    onChange('')
    onClear?.()
  }

  return (
    <div className={`relative ${className}`}>
      {/* Search icon */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <Search className="w-5 h-5 text-slate-400" />
      </div>

      {/* Input */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="
          w-full
          pl-10
          pr-10
          py-2
          border border-slate-300
          rounded-lg
          text-slate-900
          placeholder:text-slate-400
          focus:outline-none
          focus:ring-2
          focus:ring-blue-500
          focus:border-blue-500
          transition-colors
        "
      />

      {/* Clear button */}
      {value && (
        <button
          onClick={handleClear}
          className="
            absolute
            right-3
            top-1/2
            -translate-y-1/2
            text-slate-400
            hover:text-slate-600
            transition-colors
          "
          aria-label="Clear search"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}

// ============================================
// Usage Examples
// ============================================

/*
// Basic usage
const [search, setSearch] = useState('')

<SearchInput
  value={search}
  onChange={setSearch}
  placeholder="Search cases..."
/>

// With clear callback
<SearchInput
  value={search}
  onChange={setSearch}
  onClear={() => {
    console.log('Search cleared')
    // Reset filters, etc.
  }}
/>

// Auto-focus on mount
<SearchInput
  value={search}
  onChange={setSearch}
  autoFocus
/>

// Custom styling
<SearchInput
  value={search}
  onChange={setSearch}
  className="max-w-md"
/>
*/
