/**
 * WhatsApp Cloud API – direct integration (no BSP).
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
 * Requires: Meta App, WhatsApp Business API, Phone Number ID, Access Token.
 * For business-initiated messages (post-payment) you must use an approved template.
 */

import { toE164 } from '@/lib/phone'
import { formatTime12h } from '@/lib/formatTime'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

function getConfig() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID
  return { token, phoneId }
}

type WhatsAppErrorContext = 'invoice' | 'booking' | 'otp' | 'staff' | 'generic'

function logWhatsAppError(status: number, msg: string, to: string, context: WhatsAppErrorContext = 'generic') {
  if (msg.includes('131030')) {
    console.warn(
      `[WhatsApp #131030] Recipient ${to} not in allowed list. ` +
        'In Development mode, add numbers at: Meta Developer Console → WhatsApp → API Setup → "To" field → Manage phone number list'
    )
  } else if (msg.includes('132001')) {
    if (context === 'invoice') {
      console.warn(
        `[WhatsApp #132001] Invoice template not found or wrong language. Set WHATSAPP_INVOICE_TEMPLATE_NAME to match Meta exactly, ` +
          'and WHATSAPP_INVOICE_TEMPLATE_LANG or WHATSAPP_TEMPLATE_LANG to the template language (e.g. en_US — must match Meta Template Library).'
      )
    } else if (context === 'otp') {
      console.warn(
        `[WhatsApp #132001] OTP template not found. Check WHATSAPP_OTP_TEMPLATE_NAME and WHATSAPP_TEMPLATE_LANG vs Meta (e.g. en_US).`
      )
    } else if (context === 'staff') {
      console.warn(
        `[WhatsApp #132001] Staff booking template not found. Check WHATSAPP_STAFF_BOOKING_TEMPLATE_NAME and WHATSAPP_TEMPLATE_LANG vs Meta.`
      )
    } else {
      console.warn(
        `[WhatsApp #132001] Template not found. Check WHATSAPP_BOOKING_TEMPLATE_NAME / WHATSAPP_OTP_TEMPLATE_NAME and language code in Meta (e.g. en_US).`
      )
    }
  } else if (msg.includes('132012')) {
    console.warn(
      `[WhatsApp #132012] Template parameter/header mismatch. For customer_invoice: image header URL + 6 body vars + URL button. ` +
        'Legacy: body + button only. Check WHATSAPP_INVOICE_HEADER_IMAGE_URL and Meta template structure.'
    )
  } else {
    console.error('WhatsApp Cloud error:', status, msg)
  }
}

/**
 * Send hello_world template (Meta sample, no params) – for testing when business verification pending.
 * Set USE_WHATSAPP_HELLO_WORLD_TEST=true to use this instead of invoice/booking templates.
 */
export async function sendHelloWorldWhatsApp(mobile: string): Promise<{ ok: boolean; error?: string }> {
  const { token, phoneId } = getConfig()
  if (!token || !phoneId) {
    console.warn('WhatsApp Cloud: WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set')
    return { ok: false, error: 'Not configured' }
  }

  const to = toE164(mobile)
  const url = `${GRAPH_API}/${phoneId}/messages`

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: 'hello_world',
      language: { code: 'en_US' },
    },
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    if (!res.ok) {
      const msg = data.error?.message || res.statusText
      logWhatsAppError(res.status, msg, to, 'generic')
      return { ok: false, error: msg }
    }
    return { ok: true }
  } catch (e) {
    console.error('WhatsApp Cloud hello_world request failed:', e)
    return { ok: false, error: String(e) }
  }
}

/**
 * Send template message via WhatsApp Cloud API.
 * Template must be pre-approved in Meta Business Manager.
 * Body params: {{1}}, {{2}}, etc. Pass as array.
 */
