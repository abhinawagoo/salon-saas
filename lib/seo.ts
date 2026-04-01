const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.valessioparis.com'

export const SEO = {
  siteName: 'Valessio Paris',
  title: 'Valessio Paris – Luxury Salon & Beauty',
  description:
    'Valessio Paris is a luxury salon offering world-class hair styling, skincare, and beauty treatments. Book your appointment today.',
  keywords:
    'Valessio Paris, luxury salon, beauty parlour, hair styling, facial, bridal makeup, premium salon',
  ogTitle: 'Valessio Paris – Luxury Salon & Beauty',
  ogDescription: 'World-class hair, skincare, and beauty treatments at Valessio Paris.',
  telephone: '',
  address: {
    locality: '',
    region: '',
    postalCode: '',
    country: 'IN',
  },
  areaServed: '',
  priceRange: '₹₹₹',
  openingHours: 'Mo-Su 10:00-20:00',
  bannerAlt: 'Valessio Paris – Luxury Salon',
  galleryAlt: 'Valessio Paris salon experience',
  baseUrl: BASE_URL.replace(/\/$/, ''),
  ogImageUrl: `${BASE_URL.replace(/\/$/, '')}/banner.jpg`,
  logoUrl: process.env.NEXT_PUBLIC_LOGO_URL || `${BASE_URL.replace(/\/$/, '')}/favicon.png`,
}
