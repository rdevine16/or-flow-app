'use client'

interface MilestoneButtonProps {
  name: string
  displayName: string
  recordedAt?: string | null
  onRecord: () => void
  onUndo: () => void
  disabled?: boolean
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export default function MilestoneButton({
  name,
  displayName,
  recordedAt,
  onRecord,
  onUndo,
  disabled = false,
}: MilestoneButtonProps) {
  const isRecorded = !!recordedAt

  return (
    <div
      className={`relative rounded-2xl border-2 h-full flex flex-col transition-all duration-300 ${
        isRecorded
          ? 'bg-gradient-to-b from-emerald-50 to-emerald-100 border-emerald-400'
          : 'bg-white border-slate-200 hover:border-teal-400 hover:shadow-lg'
      }`}
    >
      <button
        type="button"
        onClick={onRecord}
        disabled={disabled || isRecorded}
        className={`flex-1 flex flex-col items-center justify-center p-6 ${
          isRecorded ? 'cursor-default' : disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer active:scale-95'
        } transition-transform`}
      >
        {/* Checkmark for recorded */}
        {isRecorded && (
          <div className="absolute top-3 right-3">
            <div className="w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        )}

        {/* Milestone Name */}
        <div
          className={`text-base font-semibold text-center mb-3 leading-tight ${
            isRecorded ? 'text-emerald-800' : 'text-slate-900'
          }`}
        >
          {displayName}
        </div>

        {/* Timestamp or Tap Instruction */}
        {isRecorded ? (
          <div className="text-2xl font-bold text-emerald-600 font-mono">{formatTime(recordedAt)}</div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
                <circle cx="12" cy="12" r="9" strokeWidth={2} />
              </svg>
            </div>
            <span className="text-slate-400 text-sm">Tap to record</span>
          </div>
        )}
      </button>

      {/* Undo Button */}
      {isRecorded && (
        <button
          type="button"
          onClick={onUndo}
          className="absolute bottom-3 right-3 p-2 text-emerald-600 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Undo"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h10a5 5 0 015 5v2M3 10l6 6m-6-6l6-6"
            />
          </svg>
        </button>
      )}
    </div>
  )
}