export async function sendWhatsAppTemplate(
  mobile: string,
  templateName: string,
  bodyParams: string[],
  options?: { languageCode?: string }
): Promise<{ ok: boolean; error?: string }> {
  const { token, phoneId } = getConfig()
  if (!token || !phoneId) {
    console.warn('WhatsApp Cloud: WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set')
    return { ok: false, error: 'Not configured' }
  }

  const to = toE164(mobile)
  const url = `${GRAPH_API}/${phoneId}/messages`

  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: options?.languageCode || process.env.WHATSAPP_TEMPLATE_LANG || 'en' },
      components: [
        {
          type: 'body',
          parameters: bodyParams.map((text) => ({ type: 'text', text })),
        },
      ],
    },
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    if (!res.ok) {
      const msg = data.error?.message || res.statusText
      logWhatsAppError(res.status, msg, to, 'generic')
      return { ok: false, error: msg }
    }
    return { ok: true }
  } catch (e) {
    console.error('WhatsApp Cloud request failed:', e)
    return { ok: false, error: String(e) }
  }
}

/**
 * Send OTP via WhatsApp Cloud API (authentication template).
 * Requires an approved authentication template in Meta (e.g. Copy Code type).
 * Template body: "{{1}} is your verification code." – pass OTP as first param.
 * Set WHATSAPP_OTP_TEMPLATE_NAME in .env (default: otp_verification).
 */
export async function sendOtpWhatsApp(mobile: string, otp: string): Promise<{ ok: boolean; error?: string }> {
  const { token, phoneId } = getConfig()
  if (!token || !phoneId) {
    console.warn('WhatsApp Cloud: WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set')
    return { ok: false, error: 'Not configured' }
  }

  const templateName = process.env.WHATSAPP_OTP_TEMPLATE_NAME || 'otp_verification'
  const lang = process.env.WHATSAPP_TEMPLATE_LANG || 'en'
  const expiryMinutes = parseInt(process.env.WHATSAPP_OTP_EXPIRY_MINUTES || '10', 10) || 10

  const to = toE164(mobile)
  const url = `${GRAPH_API}/${phoneId}/messages`

  // Copy Code template: body + button (button needs OTP param for copy-to-clipboard)
  const components: Record<string, unknown>[] = [
    {
      type: 'body',
      parameters: [{ type: 'text', text: otp }],
    },
    {
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: otp }],
    },
  ]

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: lang },
      components,
    },
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    if (!res.ok) {
      const msg = data.error?.message || res.statusText
      logWhatsAppError(res.status, msg, to, 'otp')
      return { ok: false, error: msg }
    }
    return { ok: true }
  } catch (e) {
    console.error('WhatsApp Cloud OTP request failed:', e)
    return { ok: false, error: String(e) }
  }
}

export type SendInvoiceWhatsAppOptions = {
  /** Bill number e.g. BILL-000152 (utility template). */
  billNo?: string
  /** Outstanding balance in INR (utility template {{4}}). Defaults to 0 when omitted. */
  balanceDue?: number
  /** Booking appointment date for body {{5}} (DD/MM/YYYY). */
  appointmentDate?: Date | string
  /** Booking time slot e.g. "14:30" for body {{6}} (shown as 12h). */
  appointmentTimeSlot?: string
  /**
   * Booking token for button {{1}} when Meta URL is like ...?token={{1}} (utility template).
   * If omitted, token is parsed from `invoiceLink` query string.
   */
  bookingToken?: string
}

function extractTokenFromInvoiceLink(invoiceLink: string): string {
  try {
    const u = new URL(invoiceLink)
    const t = u.searchParams.get('token')
    if (t) return decodeURIComponent(t)
  } catch {
    // ignore
  }
  return invoiceLink.trim()
}

/** Default header image when Meta template uses IMAGE header (sample image in Meta is not sent by WhatsApp). */
const DEFAULT_WHATSAPP_INVOICE_HEADER_IMAGE_URL =
  'https://pub-c59feb6fcc0b46a69749700201f38b8a.r2.dev/location/1772203333797-foxy2hm3.jpeg'

