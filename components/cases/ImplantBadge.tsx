// components/cases/ImplantBadge.tsx
// Small badge displaying implant size info

interface ImplantBadgeProps {
  label: string
  value: string | null
}

export default function ImplantBadge({ label, value }: ImplantBadgeProps) {
  return (
    <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
      <span className="text-slate-500">{label}: </span>
      <span className="font-semibold text-slate-800">{value || '—'}</span>
    </div>
  )
}