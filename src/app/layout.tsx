import type { ReactNode } from 'react';

// The real <html>/<body> live in app/[locale]/layout.tsx, which is where the
// `dir` and `lang` attributes are set per locale.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