/**
 * Send invoice/receipt link after payment (WhatsApp Cloud API).
 *
 * **Utility template (default)** – see `docs/WHATSAPP_INVOICE_UTILITY_TEMPLATE.md`
 * Header: IMAGE — we send `WHATSAPP_INVOICE_HEADER_IMAGE_URL` or the default R2 URL every time (required for dynamic media).
 * Body: {{1}} name, {{2}} invoice, {{3}} amount, {{4}} balance, {{5}} appointment date, {{6}} appointment time.
 * Button: dynamic URL suffix — token only (…?token={{1}}), unless WHATSAPP_INVOICE_BUTTON_FULL_URL=true.
 *
 * **Legacy template** – set `WHATSAPP_INVOICE_TEMPLATE_LEGACY=true`
 * Body: Hi {{1}}, your {{2}} bill payment of {{3}} … date {{4}}. No image header.
 */
export async function sendInvoiceWhatsApp(
  mobile: string,
  customerName: string,
  amountPaid: number,
  paymentDate: Date,
  invoiceLink: string,
  options?: SendInvoiceWhatsAppOptions
): Promise<{ ok: boolean; error?: string }> {
  if (process.env.USE_WHATSAPP_HELLO_WORLD_TEST === 'true') {
    return sendHelloWorldWhatsApp(mobile)
  }
  const { token, phoneId } = getConfig()
  if (!token || !phoneId) {
    console.warn('WhatsApp Cloud: WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set')
    return { ok: false, error: 'Not configured' }
  }

  const templateName = process.env.WHATSAPP_INVOICE_TEMPLATE_NAME || 'customer_invoice'
  const lang = process.env.WHATSAPP_INVOICE_TEMPLATE_LANG?.trim() || process.env.WHATSAPP_TEMPLATE_LANG || 'en'
  const legacy = process.env.WHATSAPP_INVOICE_TEMPLATE_LEGACY === 'true'

  const nameParam = (customerName || 'Customer').trim().slice(0, 30)
  const amountFormatted = `Rs. ${Math.round(amountPaid)}`.slice(0, 30)
  const to = toE164(mobile)
  const apiUrl = `${GRAPH_API}/${phoneId}/messages`

  const components: Record<string, unknown>[] = []

  if (legacy) {
    const billType = (process.env.WHATSAPP_INVOICE_BILL_TYPE || 'booking for Shahnaz Salon Sasaram').trim().slice(0, 30)
    const dateFormatted = formatPaymentDate(paymentDate).slice(0, 30)
    components.push({
      type: 'body',
      parameters: [
        { type: 'text', text: nameParam },
        { type: 'text', text: billType },
        { type: 'text', text: amountFormatted },
        { type: 'text', text: dateFormatted },
      ],
    })
  } else {
    const rawHeader = process.env.WHATSAPP_INVOICE_HEADER_IMAGE_URL
    let headerImageUrl: string
    if (rawHeader === undefined) {
      headerImageUrl = DEFAULT_WHATSAPP_INVOICE_HEADER_IMAGE_URL
    } else if (rawHeader.trim() === '') {
      headerImageUrl = ''
    } else {
      headerImageUrl = rawHeader.trim()
    }
    if (headerImageUrl) {
      components.push({
        type: 'header',
        parameters: [{ type: 'image', image: { link: headerImageUrl } }],
      })
    }
    const billNo = (options?.billNo || '—').trim().slice(0, 30)
    const balance = options?.balanceDue ?? 0
    const balanceFormatted = `Rs. ${Math.round(balance)}`.slice(0, 30)
    const apptDateStr = options?.appointmentDate
      ? typeof options.appointmentDate === 'string'
        ? options.appointmentDate.slice(0, 10)
        : options.appointmentDate.toISOString().slice(0, 10)
      : ''
    const appointmentDateDisplay = apptDateStr ? formatAppointmentDateShort(apptDateStr).slice(0, 30) : '—'
    const appointmentTimeDisplay = options?.appointmentTimeSlot
      ? formatTime12h(options.appointmentTimeSlot).slice(0, 30)
      : '—'
    components.push({
      type: 'body',
      parameters: [
        { type: 'text', text: nameParam },
        { type: 'text', text: billNo },
        { type: 'text', text: amountFormatted },
        { type: 'text', text: balanceFormatted },
        { type: 'text', text: appointmentDateDisplay },
        { type: 'text', text: appointmentTimeDisplay },
      ],
    })
  }

  // Button: Meta template often uses fixed domain + ?token={{1}} — send token only, not full URL
  let buttonParam: string
  if (legacy) {
    buttonParam = invoiceLink.trim()
  } else if (process.env.WHATSAPP_INVOICE_BUTTON_FULL_URL === 'true') {
    buttonParam = invoiceLink.trim()
  } else {
    buttonParam = (options?.bookingToken || extractTokenFromInvoiceLink(invoiceLink)).trim()
  }

  components.push({
    type: 'button',
    sub_type: 'url',
    index: 0,
    parameters: [{ type: 'text', text: buttonParam }],
  })

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: lang },
      components,
    },
  }

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; error_data?: { details?: string } } }
    if (!res.ok) {
      const msg = data.error?.message || res.statusText
      console.error('[WhatsApp invoice] Error:', msg, '| Full:', JSON.stringify(data))
      if (data.error?.error_data?.details) console.error('[WhatsApp] Details:', data.error.error_data.details)
      logWhatsAppError(res.status, msg, to, 'invoice')
      return { ok: false, error: msg }
    }
    return { ok: true }
  } catch (e) {
    console.error('WhatsApp Cloud invoice template failed:', e)
    return { ok: false, error: String(e) }
  }
}

