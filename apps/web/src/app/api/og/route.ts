import { NextRequest } from 'next/server';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const title = (searchParams.get('title') || 'BankBeaters Adventure Gear').slice(0, 70);
  const subtitle = (
    searchParams.get('subtitle') ||
    searchParams.get('description') ||
    'Handcrafted technical outdoor & adventure fishing gear hand-sewn in Leadville, CO.'
  ).slice(0, 120);
  const badge = (searchParams.get('badge') || 'Leadville, CO · Elev. 10,152 FT').slice(0, 40);
  const price = searchParams.get('price')?.slice(0, 20);

  const escapedTitle = escapeXml(title);
  const escapedSubtitle = escapeXml(subtitle);
  const escapedBadge = escapeXml(badge);
  const escapedPrice = price ? escapeXml(price) : null;

  const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg-grad" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0F1215" />
      <stop offset="100%" stop-color="#15191E" />
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#232A32" stroke-width="0.75" opacity="0.6" />
    </pattern>
    <linearGradient id="orange-glow" x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#E55B24" />
      <stop offset="50%" stop-color="#F28C38" />
      <stop offset="100%" stop-color="#E55B24" />
    </linearGradient>
  </defs>

  <!-- Background Base -->
  <rect width="1200" height="630" fill="url(#bg-grad)" />
  <rect width="1200" height="630" fill="url(#grid)" />

  <!-- Outer Technical Border -->
  <rect x="24" y="24" width="1152" height="582" rx="16" fill="none" stroke="#28313A" stroke-width="1.5" />
  <line x1="24" y1="90" x2="1176" y2="90" stroke="#28313A" stroke-width="1.5" />
  <line x1="24" y1="540" x2="1176" y2="540" stroke="#28313A" stroke-width="1.5" />

  <!-- Top Banner Bar -->
  <rect x="56" y="44" width="8" height="24" rx="2" fill="#E55B24" />
  <text x="76" y="62" fill="#E55B24" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="14" font-weight="700" letter-spacing="3">BANKBEATERS</text>
  <text x="210" y="62" fill="#6B7280" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="14" letter-spacing="2">// ADVENTURE GEAR WORKSHOP</text>

  <!-- Top Right Origin Badge -->
  <rect x="880" y="44" width="240" height="26" rx="13" fill="#1B2228" stroke="#374151" stroke-width="1" />
  <circle cx="896" cy="57" r="4" fill="#E55B24" />
  <text x="910" y="61" fill="#D1D5DB" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="11" font-weight="600" letter-spacing="1">LEADVILLE, CO · 10,152 FT</text>

  <!-- Badge Pill -->
  <g transform="translate(56, 140)">
    <rect x="0" y="0" width="auto" height="32" rx="16" fill="#2C362B" stroke="#3F4F3D" stroke-width="1" />
    <text x="16" y="21" fill="#6EE7B7" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="13" font-weight="700" letter-spacing="1.5">${escapedBadge.toUpperCase()}</text>
  </g>

  <!-- Product / Content Title -->
  <text x="56" y="240" fill="#F3F4F6" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="52" font-weight="900" letter-spacing="-1">
    ${escapedTitle.toUpperCase()}
  </text>

  <!-- Subtitle Description -->
  <text x="56" y="300" fill="#9CA3AF" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="400">
    ${escapedSubtitle}
  </text>

  <!-- Dynamic Price or Highlight Tag -->
  ${
    escapedPrice
      ? `
  <g transform="translate(56, 360)">
    <rect x="0" y="0" width="180" height="56" rx="12" fill="#15191E" stroke="#E55B24" stroke-width="2" />
    <text x="24" y="38" fill="#E55B24" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="28" font-weight="900">${escapedPrice}</text>
    <text x="200" y="36" fill="#6B7280" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="14" letter-spacing="1">MSRP · LIMITED SMALL-BATCH EDITION</text>
  </g>`
      : `
  <g transform="translate(56, 360)">
    <rect x="0" y="0" width="280" height="40" rx="8" fill="#15191E" stroke="#374151" stroke-width="1" />
    <text x="20" y="25" fill="#E5E7EB" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="13" font-weight="700" letter-spacing="1.5">PATAGONIA-GRADE CRAFTSMANSHIP</text>
  </g>`
  }

  <!-- Bottom Details Bar -->
  <text x="56" y="575" fill="#E55B24" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="14" font-weight="700" letter-spacing="2">CURIOSITY &gt; FEAR</text>
  <text x="230" y="575" fill="#4B5563" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="13" letter-spacing="1">· HAND-SEWN SINGLE-NEEDLE LOCKSTITCH · ZERO COMPROMISE</text>
  <text x="1120" y="575" text-anchor="end" fill="#6B7280" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="13" letter-spacing="1">chrishop.jacobmiller22.com</text>
</svg>
`.trim();

  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
    },
  });
}
