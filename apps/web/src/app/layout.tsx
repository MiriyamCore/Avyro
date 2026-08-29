import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Avyro',
  description:
    'Avyro is an open-source business OS for managing your finances, people, compliance, and operations in one place.',
  icons: {
    icon: '/favicon.png',
    apple: '/avyro-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="text-ink">{children}</body>
    </html>
  );
}
