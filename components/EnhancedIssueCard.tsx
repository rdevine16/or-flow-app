// components/EnhancedIssueCard.tsx
// Enhanced issue card that shows actual code context and smart fixes

'use client'

import { useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon, CodeBracketIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

interface Issue {
  id: string
  pattern: string
  category: string
  file: string
  line: number
  severity: 'safe' | 'review'
  description: string
  
  // Enhanced fields
  context?: {
    beforeCode: string
    targetCode: string
    afterCode: string
    startLine: number
    endLine: number
  }
  
  relatedLocations?: Array<{
    line: number
    code: string
    type: string
  }>
  
  specificFix?: {
    before: string
    after: string
    explanation: string
  }
  
  metadata?: {
    paginationType?: 'server-side' | 'client-side'
    confidence?: 'high' | 'medium' | 'low'
    autoFixable?: boolean
  }
  
  suggestion: string
  requiredImports?: string
  before?: string
  after?: string
}

export function EnhancedIssueCard({ issue }: { issue: Issue }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }
  
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Header - Always Visible */}
      <div 
        className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-slate-900">{issue.pattern}</h3>
              
              {/* Badges */}
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                issue.severity === 'safe' 
                  ? 'bg-green-50 text-green-600 border border-green-200' 
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {issue.severity === 'safe' ? 'Safe Fix' : 'Review'}
              </span>
              
              {issue.metadata?.autoFixable && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  Auto-Fixable
                </span>
              )}
              
              {issue.metadata?.paginationType && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                  {issue.metadata.paginationType}
                </span>
              )}
            </div>
            
            <p className="text-sm text-slate-600 mt-1">{issue.description}</p>
            
            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
              <span className="font-mono">{issue.file}</span>
              <span>Line {issue.line}</span>
              {issue.relatedLocations && (
                <span className="text-blue-600">
                  +{issue.relatedLocations.length} related locations
                </span>
              )}
            </div>
          </div>
          
          <button className="text-slate-400 hover:text-slate-600 transition-colors">
            {isExpanded ? (
              <ChevronUpIcon className="w-5 h-5" />
            ) : (
              <ChevronDownIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-200 bg-slate-50">
          {/* Actual Code Context */}
          {issue.context && (
            <div className="p-4 border-b border-slate-200 bg-white">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <CodeBracketIcon className="w-4 h-4" />
                  Your Actual Code (Lines {issue.context.startLine}-{issue.context.endLine})
                </h4>
                <button
                  onClick={() => copyToClipboard(
                    issue.context!.beforeCode + '\n' + 
                    issue.context!.targetCode + '\n' + 
                    issue.context!.afterCode
                  )}
                  className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-100 transition-colors"
                >
                  {isCopied ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
              
              <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm font-mono">
                  {/* Before code (dimmed) */}
                  <code className="text-slate-500">
                    {issue.context.beforeCode}
                  </code>
                  
                  {'\n'}
                  
                  {/* Target line (highlighted) */}
                  <code className="bg-yellow-500/20 text-yellow-200 px-1">
                    {issue.context.targetCode}
                  </code>
                  
                  <span className="text-red-400 ml-2">← Line {issue.line}</span>
                  
                  {'\n'}
                  
                  {/* After code (dimmed) */}
                  <code className="text-slate-500">
                    {issue.context.afterCode}
                  </code>
                </pre>
              </div>
            </div>
          )}
          
          {/* Related Locations */}
          {issue.relatedLocations && issue.relatedLocations.length > 0 && (
            <div className="p-4 border-b border-slate-200">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">
                Related Code Locations ({issue.relatedLocations.length})
              </h4>
              <div className="space-y-2">
                {issue.relatedLocations.map((loc, i) => (
                  <div key={i} className="bg-white rounded p-2 border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">Line {loc.line}</span>
                      <span className="text-xs px-2 py-0.5 bg-slate-100 rounded">{loc.type}</span>
                    </div>
                    <code className="text-xs font-mono text-slate-700 block">
                      {loc.code}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Specific Fix */}
          {issue.specificFix && (
            <div className="p-4 border-b border-slate-200 bg-white">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">
                How to Fix
              </h4>
              
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-xs text-red-600 font-medium mb-1">BEFORE (Delete):</p>
                  <div className="bg-red-50 border border-red-200 rounded p-2">
                    <code className="text-xs font-mono text-red-900 block whitespace-pre-wrap">
                      {issue.specificFix.before}
                    </code>
                  </div>
                </div>
                
                <div>
                  <p className="text-xs text-green-600 font-medium mb-1">AFTER (Replace with):</p>
                  <div className="bg-green-50 border border-green-200 rounded p-2">
                    <code className="text-xs font-mono text-green-900 block whitespace-pre-wrap">
                      {issue.specificFix.after}
                    </code>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-xs font-semibold text-blue-900 mb-1">Why?</p>
                <p className="text-xs text-blue-800">{issue.specificFix.explanation}</p>
              </div>
            </div>
          )}
          
          {/* Required Imports */}
          {issue.requiredImports && (
            <div className="p-4 border-b border-slate-200">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">
                Required Import (add to top of file)
              </h4>
              <div className="bg-slate-900 rounded p-3 flex items-center justify-between">
                <code className="text-sm font-mono text-green-400">
                  {issue.requiredImports}
                </code>
                <button
                  onClick={() => copyToClipboard(issue.requiredImports!)}
                  className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
          
          {/* Actions */}
          <div className="p-4 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              {issue.metadata?.confidence && (
                <span>
                  Confidence: <span className={`font-semibold ${
                    issue.metadata.confidence === 'high' ? 'text-green-600' :
                    issue.metadata.confidence === 'medium' ? 'text-amber-700' :
                    'text-red-600'
                  }`}>{issue.metadata.confidence}</span>
                </span>
              )}
            </div>
            
            <div className="flex gap-2">
              <button className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white transition-colors">
                Skip
              </button>
              <button className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4" />
                Mark as Fixed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
