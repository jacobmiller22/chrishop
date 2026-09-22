import type { Metadata } from 'next';

export const SITE_NAME = 'BankBeaters';
export const SITE_DEFAULT_TITLE = 'BankBeaters Adventure Gear | Curiosity > Fear';
export const SITE_TITLE_TEMPLATE = '%s | BankBeaters Adventure Gear';
export const SITE_DEFAULT_DESCRIPTION =
  'Patagonia-grade technical outdoor and adventure fishing gear hand-sewn by Chris for anglers and explorers who work the bank on foot.';

export function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    'https://chrishop.jacobmiller22.com'
  ).replace(/\/+$/, '');
}

export function createStorefrontMetadata(): Metadata {
  const baseUrl = getBaseUrl();

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: SITE_DEFAULT_TITLE,
      template: SITE_TITLE_TEMPLATE,
    },
    description: SITE_DEFAULT_DESCRIPTION,
    keywords: [
      'BankBeaters',
      'technical apparel',
      'adventure fishing gear',
      'Leadville CO',
      'small-batch outdoor gear',
      'hand-sewn packs',
      'Curiosity > Fear',
    ],
    authors: [{ name: 'Chris Miller' }],
    creator: 'Chris Miller',
    publisher: 'BankBeaters',
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      title: SITE_DEFAULT_TITLE,
      description: SITE_DEFAULT_DESCRIPTION,
      url: baseUrl,
      siteName: SITE_NAME,
      locale: 'en_US',
      type: 'website',
      images: [
        {
          url: '/api/og',
          width: 1200,
          height: 630,
          alt: 'BankBeaters Adventure Gear - Curiosity > Fear',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: SITE_DEFAULT_TITLE,
      description: SITE_DEFAULT_DESCRIPTION,
      site: '@bankbeaters',
      creator: '@bankbeaters',
      images: ['/api/og'],
    },
  };
}

export const defaultStorefrontMetadata: Metadata = createStorefrontMetadata();

export const homeMetadata: Metadata = {
  title: 'BankBeaters Adventure Gear | Handcrafted in Leadville, CO',
  description:
    'Patagonia-grade technical outdoor and adventure fishing gear hand-sewn by Chris for anglers and explorers who work the bank on foot. Curiosity > Fear.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'BankBeaters Adventure Gear | Handcrafted in Leadville, CO',
    description:
      'Patagonia-grade technical outdoor and adventure fishing gear hand-sewn by Chris for anglers and explorers who work the bank on foot. Curiosity > Fear.',
    url: '/',
    siteName: SITE_NAME,
    images: [
      {
        url: '/api/og?title=BankBeaters%20Adventure%20Gear&badge=Leadville%20CO%20%C2%B7%2010152%20FT',
        width: 1200,
        height: 630,
        alt: 'BankBeaters Adventure Gear - Handcrafted in Leadville, CO',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BankBeaters Adventure Gear | Handcrafted in Leadville, CO',
    description:
      'Patagonia-grade technical outdoor and adventure fishing gear hand-sewn by Chris for anglers and explorers who work the bank on foot. Curiosity > Fear.',
    images: [
      '/api/og?title=BankBeaters%20Adventure%20Gear&badge=Leadville%20CO%20%C2%B7%2010152%20FT',
    ],
  },
};

export const dropsMetadata: Metadata = {
  title: 'Drop Schedule & Upcoming Releases | BankBeaters',
  description:
    'Explore upcoming scheduled drops of handcrafted small-batch technical adventure gear. Live countdown timers, edition sizes, and release locks.',
  alternates: {
    canonical: '/drops',
  },
  openGraph: {
    title: 'Drop Schedule & Upcoming Releases | BankBeaters',
    description:
      'Explore upcoming scheduled drops of handcrafted small-batch technical adventure gear. Live countdown timers, edition sizes, and release locks.',
    url: '/drops',
    siteName: SITE_NAME,
    images: [
      {
        url: '/api/og?title=Drop%20Schedule%20%26%20Releases&badge=Scheduled%20Drops&subtitle=Live%20countdowns%20and%20strictly%20limited%20edition%20runs.',
        width: 1200,
        height: 630,
        alt: 'BankBeaters Drop Schedule & Upcoming Releases',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Drop Schedule & Upcoming Releases | BankBeaters',
    description:
      'Explore upcoming scheduled drops of handcrafted small-batch technical adventure gear. Live countdown timers, edition sizes, and release locks.',
    images: [
      '/api/og?title=Drop%20Schedule%20%26%20Releases&badge=Scheduled%20Drops&subtitle=Live%20countdowns%20and%20strictly%20limited%20edition%20runs.',
    ],
  },
};

export const aboutMetadata: Metadata = {
  title: "The Maker's Story & Workshop Origin | BankBeaters",
  description:
    'The story of BankBeaters Adventure Gear: hand-sewn technical outdoor and adventure fishing apparel built by Chris in Leadville, Colorado. Built for the miles off-trail.',
  alternates: {
    canonical: '/about',
  },
  openGraph: {
    title: "The Maker's Story & Workshop Origin | BankBeaters",
    description:
      'The story of BankBeaters Adventure Gear: hand-sewn technical outdoor and adventure fishing apparel built by Chris in Leadville, Colorado. Built for the miles off-trail.',
    url: '/about',
    siteName: SITE_NAME,
    images: [
      {
        url: '/media/hero/bank-beaters-hero.jpg',
        width: 1200,
        height: 630,
        alt: 'BankBeaters Workshop & Alpine Field Testing - Leadville, Colorado',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "The Maker's Story & Workshop Origin | BankBeaters",
    description:
      'The story of BankBeaters Adventure Gear: hand-sewn technical outdoor and adventure fishing apparel built by Chris in Leadville, Colorado.',
    images: ['/media/hero/bank-beaters-hero.jpg'],
  },
};
