'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CaseIssue } from './types'
import { formatCurrency, formatDuration } from './utils'

interface IssuesBadgeProps {
  issues: CaseIssue[]
  caseId: string
}

export default function IssuesBadge({ issues, caseId }: IssuesBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  
  if (issues.length === 0) {
    return (
      <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-500 text-xs font-medium rounded-full">
        Unknown
      </span>
    )
  }
  
  const issueCount = issues.length
  
  // Single issue - show the tag directly
  if (issueCount === 1) {
    const issue = issues[0]
    return (
      <div className="relative inline-block">
        <div
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <Link href={`/cases/${caseId}`}>
            {issue.type === 'overTime' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full cursor-pointer hover:bg-amber-200 transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Over Time
              </span>
            )}
            {issue.type === 'delay' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full cursor-pointer hover:bg-purple-200 transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Delay
              </span>
            )}
            {issue.type === 'lowPayer' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full cursor-pointer hover:bg-blue-200 transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Low Payer
              </span>
            )}
            {issue.type === 'unknown' && (
              <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full cursor-pointer hover:bg-slate-200 transition-colors">
                Unknown
              </span>
            )}
          </Link>
        </div>
        
        {/* Single issue tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
            <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
              {issue.type === 'overTime' && (
                <div>
                  <p className="font-medium mb-1">Over Time</p>
                  <p>{formatDuration(issue.actualMinutes)} vs {formatDuration(issue.expectedMinutes)} expected</p>
                  <p className="text-amber-300">+{issue.percentOver.toFixed(0)}% over average</p>
                </div>
              )}
              {issue.type === 'delay' && (
                <div>
                  <p className="font-medium mb-1">Recorded Delays</p>
                  {issue.delays.map((d, i) => (
                    <p key={i}>• {d.name}{d.minutes ? ` (${d.minutes} min)` : ''}</p>
                  ))}
                  {issue.totalMinutes > 0 && (
                    <p className="text-purple-300 mt-1">Total: {issue.totalMinutes} min</p>
                  )}
                </div>
              )}
              {issue.type === 'lowPayer' && (
                <div>
                  <p className="font-medium mb-1">Low Payer Rate</p>
                  <p>{issue.payerName}: {formatCurrency(issue.payerRate)}</p>
                  <p>vs Default: {formatCurrency(issue.defaultRate)}</p>
                  <p className="text-blue-300">-{issue.percentBelow.toFixed(0)}% below</p>
                </div>
              )}
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
          </div>
        )}
      </div>
    )
  }
  
  // Multiple issues - show count badge
  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Link href={`/cases/${caseId}`}>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full cursor-pointer hover:bg-red-200 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {issueCount} Issues
          </span>
        </Link>
      </div>
      
      {/* Multi-issue tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50">
          <div className="bg-slate-900 text-white text-xs rounded-lg px-4 py-3 shadow-lg min-w-[200px]">
            <div className="space-y-3">
              {issues.map((issue, i) => (
                <div key={i} className={i > 0 ? 'pt-2 border-t border-slate-700' : ''}>
                  {issue.type === 'overTime' && (
                    <div>
                      <div className="flex items-center gap-1.5 font-medium text-amber-300 mb-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Over Time
                      </div>
                      <p className="text-slate-300">{formatDuration(issue.actualMinutes)} vs {formatDuration(issue.expectedMinutes)}</p>
                      <p className="text-slate-400">+{issue.percentOver.toFixed(0)}% over average</p>
                    </div>
                  )}
                  {issue.type === 'delay' && (
                    <div>
                      <div className="flex items-center gap-1.5 font-medium text-purple-300 mb-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Delays
                      </div>
                      {issue.delays.slice(0, 3).map((d, j) => (
                        <p key={j} className="text-slate-300">• {d.name}{d.minutes ? ` (${d.minutes}m)` : ''}</p>
                      ))}
                      {issue.delays.length > 3 && (
                        <p className="text-slate-400">+{issue.delays.length - 3} more</p>
                      )}
                    </div>
                  )}
                  {issue.type === 'lowPayer' && (
                    <div>
                      <div className="flex items-center gap-1.5 font-medium text-blue-300 mb-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Low Payer
                      </div>
                      <p className="text-slate-300">{issue.payerName}</p>
                      <p className="text-slate-400">{formatCurrency(issue.payerRate)} vs {formatCurrency(issue.defaultRate)}</p>
                    </div>
                  )}
                  {issue.type === 'unknown' && (
                    <div>
                      <p className="text-slate-400">Unknown cause</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  )
}
