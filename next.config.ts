import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Replit runs behind a proxy; keep responses small and cacheable.
  poweredByHeader: false,
  compress: true,
  // postgres-js uses node built-ins (tls, stream); keep it out of the bundler.
  serverExternalPackages: ['postgres'],
  experimental: {
    // Server Actions are used for post/claim/confirm flows.
    serverActions: { bodySizeLimit: '2mb' },
  },
};

export default withNextIntl(nextConfig);
