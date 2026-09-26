import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

export const metadata: Metadata = {
  title: 'NetraCare PHC - AI Diabetic Retinopathy Screening',
  description:
    'AI-powered Diabetic Retinopathy early screening and specialist referral system for Primary Health Centres in rural India.',
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