/** DD/MM/YYYY for invoice body {{5}} */
function formatAppointmentDateShort(yyyyMmDd: string): string {
  const d = new Date(yyyyMmDd + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return yyyyMmDd.slice(0, 10)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/** Format payment date for WhatsApp template (e.g. "December 31, 2025"). */
function formatPaymentDate(d: Date): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

/**
 * Format date string (yyyy-MM-dd) to "December 31, 2025".
 */
function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

/**
 * Send booking confirmation to customer via WhatsApp Cloud API (direct, no BSP).
 * Template: Header "Your appointment is booked", Body "Hello {{1}}, Thank you for booking with Fashion Styles. Your appointment for {{2}} on {{3}} at {{4}} is confirmed."
 * Params: {{1}} name, {{2}} services, {{3}} date (December 31, 2025), {{4}} time (1:00 PM).
 * When USE_WHATSAPP_HELLO_WORLD_TEST=true, sends hello_world instead (for testing before business verification).
 */
export type StaffBookingAlertParams = {
  locationName: string
  customerName: string
  customerMobile: string
  dateDisplay: string
  timeDisplay: string
  servicesSummary: string
  amountDisplay: string
}

/**
 * Notify salon managers (numbers from Admin → Customize) when a booking is confirmed.
 * Create template in Meta (e.g. name `staff_booking_alert`, 7 body variables) — see `docs/WHATSAPP_STAFF_BOOKING_TEMPLATE.md`.
 */
export async function sendStaffBookingAlertWhatsApp(
  mobile: string,
  p: StaffBookingAlertParams
): Promise<{ ok: boolean; error?: string }> {
  if (process.env.USE_WHATSAPP_HELLO_WORLD_TEST === 'true') {
    return sendHelloWorldWhatsApp(mobile)
  }
  const templateName = process.env.WHATSAPP_STAFF_BOOKING_TEMPLATE_NAME || 'staff_booking_alert'
  const slice = (s: string, n: number) => (s || '').trim().slice(0, n)
  return sendWhatsAppTemplateBodyOnly(mobile, templateName, [
    slice(p.locationName, 60),
    slice(p.customerName, 30),
    slice(p.customerMobile, 20),
    slice(p.dateDisplay, 30),
    slice(p.timeDisplay, 30),
    slice(p.servicesSummary, 80),
    slice(p.amountDisplay, 30),
  ])
}

async function sendWhatsAppTemplateBodyOnly(
  mobile: string,
  templateName: string,
  bodyParams: string[],
  options?: { languageCode?: string }
): Promise<{ ok: boolean; error?: string }> {
  const { token, phoneId } = getConfig()
  if (!token || !phoneId) {
    console.warn('WhatsApp Cloud: WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set')
    return { ok: false, error: 'Not configured' }
  }

  const to = toE164(mobile)
  const url = `${GRAPH_API}/${phoneId}/messages`

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: options?.languageCode || process.env.WHATSAPP_TEMPLATE_LANG || 'en' },
      components: [
        {
          type: 'body',
          parameters: bodyParams.map((text) => ({ type: 'text', text })),
        },
      ],
    },
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    if (!res.ok) {
      const msg = data.error?.message || res.statusText
      logWhatsAppError(res.status, msg, to, 'staff')
      return { ok: false, error: msg }
    }
    return { ok: true }
  } catch (e) {
    console.error('WhatsApp Cloud staff booking template failed:', e)
    return { ok: false, error: String(e) }
  }
}

