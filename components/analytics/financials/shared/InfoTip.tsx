// Hover tooltip with info icon
// Shows explanatory text on hover

interface InfoTipProps {
  text: string
}

export function InfoTip({ text }: InfoTipProps) {
  return (
    <div className="group relative inline-flex">
      <svg
        className="w-3.5 h-3.5 text-slate-400 cursor-help"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
        />
      </svg>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-normal z-50 min-w-[180px] max-w-xs text-center shadow-lg normal-case tracking-normal font-normal">
        {text}
      </div>
    </div>
  )
}
