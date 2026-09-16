import type { MetadataRoute } from 'next'

/**
 * While the site is paused, nothing is crawlable.
 * To bring the site back, see "Paused state" in README.md.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
  }
}
