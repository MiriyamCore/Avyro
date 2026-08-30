'use client';

import { useEffect } from 'react';
import { AvyroHomeLink, PoweredByAvyro } from '@/components/avyro-brand';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    api('/api/v1/me')
      .then(() => router.replace('/app'))
      .catch(() => undefined);
  }, [router]);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 15% 10%, rgba(0,183,255,0.14), transparent 60%), radial-gradient(ellipse 50% 40% at 90% 20%, rgba(189,32,255,0.1), transparent 55%)',
        }}
      />
      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-14 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <AvyroHomeLink />
          <p className="mt-2 text-lg font-medium text-ink-soft">
            The open-source operating system for business.
          </p>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-soft">
            Avyro brings accounting, invoicing, expenses, banking, payroll, compliance, projects,
            and everyday operations into one connected system — built for small businesses that want
            simplicity without sacrificing proper financial foundations.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="ac-btn-primary px-5 py-3 text-base">
              Sign in
            </Link>
          </div>
          <p className="mt-6 text-sm text-muted">
            Open source · Multi-currency · Bangladesh Mushak-ready
          </p>
        </div>

        <div className="ac-card overflow-hidden shadow-[0_24px_60px_rgba(0,71,255,0.12)] dark:shadow-[0_24px_60px_rgba(125,137,255,0.18)]">
          <div className="avyro-gradient-bg border-b border-line px-5 py-4 text-white">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">
              Demo Trading Co
            </div>
            <div className="mt-1 font-display text-2xl font-semibold">Business snapshot</div>
          </div>
          <div className="grid grid-cols-2 gap-px bg-line">
            {[
              ['Revenue', '৳ 0.00'],
              ['Cash', '৳ 0.00'],
              ['Owed to us', '৳ 0.00'],
              ['Profit', '৳ 0.00'],
            ].map(([label, value]) => (
              <div key={label} className="bg-paper-elevated px-5 py-6">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {label}
                </div>
                <div className="mt-2 font-mono text-xl font-medium text-ink">{value}</div>
              </div>
            ))}
          </div>
          <div className="border-t border-line px-5 py-4 text-sm text-ink-soft">
            Customers → Invoices → Payments → Ledger posts itself.
          </div>
        </div>
      </div>
      <PoweredByAvyro className="absolute bottom-6 left-0 right-0" />
    </main>
  );
}
