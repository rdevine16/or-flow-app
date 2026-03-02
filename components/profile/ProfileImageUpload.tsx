'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Camera, Trash2, ZoomIn, ZoomOut } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast/ToastProvider'
import { Modal } from '@/components/ui/Modal'

// ============================================
// TYPES
// ============================================

interface ProfileImageUploadProps {
  userId: string
  firstName: string
  lastName: string
  email: string
  currentImageUrl: string | null
  onImageChange: (newUrl: string | null) => void
}

// ============================================
// CONSTANTS
// ============================================

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const CROP_SIZE = 400 // 400x400 output
const BUCKET = 'user-avatars'

// ============================================
// HELPERS
// ============================================

function getInitials(firstName: string, lastName: string, email: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase()
  }
  return email?.[0]?.toUpperCase() || 'U'
}

/** Crop the image on a canvas and return a WebP blob */
async function cropImage(imageSrc: string, cropArea: Area): Promise<Blob> {
  const image = new window.Image()
  image.crossOrigin = 'anonymous'

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = reject
    image.src = imageSrc
  })

  const canvas = document.createElement('canvas')
  canvas.width = CROP_SIZE
  canvas.height = CROP_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context')

  ctx.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    CROP_SIZE,
    CROP_SIZE,
  )

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to create image blob'))
      },
      'image/webp',
      0.9,
    )
  })
}

// ============================================
// COMPONENT
// ============================================

export default function ProfileImageUpload({
  userId,
  firstName,
  lastName,
  email,
  currentImageUrl,
  onImageChange,
}: ProfileImageUploadProps) {
  const supabase = createClient()
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Crop state
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [showCropModal, setShowCropModal] = useState(false)

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [imageError, setImageError] = useState(false)

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels)
  }, [])

  // Validate and open crop modal
  const handleFileSelect = (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      showToast({
        type: 'error',
        title: 'Invalid File Type',
        message: 'Please upload a JPG, PNG, or WebP image',
      })
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      showToast({
        type: 'error',
        title: 'File Too Large',
        message: 'Image must be less than 5MB',
      })
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result as string)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedArea(null)
      setShowCropModal(true)
    }
    reader.readAsDataURL(file)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
    // Reset input so re-selecting the same file triggers change
    e.target.value = ''
  }

  // Crop, upload, and save
  const handleSave = async () => {
    if (!imageSrc || !croppedArea) return

    setUploading(true)
    try {
      const blob = await cropImage(imageSrc, croppedArea)
      const fileName = `${userId}/avatar-${Date.now()}.webp`

      // Delete old avatar if it exists
      if (currentImageUrl) {
        const oldPath = currentImageUrl.split(`/${BUCKET}/`)[1]
        if (oldPath) {
          await supabase.storage.from(BUCKET).remove([oldPath])
        }
      }

      // Upload cropped image
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/webp',
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(fileName)

      // Update user record
      const { error: updateError } = await supabase
        .from('users')
        .update({ profile_image_url: publicUrl })
        .eq('id', userId)

      if (updateError) throw updateError

      onImageChange(publicUrl)
      setImageError(false)
      setShowCropModal(false)
      setImageSrc(null)

      showToast({
        type: 'success',
        title: 'Photo Updated',
        message: 'Your profile photo has been saved',
      })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Upload Failed',
        message: err instanceof Error ? err.message : 'Failed to upload photo',
      })
    } finally {
      setUploading(false)
    }
  }

  // Delete current avatar
  const handleDelete = async () => {
    if (!currentImageUrl) return

    setDeleting(true)
    try {
      const oldPath = currentImageUrl.split(`/${BUCKET}/`)[1]
      if (oldPath) {
        await supabase.storage.from(BUCKET).remove([oldPath])
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ profile_image_url: null })
        .eq('id', userId)

      if (updateError) throw updateError

      onImageChange(null)
      setImageError(false)

      showToast({
        type: 'success',
        title: 'Photo Removed',
        message: 'Your profile photo has been removed',
      })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: err instanceof Error ? err.message : 'Failed to remove photo',
      })
    } finally {
      setDeleting(false)
    }
  }

  const closeCropModal = () => {
    setShowCropModal(false)
    setImageSrc(null)
  }

  const showImage = currentImageUrl && !imageError

  return (
    <>
      <div className="flex flex-col items-center text-center mb-6">
        {/* Avatar circle — clickable to upload */}
        <div className="relative group mb-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || deleting}
            className="relative w-24 h-24 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50"
            aria-label="Upload profile photo"
          >
            {showImage ? (
              <Image
                src={currentImageUrl}
                alt="Profile photo"
                fill
                className="object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-500/25">
                {getInitials(firstName, lastName, email)}
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>

          {/* Delete button — only when image exists */}
          {showImage && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="absolute -top-1 -right-1 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
              aria-label="Remove profile photo"
            >
              <Trash2 className="w-3 h-3 text-red-500" />
            </button>
          )}
        </div>

        <p className="text-xs text-slate-400">Click to upload photo</p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Crop modal */}
      <Modal
        open={showCropModal}
        onClose={closeCropModal}
        title="Crop Profile Photo"
        size="sm"
      >
        <div className="space-y-4">
          {/* Crop area */}
          <div className="relative w-full aspect-square bg-slate-900 rounded-xl overflow-hidden">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>

          {/* Zoom slider */}
          <div className="flex items-center gap-3 px-1">
            <ZoomOut className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-600"
              aria-label="Zoom"
            />
            <ZoomIn className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </div>
        </div>

        <Modal.Footer>
          <Modal.Cancel onClick={closeCropModal} />
          <Modal.Action onClick={handleSave} loading={uploading} disabled={!croppedArea}>
            Save Photo
          </Modal.Action>
        </Modal.Footer>
      </Modal>
    </>
  )
}
