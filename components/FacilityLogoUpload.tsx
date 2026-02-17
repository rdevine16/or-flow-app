// components/FacilityLogoUpload.tsx
// Logo upload component with preview, drag-drop, and delete

'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast/ToastProvider'

interface FacilityLogoUploadProps {
  facilityId: string
  currentLogoUrl: string | null
  onLogoChange: (newUrl: string | null) => void
}

export default function FacilityLogoUpload({ 
  facilityId, 
  currentLogoUrl, 
  onLogoChange 
}: FacilityLogoUploadProps) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()
  
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Handle file selection
  const handleFileSelect = async (file: File) => {
    setError(null)

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!validTypes.includes(file.type)) {
      setError('Please upload a JPG, PNG, GIF, WebP, or SVG file')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('File size must be less than 2MB')
      return
    }

    setUploading(true)

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${facilityId}/logo-${Date.now()}.${fileExt}`

      // Delete old logo if exists
      if (currentLogoUrl) {
        const oldPath = currentLogoUrl.split('/facility-logos/')[1]
        if (oldPath) {
          await supabase.storage.from('facility-logos').remove([oldPath])
        }
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from('facility-logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('facility-logos')
        .getPublicUrl(fileName)

      // Update facility record
      const { error: updateError } = await supabase
        .from('facilities')
        .update({ logo_url: publicUrl })
        .eq('id', facilityId)

      if (updateError) throw updateError

      onLogoChange(publicUrl)
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Upload Failed',
        message: err instanceof Error ? err.message : 'Failed to upload logo'
      })
      setError('Failed to upload logo')
    } finally {
      setUploading(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!currentLogoUrl) return
    if (!confirm('Remove facility logo?')) return

    setDeleting(true)
    setError(null)

    try {
      // Extract path from URL
      const path = currentLogoUrl.split('/facility-logos/')[1]
      if (path) {
        await supabase.storage.from('facility-logos').remove([path])
      }

      // Update facility record
      const { error: updateError } = await supabase
        .from('facilities')
        .update({ logo_url: null })
        .eq('id', facilityId)

      if (updateError) throw updateError

      onLogoChange(null)
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: err instanceof Error ? err.message : 'Failed to remove logo'
      })
      setError('Failed to remove logo')
    } finally {
      setDeleting(false)
    }
  }

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  return (
    <div className="space-y-4">
      {/* Current Logo Preview */}
      {currentLogoUrl ? (
        <div className="flex items-start gap-4">
          <div className="w-24 h-24 rounded-xl border border-slate-200 bg-white p-2 flex items-center justify-center relative">
            <Image
              src={currentLogoUrl}
              alt="Facility logo"
              fill
              className="object-contain"
            />
          </div>
          <div className="flex-1">
            <p className="text-sm text-slate-600 mb-2">Current logo</p>
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
              >
                Replace
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
              >
                {deleting ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Upload Zone */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-slate-600">Uploading...</p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-700">
                Drop logo here or click to upload
              </p>
              <p className="text-xs text-slate-500 mt-1">
                JPG, PNG, GIF, WebP, or SVG • Max 2MB
              </p>
            </>
          )}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}