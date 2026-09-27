// Company logos via Google's public favicon service (s2/favicons) rather than
// Clearbit's -- logo.clearbit.com no longer resolves; the free Logo API it
// offered was retired. Google's endpoint returns a small favicon-sized mark,
// not a full logo, which is a real limitation for a wordmark-heavy brand, but
// it needs no key and every domain below was checked by eye against the real
// brand before being added.
//
// A ticker with no entry here renders with no logo rather than a broken image
// or a guessed domain -- wrong logos are worse than no logo.
const TICKER_DOMAIN: Record<string, string> = {
  VWRL: 'vanguard.co.uk',
  KNOS: 'kainos.com',
  NVDA: 'nvidia.com',
  GOOGL: 'google.com',
  PYPL: 'paypal.com',
  BMNR: 'bitminetech.io',
}

// Real brand assets, checked in under public/logos/, take priority over the
// favicon lookup below where one has been supplied -- KNOS's favicon is a
// plain gradient sphere with no wordmark, nothing like the real Kainos mark.
const LOCAL_LOGO: Record<string, string> = {
  KNOS: '/logos/kainos.png',
}

export function logoUrl(ticker: string, size = 64): string | null {
  if (LOCAL_LOGO[ticker]) return LOCAL_LOGO[ticker]
  const domain = TICKER_DOMAIN[ticker]
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}` : null
}
