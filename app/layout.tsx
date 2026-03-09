import type { Metadata, Viewport } from 'next';
import { DM_Sans, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Script from 'next/script';
import { CookieConsent } from './components/CookieConsent';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Estate AI',
  description: 'AI-powered assistant for real estate agents',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Estate AI',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/* PWA / Apple Touch Icons */}
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
        <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
      </head>
      <body className="bg-[var(--background)] text-[var(--foreground)] transition-colors">
        {/* Font Awesome JS */}
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js"
          integrity="sha384-Y7LSKwoY+C2iyfu/oupNnkGEN3EgA6skmJeVg5AyQk7ttcjX0XsLREmmuJW/SdbU"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
