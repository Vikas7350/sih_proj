import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

export const viewport: Viewport = {
  themeColor: '#0B3A3F',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    template: '%s | NetraCare PHC',
    default: 'NetraCare PHC - AI Diabetic Retinopathy Screening',
  },
  description:
    'AI-powered Diabetic Retinopathy early screening, clinical grade assessment, and automated patient follow-up system for Primary Health Centres.',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', sizes: 'any' },
    ],
    apple: [
      { url: '/icon.svg', sizes: '180x180', type: 'image/svg+xml' },
    ],
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'NetraCare - AI Diabetic Retinopathy Screening for Rural PHCs',
    description: 'Empowering primary health care workers with fast, accurate AI screening for diabetic retinopathy.',
    siteName: 'NetraCare',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${spaceGrotesk.variable} min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-teal-600 selection:text-white`}
      >
        {children}
      </body>
    </html>
  );
}
