import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Montserrat, Poppins } from 'next/font/google';
import { AuthProvider } from '@/lib/auth';
import { QueryProvider } from '@/components/QueryProvider';
import { API_URL } from '@/lib/api';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Best Pilau',
  icons: { icon: '/bestpilau.png' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${montserrat.variable}`}>
      <head>
        <link rel="preconnect" href={new URL(API_URL).origin} />
      </head>
      <body>
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
