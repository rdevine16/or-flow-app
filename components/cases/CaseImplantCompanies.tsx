'use client'

interface ImplantCompany {
  id: string
  name: string
}

interface CaseImplantCompaniesProps {
  companies: ImplantCompany[]
  size?: 'sm' | 'md'
  maxDisplay?: number
  className?: string
}

export default function CaseImplantCompanies({
  companies,
  size = 'sm',
  maxDisplay = 2,
  className = '',
}: CaseImplantCompaniesProps) {
  if (companies.length === 0) {
    return null
  }

  const displayCompanies = companies.slice(0, maxDisplay)
  const remainingCount = companies.length - maxDisplay

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2 py-1 text-xs',
  }

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {displayCompanies.map((company) => (
        <span
          key={company.id}
          className={`inline-flex items-center ${sizeClasses[size]} bg-slate-100 text-slate-600 font-medium rounded`}
          title={company.name}
        >
          {company.name}
        </span>
      ))}
      {remainingCount > 0 && (
        <span
          className={`inline-flex items-center ${sizeClasses[size]} bg-slate-100 text-slate-500 font-medium rounded`}
          title={companies.slice(maxDisplay).map(c => c.name).join(', ')}
        >
          +{remainingCount}
        </span>
      )}
    </div>
  )
}

// Larger version for case detail view
interface CaseImplantCompaniesDetailProps {
  companies: ImplantCompany[]
  className?: string
}

export function CaseImplantCompaniesDetail({
  companies,
  className = '',
}: CaseImplantCompaniesDetailProps) {
  if (companies.length === 0) {
    return (
      <span className="text-slate-400 text-sm">No implant companies assigned</span>
    )
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {companies.map((company) => (
        <span
          key={company.id}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          {company.name}
        </span>
      ))}
    </div>
  )
}
