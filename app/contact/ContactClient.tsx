'use client'

import { Phone, Mail, MapPin, Clock } from 'lucide-react'
import Link from 'next/link'
import { SEO } from '@/lib/seo'

const SUPPORT_EMAIL = 'contact@valessioparis.com'

export default function ContactClient() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
          Contact {SEO.siteName}
        </h1>
        <p className="text-gray-600 text-sm mb-6">
          Venez nous rendre visite au {SEO.address.streetAddress}, Paris 9 ou contactez-nous.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Phone size={20} />
              Téléphone
            </h2>
            <a
              href={`tel:${SEO.telephone.replace(/\s/g, '')}`}
              className="text-teal-600 hover:text-teal-700 font-medium"
            >
              {SEO.telephone}
            </a>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Mail size={20} />
              Email
            </h2>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-teal-600 hover:text-teal-700 font-medium"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin size={20} />
              Adresse
            </h2>
            <p className="text-gray-800 font-medium mb-1">{SEO.siteName}</p>
            <p className="text-gray-600 text-sm">{SEO.address.streetAddress}</p>
            <p className="text-gray-600 text-sm">{SEO.address.postalCode} {SEO.address.locality}</p>
            <p className="text-gray-600 text-sm mb-4">{SEO.address.country === 'FR' ? 'France' : SEO.address.country}</p>
            <Link
              href="/booking/location"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
            >
              Prendre rendez-vous
            </Link>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock size={20} />
              Horaires
            </h2>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Lundi – Samedi</span>
                <span className="font-medium text-gray-800">10:00 – 19:00</span>
              </div>
              <div className="flex justify-between">
                <span>Dimanche</span>
                <span className="font-medium text-red-500">Fermé</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl overflow-hidden border border-gray-200">
          <h2 className="font-semibold text-gray-900 p-4 border-b border-gray-200">
            Nous trouver
          </h2>
          <div className="aspect-video w-full">
            <iframe
              src="https://maps.google.com/maps?q=17+Rue+de+Châteaudun,+75009+Paris,+France&output=embed&z=16"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`${SEO.siteName} — 17 Rue de Châteaudun, Paris 9`}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
