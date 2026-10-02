import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://netracare.org';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/features', '/how-it-works', '/login', '/register', '/forgot-password', '/reset-password'],
        disallow: [
          '/dashboard/',
          '/dashboard/*',
          '/api/',
          '/storage/',
          '/onboarding/',
          '/_next/',
          '/admin/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
