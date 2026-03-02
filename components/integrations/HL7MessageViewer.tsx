/**
 * HL7MessageViewer
 *
 * Side-by-side display: raw HL7v2 message (left, monospace) + parsed key-value table (right).
 * Used in both Review Queue and Logs tab.
 */

'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Table2 } from 'lucide-react'

interface HL7MessageViewerProps {
  rawMessage: string | null
  parsedData: Record<string, unknown> | null
  /** Called when raw message is expanded (for PHI audit logging) */
  onRawExpand?: () => void
}

/** Recursively render a parsed data value as a key-value table */
function ParsedValue({ label, value, depth = 0 }: { label: string; value: unknown; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2)

  if (value === null || value === undefined) {
    return (
      <tr className="border-b border-slate-100 last:border-0">
        <td className="px-3 py-1.5 text-xs font-medium text-slate-500 align-top whitespace-nowrap" style={{ paddingLeft: `${12 + depth * 16}px` }}>
          {label}
        </td>
        <td className="px-3 py-1.5 text-xs text-slate-400 italic">null</td>
      </tr>
    )
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return (
      <tr className="border-b border-slate-100 last:border-0">
        <td className="px-3 py-1.5 text-xs font-medium text-slate-500 align-top whitespace-nowrap" style={{ paddingLeft: `${12 + depth * 16}px` }}>
          {label}
        </td>
        <td className="px-3 py-1.5 text-xs text-slate-900 break-all">{String(value)}</td>
      </tr>
    )
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <tr className="border-b border-slate-100 last:border-0">
          <td className="px-3 py-1.5 text-xs font-medium text-slate-500 align-top whitespace-nowrap" style={{ paddingLeft: `${12 + depth * 16}px` }}>
            {label}
          </td>
          <td className="px-3 py-1.5 text-xs text-slate-400 italic">empty array</td>
        </tr>
      )
    }

    return (
      <>
        <tr className="border-b border-slate-100 cursor-pointer hover:bg-slate-50" onClick={() => setExpanded(!expanded)}>
          <td className="px-3 py-1.5 text-xs font-medium text-slate-500 whitespace-nowrap" style={{ paddingLeft: `${12 + depth * 16}px` }}>
            <span className="inline-flex items-center gap-1">
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {label}
            </span>
          </td>
          <td className="px-3 py-1.5 text-xs text-slate-400">{value.length} items</td>
        </tr>
        {expanded && value.map((item, i) => (
          <ParsedValue key={i} label={`[${i}]`} value={item} depth={depth + 1} />
        ))}
      </>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)

    return (
      <>
        <tr className="border-b border-slate-100 cursor-pointer hover:bg-slate-50" onClick={() => setExpanded(!expanded)}>
          <td className="px-3 py-1.5 text-xs font-medium text-slate-500 whitespace-nowrap" style={{ paddingLeft: `${12 + depth * 16}px` }}>
            <span className="inline-flex items-center gap-1">
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {label}
            </span>
          </td>
          <td className="px-3 py-1.5 text-xs text-slate-400">{entries.length} fields</td>
        </tr>
        {expanded && entries.map(([k, v]) => (
          <ParsedValue key={k} label={k} value={v} depth={depth + 1} />
        ))}
      </>
    )
  }

  return null
}

/** Colorize HL7v2 segment types */
function colorizeSegment(segment: string): string {
  const segType = segment.substring(0, 3)
  const colors: Record<string, string> = {
    MSH: 'text-blue-400',
    SCH: 'text-emerald-400',
    PID: 'text-amber-400',
    PV1: 'text-purple-400',
    DG1: 'text-red-400',
    RGS: 'text-slate-400',
    AIS: 'text-cyan-400',
    AIL: 'text-orange-400',
    AIG: 'text-lime-400',
    AIP: 'text-pink-400',
  }
  return colors[segType] || 'text-slate-300'
}

export default function HL7MessageViewer({
  rawMessage,
  parsedData,
  onRawExpand,
}: HL7MessageViewerProps) {
  const [activeView, setActiveView] = useState<'raw' | 'parsed'>(parsedData ? 'parsed' : 'raw')
  const [rawExpanded, setRawExpanded] = useState(false)

  const handleShowRaw = () => {
    setActiveView('raw')
    if (!rawExpanded) {
      setRawExpanded(true)
      onRawExpand?.()
    }
  }

  const segments = rawMessage?.split('\r')?.filter(Boolean) || rawMessage?.split('\n')?.filter(Boolean) || []

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center border-b border-slate-200 bg-slate-50">
        <button
          onClick={() => setActiveView('parsed')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors ${
            activeView === 'parsed'
              ? 'text-blue-700 bg-white border-b-2 border-blue-600 -mb-px'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Table2 className="w-3.5 h-3.5" />
          Parsed Data
        </button>
        {rawMessage && (
          <button
            onClick={handleShowRaw}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors ${
              activeView === 'raw'
                ? 'text-blue-700 bg-white border-b-2 border-blue-600 -mb-px'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Raw HL7v2
          </button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-auto">
        {activeView === 'parsed' && parsedData && (
          <table className="w-full">
            <tbody>
              {Object.entries(parsedData).map(([key, val]) => (
                <ParsedValue key={key} label={key} value={val} />
              ))}
            </tbody>
          </table>
        )}

        {activeView === 'parsed' && !parsedData && (
          <div className="p-6 text-center text-sm text-slate-400">No parsed data available</div>
        )}

        {activeView === 'raw' && rawMessage && (
          <div className="bg-slate-900 p-4">
            <pre className="text-xs font-mono leading-relaxed">
              {segments.map((seg, i) => (
                <div key={i} className={colorizeSegment(seg)}>
                  <span className="text-slate-600 select-none mr-2">{String(i + 1).padStart(2, '0')}</span>
                  {seg}
                </div>
              ))}
            </pre>
          </div>
        )}

        {activeView === 'raw' && !rawMessage && (
          <div className="p-6 text-center text-sm text-slate-400">Raw message not available (may have been purged)</div>
        )}
      </div>
    </div>
  )
}
