const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.valessioparis.com'

export const SEO = {
  siteName: 'Valessio Paris',
  title: 'Valessio – Coiffeur Paris 9 | Salon de Coiffure & Beauté',
  description:
    'Valessio, coiffeur de luxe au cœur de Paris 9. Coupes, colorations, soins et beauté au 17 Rue de Châteaudun, 75009 Paris. Réservez votre rendez-vous en ligne.',
  keywords:
    'Valessio Paris, coiffeur Paris 9, salon de coiffure Paris, coloriste Paris, soins capillaires, beauté Paris, Châteaudun',
  ogTitle: 'Valessio – Coiffeur Paris 9',
  ogDescription: 'Salon de coiffure et beauté de luxe au 17 Rue de Châteaudun, 75009 Paris.',
  telephone: '+33 1 00 00 00 00',
  address: {
    streetAddress: '17 Rue de Châteaudun',
    locality: 'Paris',
    region: 'Île-de-France',
    postalCode: '75009',
    country: 'FR',
  },
  areaServed: 'Paris 9e arrondissement',
  priceRange: '€€€',
  openingHours: 'Mo-Sa 10:00-19:00',
  bannerAlt: 'Valessio – Salon de Coiffure Paris 9',
  galleryAlt: 'Valessio Paris – Coiffure & Beauté',
  baseUrl: BASE_URL.replace(/\/$/, ''),
  ogImageUrl: `${BASE_URL.replace(/\/$/, '')}/banner.jpg`,
  logoUrl: process.env.NEXT_PUBLIC_LOGO_URL || `${BASE_URL.replace(/\/$/, '')}/favicon.png`,
}
