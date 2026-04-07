'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, Video, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { setUserRole } from '@/lib/auth'
import { uploadFile } from '@/lib/uploadFile'

interface HomeVideo {
  id: string
  videoUrl: string
  title: string | null
  isActive: boolean
  order: number
}

export default function AdminHomeVideosPage() {
  const [videos, setVideos] = useState<HomeVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    setUserRole('ADMIN')
    fetchVideos()
  }, [])

  const fetchVideos = async () => {
    try {
      const res = await fetch('/api/admin/home-videos')
      const data = await res.json()
      setVideos(Array.isArray(data) ? data : [])
    } catch {
      setVideos([])
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || file.type !== 'video/mp4') {
      alert('Please select an MP4 video file.')
      return
    }
    setUploading(true)
    try {
      const videoUrl = await uploadFile(file, 'home_videos')
      await fetch('/api/admin/home-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl, title: file.name.replace(/\.[^/.]+$/, '') }),
      })
      fetchVideos()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this video?')) return
    try {
      await fetch(`/api/admin/home-videos/${id}`, { method: 'DELETE' })
      fetchVideos()
    } catch {
      alert('Failed to delete')
    }
  }

  const handleToggleActive = async (v: HomeVideo) => {
    try {
      await fetch(`/api/admin/home-videos/${v.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !v.isActive }),
      })
      fetchVideos()
    } catch {
      alert('Failed to update')
    }
  }

  const handleReorder = async (fromIndex: number, toIndex: number) => {
    const reordered = [...videos]
    const [removed] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, removed)
    setVideos(reordered)
    try {
      await Promise.all(
        reordered.map((v, i) =>
          fetch(`/api/admin/home-videos/${v.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: i }),
          })
        )
      )
    } catch {
      fetchVideos()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/admin/customize"
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-700"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Home Videos</h1>
            <p className="text-sm text-gray-500">Short videos for the home page carousel</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Upload Video</h2>
          <p className="text-sm text-gray-500 mb-4">MP4 format. Max 80MB. Videos auto-play on the home page.</p>
          <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 cursor-pointer font-medium text-sm">
            <input type="file" accept="video/mp4" className="hidden" onChange={handleUpload} disabled={uploading} />
            {uploading ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={18} />
                Upload video
              </>
            )}
          </label>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-300 border-t-gray-900 mx-auto" />
          </div>
        ) : videos.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Video className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-600">No videos yet. Upload one above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {videos.map((v, i) => (
              <div
                key={v.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4"
              >
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => i > 0 && handleReorder(i, i - 1)}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    disabled={i === 0}
                    aria-label="Move up"
                  >
                    <ChevronUp size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => i < videos.length - 1 && handleReorder(i, i + 1)}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    disabled={i === videos.length - 1}
                    aria-label="Move down"
                  >
                    <ChevronDown size={18} />
                  </button>
                </div>
                <div className="w-24 h-14 bg-gray-200 rounded-lg overflow-hidden shrink-0">
                  <video src={v.videoUrl} className="w-full h-full object-cover" muted preload="metadata" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{v.title || 'Untitled'}</p>
                  <p className="text-xs text-gray-500 truncate">{v.videoUrl}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleActive(v)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    v.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {v.isActive ? 'Active' : 'Inactive'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(v.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
