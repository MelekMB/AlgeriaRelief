import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['ar', 'fr'],
  defaultLocale: 'ar',
  // Always prefix so every URL is unambiguous and shareable into WhatsApp/Facebook.
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];

export const isRtl = (locale: string) => locale === 'ar';

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
