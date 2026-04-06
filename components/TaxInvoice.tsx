'use client'

import Link from 'next/link'
import { numberToWords } from '@/lib/numberToWords'
import { formatCurrency } from '@/lib/currency'

const SAC_CODE = '9984'
const GST_RATE = 0.18

export interface TaxInvoiceService {
  id: string
  name: string
  price: number
  quantity?: number
}

export interface TaxInvoiceData {
  salonName: string
  phone?: string
  address?: string
  website?: string
  gstNumber?: string
  logoUrl?: string
  signatureUrl?: string
  invoiceNo: string
  invoiceDate: string
  /** Appointment time in 12h format (e.g. "2:00 PM") */
  appointmentTime?: string
  customerName?: string
  customerMobile?: string
  services: TaxInvoiceService[]
  totalAmount: number
  amountPaid?: number
  dueAmount?: number
  terms?: string
}

export default function TaxInvoice({ data }: { data: TaxInvoiceData }) {
  const terms = data.terms?.trim() || ''
  const amountPaid = data.amountPaid ?? 0
  const dueAmount = data.dueAmount ?? Math.max(0, data.totalAmount - amountPaid)

  let totalTaxable = 0
  let totalTax = 0
  data.services.forEach((s) => {
    const taxable = Math.round((s.price / (1 + GST_RATE)) * 100) / 100
    totalTaxable += taxable
    totalTax += s.price - taxable
  })
  totalTax = Math.round(totalTax * 100) / 100

  const getQty = (s: TaxInvoiceService) => s.quantity ?? 1
  const getUnitTaxable = (s: TaxInvoiceService) => {
    const qty = getQty(s)
    const taxable = Math.round((s.price / (1 + GST_RATE)) * 100) / 100
    return qty > 0 ? taxable / qty : taxable
  }

  return (
    <div
      className="tax-invoice bg-white text-gray-800 rounded-lg overflow-hidden w-full max-w-[800px] mx-auto box-border border border-[#E5E0D8] px-4 py-5 sm:px-6 sm:py-6"
    >
      {/* Header - stack on mobile, row on desktop/print */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start sm:gap-8 mb-2 print:flex-row print:justify-between print:items-start print:gap-8">
        <div className="flex gap-3 sm:gap-4">
          {data.logoUrl && (
            <img
              src={data.logoUrl}
              alt=""
              className="w-16 h-16 sm:w-24 sm:h-24 object-cover rounded shrink-0"
            />
          )}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold uppercase tracking-tight text-gray-900 break-words">
              {data.salonName}
            </h1>
            {data.phone && <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">{data.phone}</p>}
            {data.address && <p className="text-xs sm:text-sm text-gray-600 break-words">{data.address}</p>}
            {data.website && (
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                <a
                  href={data.website.startsWith('http') ? data.website : `https://${data.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline break-all"
                >
                  {data.website.replace(/^https?:\/\//, '')}
                </a>
              </p>
            )}
            {data.gstNumber && (
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                GST: {data.gstNumber}
              </p>
            )}
          </div>
        </div>
        <div className="sm:text-right shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">TAX INVOICE</h2>
        </div>
      </div>

      {/* Info Row */}
      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 text-xs sm:text-sm mt-2 sm:mt-2 mb-2 sm:mb-2 print:flex-row print:flex-wrap print:items-center print:gap-x-4 print:text-sm">
        <span className="font-medium text-gray-700">Invoice No: {data.invoiceNo}</span>
        <span className="font-medium text-gray-700">Invoice Date: {data.invoiceDate}</span>
        {data.appointmentTime && (
          <span className="font-medium text-gray-700">Appointment: {data.appointmentTime}</span>
        )}
      </div>

      {/* Bill To Box */}
      <div
        className="rounded-lg p-3 sm:p-4 mb-4 sm:mb-5 border border-[#E5E0D8] bg-[#FAFAF9]"
      >
        <p className="text-xs sm:text-sm font-semibold text-gray-900 mb-1 sm:mb-2">Bill To</p>
        {data.customerName && <p className="text-xs sm:text-sm text-gray-700 break-words">{data.customerName}</p>}
        {data.customerMobile && <p className="text-xs sm:text-sm text-gray-600">Mobile: {data.customerMobile}</p>}
      </div>

      {/* Mobile: Card layout for services | Desktop: Table */}
      <div className="mb-4 sm:mb-5">
        {/* Mobile card layout - visible only on small screens, hidden in print */}
        <div className="md:hidden print:hidden space-y-3">
              {data.services.map((s, i) => {
                const qty = getQty(s)
                const taxable = Math.round((s.price / (1 + GST_RATE)) * 100) / 100
                const tax = Math.round((s.price - taxable) * 100) / 100
                const unitTaxable = qty > 0 ? taxable / qty : taxable
                return (
                  <div
                    key={s.id}
                    className="rounded-lg border border-[#E5E0D8] p-3 bg-[#FAFAF9]/50"
                  >
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <span className="text-xs text-gray-500">#{i + 1}</span>
                      <span className="text-sm font-semibold text-gray-900">{formatCurrency(s.price)}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 break-words">{s.name}</p>
                    <div className="flex justify-between text-xs text-gray-600 mt-1">
                      <span>Rate: {formatCurrency(unitTaxable, 2)}{qty > 1 ? ` × ${qty}` : ''}</span>
                      <span>Tax: {formatCurrency(tax, 2)}</span>
                    </div>
                  </div>
                )
              })}
          <div className="rounded-lg border border-[#E5E0D8] p-3 bg-[#F3EEE6] font-semibold flex justify-between items-center">
            <span className="text-sm text-gray-900">SUBTOTAL</span>
            <span className="text-sm text-gray-900">{formatCurrency(data.totalAmount)}</span>
          </div>
        </div>

        {/* Desktop table - hidden on mobile, always shown in print */}
        <div className="hidden md:block print:block overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[560px]" style={{ border: '1px solid #E5E0D8', borderRadius: 8, overflow: 'hidden', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ backgroundColor: '#F3EEE6' }}>
                <th className="text-left font-semibold text-gray-900" style={{ padding: 10, width: '5%' }}>No</th>
                <th className="text-left font-semibold text-gray-900" style={{ padding: 10, width: '35%' }}>Services</th>
                <th className="text-left font-semibold text-gray-900" style={{ padding: 10, width: '10%' }}>SAC</th>
                <th className="text-left font-semibold text-gray-900" style={{ padding: 10, width: '10%' }}>Qty</th>
                <th className="text-right font-semibold text-gray-900" style={{ padding: 10, width: '14%' }}>Rate</th>
                <th className="text-right font-semibold text-gray-900" style={{ padding: 10, width: '14%' }}>Tax</th>
                <th className="text-right font-semibold text-gray-900" style={{ padding: 10, width: '12%' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.services.map((s, i) => {
                const qty = getQty(s)
                const taxable = Math.round((s.price / (1 + GST_RATE)) * 100) / 100
                const tax = Math.round((s.price - taxable) * 100) / 100
                const unitTaxable = getUnitTaxable(s)
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #E5E0D8' }}>
                    <td className="text-gray-600 align-middle" style={{ padding: 10 }}>{i + 1}</td>
                    <td className="text-gray-600 align-middle" style={{ padding: 10, wordBreak: 'break-word', maxWidth: 0 }}>{s.name}</td>
                    <td className="text-gray-600 align-middle" style={{ padding: 10 }}>{SAC_CODE}</td>
                    <td className="text-gray-600 align-middle" style={{ padding: 10 }}>{qty} PCS</td>
                    <td className="text-right text-gray-700 font-medium align-middle" style={{ padding: 10 }}>{formatCurrency(unitTaxable, 2)}</td>
                    <td className="text-right text-gray-700 font-medium align-middle" style={{ padding: 10 }}>{formatCurrency(tax, 2)}</td>
                    <td className="text-right font-semibold align-middle" style={{ padding: 10 }}>{formatCurrency(s.price)}</td>
                  </tr>
                )
              })}
              <tr style={{ backgroundColor: '#F3EEE6' }} className="font-semibold">
                <td style={{ padding: 10 }}>SUBTOTAL</td>
                <td style={{ padding: 10 }} colSpan={3}></td>
                <td style={{ padding: 10, textAlign: 'right' }}></td>
                <td style={{ padding: 10, textAlign: 'right' }}>{formatCurrency(totalTax, 2)}</td>
                <td style={{ padding: 10, textAlign: 'right' }}>{formatCurrency(data.totalAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom: Terms (left) | Totals (right) - stack on mobile, row in print */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:gap-8 mt-4 sm:mt-5 mb-6 sm:mb-6 print:flex-row print:justify-between print:gap-8">
        <div className="flex-1 sm:max-w-md min-w-0">
          <p className="text-xs font-medium text-gray-600 mb-1">Terms & Conditions</p>
          {terms && <p className="text-xs sm:text-sm text-gray-600 break-words">{terms}</p>}
          <Link
            href="/terms"
            className="inline-block mt-1.5 text-xs text-primary-600 hover:underline"
          >
            View full Terms &amp; Conditions
          </Link>
        </div>
        <div
          className="rounded-lg p-4 shrink-0 w-full sm:w-auto sm:min-w-[220px] border border-[#E5E0D8] bg-[#FAFAF9]"
        >
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex justify-between text-xs sm:text-sm gap-2">
              <span className="text-gray-600 shrink-0">Taxable Amount</span>
              <span className="font-medium text-right break-all">{formatCurrency(totalTaxable, 2)}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm gap-2">
              <span className="text-gray-600 shrink-0">CGST @9%</span>
              <span className="font-medium text-right break-all">{formatCurrency(totalTaxable * 0.09, 2)}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm gap-2">
              <span className="text-gray-600 shrink-0">SGST @9%</span>
              <span className="font-medium text-right break-all">{formatCurrency(totalTaxable * 0.09, 2)}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm font-bold pt-2 border-t border-gray-200 gap-2">
              <span className="text-gray-900 shrink-0">Total Amount</span>
              <span className="text-gray-900 text-right break-all">{formatCurrency(data.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm gap-2">
              <span className="text-gray-600 shrink-0">Received Amount</span>
              <span className="font-medium text-right break-all">{formatCurrency(amountPaid)}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm gap-2">
              <span className="text-gray-600 shrink-0">Balance</span>
              <span className="font-medium text-right break-all">{formatCurrency(dueAmount)}</span>
            </div>
            <div className="pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-600 mb-0.5">Total Amount (in words):</p>
              <p className="text-xs font-semibold text-gray-900 break-words">{numberToWords(data.totalAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Box - bottom right: image above "Signature" label, then salon name */}
      <div className="flex justify-end mt-4 sm:mt-6">
        <div
          className="rounded-lg flex flex-col justify-end pb-2 pl-3 pr-2 pt-2 border border-[#E5E0D8] w-36 sm:w-44 min-h-[5rem] sm:min-h-[6rem] overflow-hidden"
        >
          {data.signatureUrl ? (
            <img src={data.signatureUrl} alt="Signature" className="w-full max-w-[9rem] h-12 sm:h-14 object-contain object-left-bottom mb-1.5 shrink-0" />
          ) : null}
          <span className="text-xs text-gray-500">Signature</span>
          <span className="text-xs font-semibold text-gray-900 truncate">{data.salonName}</span>
        </div>
      </div>
    </div>
  )
}
