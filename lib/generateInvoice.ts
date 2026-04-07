import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { formatTime12h } from './formatTime'
import { numberToWords } from './numberToWords'
import { formatCurrencyPdf } from './currency'

const SAC_CODE = '9984'
const GST_RATE = 0.18
interface Service {
  id: string
  name: string
  price: number
  quantity?: number
}

export interface InvoiceData {
  bookingToken: string
  date: Date
  timeSlot: string
  locationName?: string
  locationAddress?: string
  locationMobile?: string
  locationImageUrl?: string
  locationImageDataUrl?: string
  services: Service[]
  paymentStatus: string
  totalAmount: number
  amountPaid?: number
  dueAmount?: number
  onlineAmount?: number
  cashAmount?: number
  customerName?: string
  customerMobile?: string
  brandName?: string
  website?: string
  gstNumber?: string
  terms?: string
  invoiceNumber?: string
  signatureDataUrl?: string
  currency?: string
}

const BORDER_COLOR: [number, number, number] = [229, 224, 216] // #E5E0D8
const HEADER_BG: [number, number, number] = [243, 238, 230] // #F3EEE6
const BLACK: [number, number, number] = [30, 30, 30]
const GRAY: [number, number, number] = [100, 100, 100]

export function generateInvoicePDF(data: InvoiceData) {
  const currency = data.currency || 'EUR'
  const fmt = (amount: number, decimals = 2) => formatCurrencyPdf(amount, currency, decimals)
  const doc = new jsPDF({ putOnlyUsedFonts: true })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 24
  const innerPadding = 24
  const contentLeft = margin + innerPadding
  const contentRight = pageWidth - margin - innerPadding
  const contentTop = margin + innerPadding
  const contentBottom = pageHeight - margin - innerPadding
  const sectionSpacing = 20
  let yPos = contentTop

  /** Add new page if content would overflow; draw border on current page before leaving. */
  const checkPageBreak = (spaceNeeded: number, onNewPage?: () => void): void => {
    if (yPos + spaceNeeded > contentBottom) {
      doc.setDrawColor(...BORDER_COLOR)
      doc.setLineWidth(0.5)
      doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin, 'S')
      doc.addPage()
      yPos = contentTop
      onNewPage?.()
    }
  }

  const tableWidth = contentRight - contentLeft
  const cellPad = 10
  const rowH = 14
  const lineHeight = 5
  // Column widths: No 5%, Services 30%, SAC 10%, Qty 10%, Rate 15%, Tax 15%, Total 15% (wider for Rs. amounts)
  const colNo = tableWidth * 0.05
  const colServices = tableWidth * 0.30
  const colSAC = tableWidth * 0.10
  const colQty = tableWidth * 0.10
  const colRate = tableWidth * 0.15
  const colTax = tableWidth * 0.15
  const colTotal = tableWidth * 0.15
  const colX = {
    no: contentLeft,
    services: contentLeft + colNo,
    sac: contentLeft + colNo + colServices,
    qty: contentLeft + colNo + colServices + colSAC,
    rate: contentLeft + colNo + colServices + colSAC + colQty,
    tax: contentLeft + colNo + colServices + colSAC + colQty + colRate,
    total: contentLeft + colNo + colServices + colSAC + colQty + colRate + colTax,
  }

  /** Draw vertical lines for table columns */
  const drawTableColumnBorders = (startY: number, height: number): void => {
    doc.setDrawColor(...BORDER_COLOR)
    const xCoords = [contentLeft, colX.services, colX.sac, colX.qty, colX.rate, colX.tax, colX.total, contentRight]
    for (const x of xCoords) {
      doc.line(x, startY, x, startY + height)
    }
  }

  /** Repeat table header on new page (for continuation). */
  const drawTableHeader = (): void => {
    doc.setFillColor(...HEADER_BG)
    doc.setDrawColor(...BORDER_COLOR)
    doc.rect(contentLeft, yPos, tableWidth, rowH, 'FD')
    doc.rect(contentLeft, yPos, tableWidth, rowH, 'S')
    drawTableColumnBorders(yPos, rowH)
    doc.setTextColor(...BLACK)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('No', colX.no + cellPad / 2, yPos + 9)
    doc.text('Services', colX.services + cellPad / 2, yPos + 9)
    doc.text('SAC', colX.sac + cellPad / 2, yPos + 9)
    doc.text('Qty', colX.qty + cellPad / 2, yPos + 9)
    doc.text('Rate', colX.rate + colRate - cellPad / 2, yPos + 9, { align: 'right' })
    doc.text('Tax', colX.tax + colTax - cellPad / 2, yPos + 9, { align: 'right' })
    doc.text('Total', contentRight - cellPad / 2, yPos + 9, { align: 'right' })
    yPos += rowH
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
  }

  const salonName = (data.brandName || data.locationName || 'SALON').toUpperCase()
  const invoiceNo = data.invoiceNumber || data.bookingToken
  const invoiceDate = format(data.date, 'dd/MM/yyyy')
  const terms = data.terms?.trim() || ''

  // ----- HEADER -----
  const hasLogo = data.locationImageDataUrl && data.locationImageDataUrl.startsWith('data:image/')
  const logoSize = 48
  if (hasLogo && data.locationImageDataUrl) {
    try {
      const fmt = data.locationImageDataUrl.match(/^data:image\/(\w+);/)?.[1] === 'jpeg' ? 'JPEG' : 'PNG'
      doc.addImage(data.locationImageDataUrl, fmt, contentLeft, yPos, logoSize, logoSize)
    } catch {
      // skip
    }
  }

  const leftX = hasLogo ? contentLeft + logoSize + 6 : contentLeft
  // Reserve space for "TAX INVOICE" on the right - constrain left content to avoid overlap
  const headerRightEdge = contentRight - 2
  const maxLeftWidth = headerRightEdge - leftX - 48 // leave ~48pt for TAX INVOICE
  doc.setTextColor(...BLACK)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  const salonLines = doc.splitTextToSize(salonName, Math.max(60, maxLeftWidth))
  doc.text(salonLines, leftX, yPos + 12)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  const salonLineH = 8
  let lineY = yPos + 12 + salonLines.length * salonLineH
  const smallLineH = 5
  if (data.locationMobile) {
    doc.text(data.locationMobile, leftX, lineY)
    lineY += smallLineH
  }
  if (data.locationAddress) {
    const addrLines = doc.splitTextToSize(data.locationAddress, Math.max(60, maxLeftWidth))
    doc.text(addrLines, leftX, lineY)
    lineY += addrLines.length * smallLineH
  }
  if (data.website) {
    const siteText = data.website.replace(/^https?:\/\//, '')
    const siteLines = doc.splitTextToSize(siteText, Math.max(60, maxLeftWidth))
    doc.text(siteLines, leftX, lineY)
    lineY += siteLines.length * smallLineH
  }
  if (data.gstNumber) {
    doc.text(`GST: ${data.gstNumber}`, leftX, lineY)
    lineY += smallLineH
  }

  doc.setTextColor(...BLACK)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('TAX INVOICE', contentRight, yPos + 12, { align: 'right' })

  const infoRowSpacing = Math.round(sectionSpacing * 0.4)
  const logoHeight = hasLogo ? logoSize : 0
  yPos = Math.max(lineY, yPos + logoHeight) + infoRowSpacing

  // ----- INFO ROW -----
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...BLACK)
  doc.text(`Invoice No: ${invoiceNo}`, contentLeft, yPos)
  doc.text(`Invoice Date: ${invoiceDate}`, contentRight, yPos, { align: 'right' })
  if (data.timeSlot) {
    yPos += 6
    doc.text(`Appointment: ${formatTime12h(data.timeSlot)}`, contentLeft, yPos)
  }
  yPos += infoRowSpacing

  // ----- BILL TO BOX -----
  const billToPadding = 12
  const billToHeight = 38
  checkPageBreak(billToHeight + 4)
  doc.setDrawColor(...BORDER_COLOR)
  doc.setFillColor(250, 250, 249)
  doc.rect(contentLeft, yPos, tableWidth, billToHeight, 'FD')
  doc.rect(contentLeft, yPos, tableWidth, billToHeight, 'S')
  doc.setTextColor(...BLACK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Bill To', contentLeft + billToPadding, yPos + 12)
  doc.setFont('helvetica', 'normal')
  if (data.customerName) doc.text(data.customerName, contentLeft + billToPadding, yPos + 21)
  if (data.customerMobile) doc.text(`Mobile: ${data.customerMobile}`, contentLeft + billToPadding, yPos + 29)
  yPos += billToHeight + 4

  // ----- TABLE -----
  checkPageBreak(rowH)
  doc.setFillColor(...HEADER_BG)
  doc.setDrawColor(...BORDER_COLOR)
  doc.rect(contentLeft, yPos, tableWidth, rowH, 'FD')
  doc.rect(contentLeft, yPos, tableWidth, rowH, 'S')
  drawTableColumnBorders(yPos, rowH)
  doc.setTextColor(...BLACK)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('No', colX.no + cellPad / 2, yPos + 9)
  doc.text('Services', colX.services + cellPad / 2, yPos + 9)
  doc.text('SAC', colX.sac + cellPad / 2, yPos + 9)
  doc.text('Qty', colX.qty + cellPad / 2, yPos + 9)
  doc.text('Rate', colX.rate + colRate - cellPad / 2, yPos + 9, { align: 'right' })
  doc.text('Tax', colX.tax + colTax - cellPad / 2, yPos + 9, { align: 'right' })
  doc.text('Total', contentRight - cellPad / 2, yPos + 9, { align: 'right' })
  yPos += rowH

  let totalTaxable = 0
  let totalTax = 0

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  data.services.forEach((svc, i) => {
    const svcLines = doc.splitTextToSize(svc.name, colServices - cellPad)
    const actualRowH = Math.max(rowH, 6 + svcLines.length * lineHeight)
    checkPageBreak(actualRowH, drawTableHeader)
    const qty = svc.quantity ?? 1
    const price = svc.price
    const taxable = Math.round((price / (1 + GST_RATE)) * 100) / 100
    const tax = Math.round((price - taxable) * 100) / 100
    totalTaxable += taxable
    totalTax += tax
    const unitTaxable = qty > 0 ? Math.round((taxable / qty) * 100) / 100 : taxable

    doc.setDrawColor(...BORDER_COLOR)
    doc.line(contentLeft, yPos, contentRight, yPos)
    drawTableColumnBorders(yPos, actualRowH)
    const cellCenterY = yPos + actualRowH / 2 - 2
    doc.text(String(i + 1), colX.no + cellPad / 2, cellCenterY)
    doc.text(svcLines, colX.services + cellPad / 2, yPos + 5)
    doc.text(SAC_CODE, colX.sac + cellPad / 2, cellCenterY)
    doc.text(`${qty} PCS`, colX.qty + cellPad / 2, cellCenterY)
    doc.text(fmt(unitTaxable), colX.rate + colRate - cellPad / 2, cellCenterY, { align: 'right' })
    doc.text(fmt(tax), colX.tax + colTax - cellPad / 2, cellCenterY, { align: 'right' })
    doc.text(fmt(price, 0), contentRight - cellPad / 2, cellCenterY, { align: 'right' })
    yPos += actualRowH
  })

  doc.setDrawColor(...BORDER_COLOR)
  doc.line(contentLeft, yPos, contentRight, yPos)
  yPos += 4

  // ----- SUBTOTAL ROW -----
  const subtotalRowH = rowH - 2
  checkPageBreak(subtotalRowH + 20)
  doc.setFillColor(...HEADER_BG)
  doc.rect(contentLeft, yPos, tableWidth, subtotalRowH, 'FD')
  doc.rect(contentLeft, yPos, tableWidth, subtotalRowH, 'S')
  drawTableColumnBorders(yPos, subtotalRowH)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLACK)
  doc.text('SUBTOTAL', contentLeft + cellPad / 2, yPos + 7)
  doc.text(fmt(totalTax), colX.tax + colTax - cellPad / 2, yPos + 7, { align: 'right' })
  doc.text(fmt(data.totalAmount, 0), contentRight - cellPad / 2, yPos + 7, { align: 'right' })
  yPos += subtotalRowH + sectionSpacing

  // ----- BOTTOM GRID: Terms (left) | Totals (right) - match HTML layout -----
  const amountPaid = data.amountPaid ?? 0
  const dueAmount = data.dueAmount ?? Math.max(0, data.totalAmount - amountPaid)
  const totalsBoxWidth = 95
  const boxPadding = 12
  const gapBetweenBoxes = 16
  const totalsBoxX = contentRight - totalsBoxWidth
  const termsBoxWidth = Math.max(60, totalsBoxX - contentLeft - gapBetweenBoxes)
  const bottomSectionHeight = 78
  checkPageBreak(bottomSectionHeight + 30)

  const bottomSectionY = yPos

  // Terms & Conditions - bordered box with padding (match HTML)
  doc.setDrawColor(...BORDER_COLOR)
  doc.setFillColor(250, 250, 249)
  doc.rect(contentLeft, bottomSectionY, termsBoxWidth, bottomSectionHeight, 'FD')
  doc.rect(contentLeft, bottomSectionY, termsBoxWidth, bottomSectionHeight, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BLACK)
  doc.text('Terms & Conditions', contentLeft + boxPadding, bottomSectionY + 10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  if (terms) {
    doc.setFontSize(8)
    const termsLines = doc.splitTextToSize(terms, termsBoxWidth - 2 * boxPadding)
    doc.text(termsLines, contentLeft + boxPadding, bottomSectionY + 18)
  }
  doc.setFontSize(8)
  doc.text('View full Terms & Conditions', contentLeft + boxPadding, bottomSectionY + 28)

  // Payment summary - bordered box with padding (match HTML)
  doc.setDrawColor(...BORDER_COLOR)
  doc.setFillColor(250, 250, 249)
  doc.rect(totalsBoxX, bottomSectionY, totalsBoxWidth, bottomSectionHeight, 'FD')
  doc.rect(totalsBoxX, bottomSectionY, totalsBoxWidth, bottomSectionHeight, 'S')
  doc.setTextColor(...BLACK)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Taxable Amount', totalsBoxX + boxPadding, bottomSectionY + 12)
  doc.text(fmt(totalTaxable), totalsBoxX + totalsBoxWidth - boxPadding, bottomSectionY + 12, { align: 'right' })
  doc.text('CGST @9%', totalsBoxX + boxPadding, bottomSectionY + 20)
  doc.text(fmt(totalTaxable * 0.09), totalsBoxX + totalsBoxWidth - boxPadding, bottomSectionY + 20, { align: 'right' })
  doc.text('SGST @9%', totalsBoxX + boxPadding, bottomSectionY + 28)
  doc.text(fmt(totalTaxable * 0.09), totalsBoxX + totalsBoxWidth - boxPadding, bottomSectionY + 28, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.text('Total Amount', totalsBoxX + boxPadding, bottomSectionY + 38)
  doc.text(fmt(data.totalAmount, 0), totalsBoxX + totalsBoxWidth - boxPadding, bottomSectionY + 38, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.text('Received Amount', totalsBoxX + boxPadding, bottomSectionY + 46)
  doc.text(fmt(amountPaid, 0), totalsBoxX + totalsBoxWidth - boxPadding, bottomSectionY + 46, { align: 'right' })
  doc.text('Balance', totalsBoxX + boxPadding, bottomSectionY + 54)
  doc.text(fmt(dueAmount, 0), totalsBoxX + totalsBoxWidth - boxPadding, bottomSectionY + 54, { align: 'right' })
  doc.text('Total Amount (in words):', totalsBoxX + boxPadding, bottomSectionY + 64)
  doc.setFontSize(7)
  const words = numberToWords(data.totalAmount)
  const wordsLines = doc.splitTextToSize(words, totalsBoxWidth - 2 * boxPadding)
  doc.text(wordsLines, totalsBoxX + boxPadding, bottomSectionY + 70)

  yPos = bottomSectionY + bottomSectionHeight + 16

  // ----- SIGNATURE BOX -----
  checkPageBreak(50)
  const sigW = 72
  const sigH = 48
  const sigPadding = 10
  doc.setDrawColor(...BORDER_COLOR)
  doc.rect(contentRight - sigW, yPos, sigW, sigH, 'S')
  // Image above "Signature" label, then salon name
  if (data.signatureDataUrl) {
    try {
      const fmt = data.signatureDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      const imgW = 64
      const imgH = 24
      doc.addImage(data.signatureDataUrl, fmt, contentRight - sigW + 4, yPos + 4, imgW, imgH)
    } catch {
      // Fall through
    }
  }
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.text('Signature', contentRight - sigW + sigPadding, yPos + (data.signatureDataUrl ? 32 : 14))
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLACK)
  doc.text(salonName, contentRight - sigW + sigPadding, yPos + (data.signatureDataUrl ? 44 : 26))
  doc.setFont('helvetica', 'normal')

  // Outer border
  doc.setDrawColor(...BORDER_COLOR)
  doc.setLineWidth(0.5)
  doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin, 'S')

  const filename = `Tax-Invoice-${invoiceNo}-${format(data.date, 'yyyyMMdd')}.pdf`
  const buffer = doc.output('arraybuffer') as ArrayBuffer
  return { buffer, filename }
}
