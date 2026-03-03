/**
 * SetupInstructionsCard
 *
 * Prominent setup card showing endpoint URL, API key, content types, and curl example.
 * Designed for facility admin to hand off to IT team for Epic integration engine config.
 */

'use client'

import { useState } from 'react'
import {
  Copy,
  Check,
  Eye,
  EyeOff,
  Terminal,
  Globe,
  Key,
  FileText,
} from 'lucide-react'

interface SetupInstructionsCardProps {
  endpointUrl: string
  apiKey: string | undefined
  isActive: boolean
  /** System-specific description (e.g. "Configure your integration engine...") */
  setupDescription?: string
  /** MSH sending app/facility placeholder for curl example (e.g. 'EPIC|FACILITY') */
  curlMshPlaceholder?: string
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
      title={`Copy ${label}`}
    >
      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function SetupInstructionsCard({
  endpointUrl,
  apiKey,
  isActive,
  setupDescription = 'Configure your integration engine (Mirth Connect, Rhapsody) with these settings',
  curlMshPlaceholder = 'EPIC|FACILITY',
}: SetupInstructionsCardProps) {
  const [showKey, setShowKey] = useState(false)

  const maskedKey = apiKey
    ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`
    : 'Not generated'

  const curlExample = `curl -X POST "${endpointUrl}" \\
  -H "Content-Type: application/hl7-v2" \\
  -H "X-Integration-Key: ${apiKey || '<YOUR_API_KEY>'}" \\
  -d 'MSH|^~\\&|${curlMshPlaceholder}|||...'`

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
          <Terminal className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-medium text-slate-900">Setup Instructions</h3>
          <p className="text-sm text-slate-500">
            {setupDescription}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Endpoint URL */}
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Endpoint URL</span>
            </div>
            <CopyButton text={endpointUrl} label="endpoint URL" />
          </div>
          <p className="text-sm font-mono text-slate-800 break-all">{endpointUrl}</p>
        </div>

        {/* API Key */}
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">API Key</span>
            </div>
            <div className="flex items-center gap-1">
              {apiKey && (
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                >
                  {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showKey ? 'Hide' : 'Reveal'}
                </button>
              )}
              {apiKey && <CopyButton text={apiKey} label="API key" />}
            </div>
          </div>
          <p className="text-sm font-mono text-slate-800">
            {showKey && apiKey ? apiKey : maskedKey}
          </p>
        </div>

        {/* Content Types */}
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Supported Content Types</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {['application/hl7-v2', 'text/plain', 'x-application/hl7-v2+er7'].map(ct => (
              <span key={ct} className="inline-flex px-2 py-0.5 text-xs font-mono text-slate-700 bg-white rounded border border-slate-200">
                {ct}
              </span>
            ))}
          </div>
        </div>

        {/* Curl Example */}
        <div className="bg-slate-900 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Example Request</span>
            <CopyButton text={curlExample} label="curl example" />
          </div>
          <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap overflow-x-auto">
            {curlExample}
          </pre>
        </div>

        {/* Status */}
        {!isActive && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <p className="text-sm text-amber-700">Integration is currently inactive. Enable it to start receiving messages.</p>
          </div>
        )}
      </div>
    </div>
  )
}