/**
 * Send a free-text WhatsApp message (works only within 24h customer-initiated window).
 * For marketing to cold customers, use sendWhatsAppTemplate instead.
 */
export async function sendWhatsAppText(
  mobile: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const { token, phoneId } = getConfig()
  if (!token || !phoneId) return { ok: false, error: 'Not configured' }
  const to = toE164(mobile)
  const url = `${GRAPH_API}/${phoneId}/messages`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    if (!res.ok) {
      const msg = data.error?.message || res.statusText
      logWhatsAppError(res.status, msg, to)
      return { ok: false, error: msg }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function sendBookingConfirmationWhatsApp(
  mobile: string,
  customerName: string,
  _bookingToken: string,
  dateStr: string,
  timeSlot: string,
  servicesSummary: string,
  _totalAmount: string,
  _invoiceLink: string
): Promise<{ ok: boolean; error?: string }> {
  if (process.env.USE_WHATSAPP_HELLO_WORLD_TEST === 'true') {
    return sendHelloWorldWhatsApp(mobile)
  }
  const templateName = process.env.WHATSAPP_BOOKING_TEMPLATE_NAME || 'booking_confirmation'
  const dateFormatted = formatDateLong(dateStr)
  const timeFormatted = formatTime12h(timeSlot)
  return sendWhatsAppTemplateWithHeader(mobile, templateName, [customerName, servicesSummary, dateFormatted, timeFormatted])
}

/**
 * Send template with optional static header + body params.
 * Use when template has header like "Your appointment is booked" and body with {{1}}..{{n}}.
 */
async function sendWhatsAppTemplateWithHeader(
  mobile: string,
  templateName: string,
  bodyParams: string[],
  options?: { languageCode?: string }
): Promise<{ ok: boolean; error?: string }> {
  const { token, phoneId } = getConfig()
  if (!token || !phoneId) {
    console.warn('WhatsApp Cloud: WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set')
    return { ok: false, error: 'Not configured' }
  }

  const to = toE164(mobile)
  const url = `${GRAPH_API}/${phoneId}/messages`

  const hasHeader = process.env.WHATSAPP_BOOKING_TEMPLATE_HAS_HEADER !== 'false'
  const components: Record<string, unknown>[] = []
  if (hasHeader) {
    components.push({ type: 'header', parameters: [] })
  }
  components.push({
    type: 'body',
    parameters: bodyParams.map((text) => ({ type: 'text', text })),
  })

  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: options?.languageCode || process.env.WHATSAPP_TEMPLATE_LANG || 'en' },
      components,
    },
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    if (!res.ok) {
      const msg = data.error?.message || res.statusText
      logWhatsAppError(res.status, msg, to, 'booking')
      return { ok: false, error: msg }
    }
    return { ok: true }
  } catch (e) {
    console.error('WhatsApp Cloud request failed:', e)
    return { ok: false, error: String(e) }
  }
}
