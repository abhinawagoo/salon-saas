'use client'

/**
 * Upload a file to R2 (via presigned URL for videos, or through the server for images).
 * Uses presigned URL for video files so large uploads bypass the serverless function body limit.
 */
export async function uploadFile(
  file: File,
  folder: string
): Promise<string> {
  const isVideo = file.type === 'video/mp4'

  if (isVideo) {
    // Get a presigned PUT URL from the server
    const presignRes = await fetch('/api/admin/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, fileName: file.name, fileType: file.type }),
    })
    const presignData = await presignRes.json().catch(() => ({}))
    if (!presignRes.ok) {
      throw new Error(presignData.error || 'Failed to get upload URL')
    }

    const { presignedUrl, publicUrl } = presignData as { presignedUrl: string; publicUrl: string }

    // Upload directly to R2 — bypasses the serverless function size limit
    const uploadRes = await fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    })
    if (!uploadRes.ok) {
      throw new Error(`Direct upload to storage failed (${uploadRes.status})`)
    }

    return publicUrl
  }

  // Image: use the existing server-side upload route
  const formData = new FormData()
  formData.set('file', file)
  formData.set('type', folder)
  const res = await fetch('/api/admin/upload', { method: 'POST', body: formData })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 413) throw new Error('File too large. Please use a smaller image (max 10MB).')
    throw new Error((data as { error?: string }).error || 'Upload failed')
  }
  const url = (data as { url?: string }).url
  if (!url) throw new Error('Upload did not return a valid URL')
  return url
}
