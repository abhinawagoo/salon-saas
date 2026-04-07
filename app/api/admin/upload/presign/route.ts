import { NextResponse } from 'next/server'
import path from 'path'
import { getPresignedUploadUrl, ensureR2Cors, R2_ENABLED, type R2Folder } from '@/lib/r2'

export const dynamic = 'force-dynamic'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_VIDEO_TYPES = ['video/mp4']
const VALID_FOLDERS: R2Folder[] = ['service', 'hero', 'gallery', 'subcategory', 'home_videos', 'location', 'signature']

export async function POST(request: Request) {
  try {
    if (!R2_ENABLED) {
      return NextResponse.json({ error: 'R2 not configured' }, { status: 400 })
    }

    const body = await request.json()
    const { folder, fileName, fileType } = body as { folder: string; fileName: string; fileType: string }

    if (!folder || !VALID_FOLDERS.includes(folder as R2Folder)) {
      return NextResponse.json({ error: 'Invalid folder' }, { status: 400 })
    }

    const isImage = ALLOWED_IMAGE_TYPES.includes(fileType)
    const isVideo = ALLOWED_VIDEO_TYPES.includes(fileType)

    if (folder === 'home_videos' && !isVideo) {
      return NextResponse.json({ error: 'home_videos only accepts MP4 video' }, { status: 400 })
    }
    if (!isImage && !isVideo) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }
    if (folder !== 'hero' && folder !== 'home_videos' && !isImage) {
      return NextResponse.json({ error: 'This folder only accepts images' }, { status: 400 })
    }

    // Ensure CORS is configured so browser can PUT directly to R2
    await ensureR2Cors()

    const ext = isVideo ? '.mp4' : (path.extname(fileName) || '.jpg')
    const result = await getPresignedUploadUrl(folder as R2Folder, ext, fileType)

    if (!result) {
      return NextResponse.json({ error: 'Failed to generate presigned URL' }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('Presign error:', err)
    return NextResponse.json({ error: 'Failed to generate presigned URL' }, { status: 500 })
  }
}
