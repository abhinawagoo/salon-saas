import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteFromR2ByUrl } from '@/lib/r2'

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

type SettingsRow = { brandName: string; menuLabel: string; heroVideoUrls: string | null; galleryImageUrls: string | null; invoiceWebsite: string | null; invoiceGst: string | null; invoiceUpiId: string | null; invoiceTerms: string | null; invoiceSignatureUrl: string | null; facebookUrl: string | null; instagramUrl: string | null }

const defaultSettings = {
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
    let rows: SettingsRow[]
    try {
      rows = await prisma.$queryRaw<SettingsRow[]>`
        SELECT "brandName", "menuLabel", "heroVideoUrls", "galleryImageUrls",
          "invoiceWebsite", "invoiceGst", "invoiceUpiId", "invoiceTerms", "invoiceSignatureUrl",
          "facebookUrl", "instagramUrl"
        FROM "SiteCustomization" WHERE id = 1 LIMIT 1
      `
    } catch {
      try {
        const fallback = await prisma.$queryRaw<Omit<SettingsRow, 'facebookUrl' | 'instagramUrl'>[]>`
          SELECT "brandName", "menuLabel", "heroVideoUrls", "galleryImageUrls",
            "invoiceWebsite", "invoiceUpiId", "invoiceTerms"
          FROM "SiteCustomization" WHERE id = 1 LIMIT 1
        `
        if (!fallback.length) return NextResponse.json(defaultSettings)
        const s = fallback[0]
        return NextResponse.json({
          ...defaultSettings,
          brandName: s.brandName,
          menuLabel: s.menuLabel,
          heroVideoUrls: parseJsonArray(s.heroVideoUrls),
          galleryImageUrls: parseJsonArray(s.galleryImageUrls),
          invoiceWebsite: s.invoiceWebsite ?? null,
          invoiceGst: (s as { invoiceGst?: string | null }).invoiceGst ?? null,
          invoiceUpiId: s.invoiceUpiId ?? null,
          invoiceTerms: s.invoiceTerms ?? null,
          facebookUrl: null,
          instagramUrl: null,
        })
      } catch {
        const minimal = await prisma.$queryRaw<{ brandName: string; menuLabel: string }[]>`
          SELECT "brandName", "menuLabel" FROM "SiteCustomization" WHERE id = 1 LIMIT 1
        `
        if (!minimal.length) return NextResponse.json(defaultSettings)
        return NextResponse.json({ ...defaultSettings, brandName: minimal[0].brandName, menuLabel: minimal[0].menuLabel })
      }
    }
    if (!rows.length) return NextResponse.json(defaultSettings)
    const s = rows[0]
    return NextResponse.json({
      brandName: s.brandName,
      menuLabel: s.menuLabel,
      heroBannerImageUrl: null,
      heroVideoUrls: parseJsonArray(s.heroVideoUrls),
      galleryImageUrls: parseJsonArray(s.galleryImageUrls),
      invoiceWebsite: s.invoiceWebsite ?? null,
      invoiceGst: s.invoiceGst ?? null,
      invoiceUpiId: s.invoiceUpiId ?? null,
      invoiceTerms: s.invoiceTerms ?? null,
      invoiceSignatureUrl: (s as SettingsRow).invoiceSignatureUrl ?? null,
      facebookUrl: s.facebookUrl ?? null,
      instagramUrl: s.instagramUrl ?? null,
    })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

async function updateSettings(request: Request) {
  try {
    const body = await request.json()
    const { brandName, menuLabel, heroVideoUrls, galleryImageUrls, invoiceWebsite, invoiceGst, invoiceUpiId, invoiceTerms, invoiceSignatureUrl, facebookUrl, instagramUrl } = body

    const heroArr = Array.isArray(heroVideoUrls) ? heroVideoUrls.slice(0, 20) : []
    const galleryArr = Array.isArray(galleryImageUrls)
      ? galleryImageUrls.filter((u): u is string => typeof u === 'string' && u.length > 0).slice(0, 50)
      : []

    // Delete from R2 any gallery/hero URLs that were removed (best-effort; don't fail save)
    try {
      const existing = await prisma.siteCustomization.findUnique({
        where: { id: 1 },
        select: { heroVideoUrls: true, galleryImageUrls: true },
      })
      if (existing) {
        const oldHero = parseJsonArray(existing.heroVideoUrls)
        const oldGallery = parseJsonArray(existing.galleryImageUrls)
        const removedHero = oldHero.filter((u) => !heroArr.includes(u))
        const removedGallery = oldGallery.filter((u) => !galleryArr.includes(u))
        for (const url of [...removedHero, ...removedGallery]) {
          if (url && typeof url === 'string') {
            try {
              await deleteFromR2ByUrl(url)
            } catch {
              // Ignore per-URL failures; save should succeed
            }
          }
        }
      }
    } catch {
      // Ignore; settings save must succeed even if R2 cleanup fails
    }
    const brand = (brandName !== undefined ? String(brandName).trim() : null) || 'Salon'
    const menu = (menuLabel !== undefined ? String(menuLabel).trim() : null) || 'Services'
    const invWeb = invoiceWebsite !== undefined ? String(invoiceWebsite).trim() || null : undefined
    const invGst = invoiceGst !== undefined ? String(invoiceGst).trim() || null : undefined
    const invUpi = invoiceUpiId !== undefined ? String(invoiceUpiId).trim() || null : undefined
    const invTerms = invoiceTerms !== undefined ? String(invoiceTerms).trim() || null : undefined
    const invSig = invoiceSignatureUrl !== undefined ? String(invoiceSignatureUrl).trim() || null : undefined
    const fbUrl = facebookUrl !== undefined ? String(facebookUrl).trim() || null : undefined
    const igUrl = instagramUrl !== undefined ? String(instagramUrl).trim() || null : undefined

    const s = await prisma.siteCustomization.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        brandName: brand,
        menuLabel: menu,
        heroVideoUrls: JSON.stringify(heroArr),
        galleryImageUrls: JSON.stringify(galleryArr),
        invoiceWebsite: invWeb ?? null,
        invoiceGst: invGst ?? null,
        invoiceUpiId: invUpi ?? null,
        invoiceTerms: invTerms ?? null,
        invoiceSignatureUrl: invSig ?? null,
        facebookUrl: fbUrl ?? null,
        instagramUrl: igUrl ?? null,
      },
      update: {
        brandName: brand,
        menuLabel: menu,
        heroVideoUrls: JSON.stringify(heroArr),
        galleryImageUrls: JSON.stringify(galleryArr),
        ...(invWeb !== undefined && { invoiceWebsite: invWeb }),
        ...(invGst !== undefined && { invoiceGst: invGst }),
        ...(invUpi !== undefined && { invoiceUpiId: invUpi }),
        ...(invTerms !== undefined && { invoiceTerms: invTerms }),
        ...(invSig !== undefined && { invoiceSignatureUrl: invSig }),
        ...(fbUrl !== undefined && { facebookUrl: fbUrl }),
        ...(igUrl !== undefined && { instagramUrl: igUrl }),
      },
    })

    const r = s
    return NextResponse.json({
      brandName: r?.brandName ?? 'Salon',
      menuLabel: r?.menuLabel ?? 'Services',
      heroBannerImageUrl: null,
      heroVideoUrls: parseJsonArray(r?.heroVideoUrls ?? null),
      galleryImageUrls: parseJsonArray(r?.galleryImageUrls ?? null),
      invoiceWebsite: r?.invoiceWebsite ?? null,
      invoiceGst: r?.invoiceGst ?? null,
      invoiceUpiId: r?.invoiceUpiId ?? null,
      invoiceTerms: r?.invoiceTerms ?? null,
      invoiceSignatureUrl: r?.invoiceSignatureUrl ?? null,
      facebookUrl: r?.facebookUrl ?? null,
      instagramUrl: r?.instagramUrl ?? null,
    })
  } catch (error) {
    console.error('Error updating settings:', error)
    const message = error instanceof Error ? error.message : 'Failed to update settings'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  return updateSettings(request)
}

/** POST also supported – some CDNs/proxies (e.g. Cloudflare) block PUT; POST works everywhere */
export async function POST(request: Request) {
  return updateSettings(request)
}
