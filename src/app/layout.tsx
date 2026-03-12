import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Providers from '@/components/providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'LAUNCHPAD - AI-Powered Marketing Automation',
  description:
    'Zero intervention. Maximum ROI. LAUNCHPAD automates your entire marketing pipeline with AI.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-zinc-950 text-zinc-100`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
