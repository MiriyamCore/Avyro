import type { Metadata } from 'next';
import './globals.css';
import { themeInitScript } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'Avyro',
  description:
    'Avyro is an open-source business OS for managing your finances, people, compliance, and operations in one place.',
  icons: {
    icon: '/avyro-icon.png',
    apple: '/avyro-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="text-ink">{children}</body>
    </html>
  );
}
