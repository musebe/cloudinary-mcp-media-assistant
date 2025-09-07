import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

import { ThemeProvider } from '@/components/theme/theme-provider';
import { Navbar } from '@/components/site/navbar';
import { Footer } from '@/components/site/footer';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Cloudinary MCP Chat',
  description: 'Demo chat with Cloudinary remote MCP',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body
        className={`${sans.variable} ${mono.variable} min-h-screen antialiased`}
      >
        <ThemeProvider>
          <Navbar />
          <main className='mx-auto w-full max-w-6xl px-4 py-6'>{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
