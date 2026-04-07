import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function parseJsonArray(str: string | null): string[] {
  if (!str) return []
  try {
    const arr = JSON.parse(str)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

type SettingsRow = { brandName: string; menuLabel: string; heroBannerImageUrl?: string | null; heroVideoUrls: string | null; galleryImageUrls: string | null; currency?: string | null; invoiceWebsite: string | null; invoiceGst?: string | null; invoiceUpiId: string | null; invoiceTerms: string | null; invoiceSignatureUrl?: string | null; facebookUrl?: string | null; instagramUrl?: string | null }

const DEFAULT = {
  brandName: 'Salon',
  menuLabel: 'Services',
  heroBannerImageUrl: null as string | null,
  heroVideoUrls: [] as string[],
  galleryImageUrls: [] as string[],
  invoiceWebsite: null as string | null,
  invoiceGst: null as string | null,
  invoiceUpiId: null as string | null,
  invoiceTerms: null as string | null,
  invoiceSignatureUrl: null as string | null,
  facebookUrl: null as string | null,
  instagramUrl: null as string | null,
}

export async function GET() {
  try {
    // Raw select to avoid P2022 if heroBannerImageUrl (or other columns) not yet in DB
    let rows: SettingsRow[]
    try {
      rows = await prisma.$queryRaw<SettingsRow[]>`
        SELECT "brandName", "menuLabel", "heroBannerImageUrl", "heroVideoUrls", "galleryImageUrls",
          "currency", "invoiceWebsite", "invoiceGst", "invoiceUpiId", "invoiceTerms",
          "invoiceSignatureUrl", "facebookUrl", "instagramUrl"
        FROM "SiteCustomization" WHERE id = 1 LIMIT 1
      `
    } catch {
      const minimal = await prisma.$queryRaw<{ brandName: string; menuLabel: string }[]>`
        SELECT "brandName", "menuLabel" FROM "SiteCustomization" WHERE id = 1 LIMIT 1
      `
      if (!minimal.length) return NextResponse.json(DEFAULT)
      const fallback = { ...DEFAULT, brandName: minimal[0].brandName, menuLabel: minimal[0].menuLabel, invoiceWebsite: null, invoiceGst: null, invoiceUpiId: null, invoiceTerms: null, invoiceSignatureUrl: null, facebookUrl: null, instagramUrl: null }
      if (process.env.NEXT_PUBLIC_HERO_VIDEO_URL) {
        fallback.heroVideoUrls = [process.env.NEXT_PUBLIC_HERO_VIDEO_URL]
      }
      return NextResponse.json(fallback)
    }
    if (!rows.length) return NextResponse.json(DEFAULT)
    const s = rows[0]
    let heroVideoUrls = parseJsonArray(s.heroVideoUrls)
    if (heroVideoUrls.length === 0 && process.env.NEXT_PUBLIC_HERO_VIDEO_URL) {
      heroVideoUrls = [process.env.NEXT_PUBLIC_HERO_VIDEO_URL]
    }
    return NextResponse.json(
      {
        brandName: s.brandName,
        menuLabel: s.menuLabel,
        heroBannerImageUrl: s.heroBannerImageUrl ?? null,
        heroVideoUrls,
        currency: s.currency || 'EUR',
        galleryImageUrls: parseJsonArray(s.galleryImageUrls),
        invoiceWebsite: s.invoiceWebsite ?? null,
        invoiceGst: s.invoiceGst ?? null,
        invoiceUpiId: s.invoiceUpiId ?? null,
        invoiceTerms: s.invoiceTerms ?? null,
        invoiceSignatureUrl: s.invoiceSignatureUrl ?? null,
        facebookUrl: s.facebookUrl ?? null,
        instagramUrl: s.instagramUrl ?? null,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(DEFAULT)
  }
}
