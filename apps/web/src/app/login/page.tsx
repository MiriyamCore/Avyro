'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AvyroHomeLink, PoweredByAvyro } from '@/components/avyro-brand';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

const DEFAULT_SEED_EMAIL = 'owner@demo.local';
const DEFAULT_SEED_PASSWORD = 'ChangeMeNow1!';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(DEFAULT_SEED_EMAIL);
  const [password, setPassword] = useState(DEFAULT_SEED_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api('/api/auth/sign-in/email', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      router.push('/app');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api('/api/v1/me')
      .then(() => router.replace('/app'))
      .catch(() => undefined);
  }, [router]);

  return (
    <main className="relative mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
      <AvyroHomeLink className="h-10 w-auto" linkClassName="mb-8" />
      <div className="ac-card p-6 sm:p-8">
        <h1 className="font-display text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-ink-soft">Sign in to your organisation workspace.</p>
        <form onSubmit={onSubmit} className="mt-6 grid gap-4">
          <label>
            <span className="ac-label">Email</span>
            <input
              className="ac-input"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            <span className="ac-label">Password</span>
            <input
              className="ac-input"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button type="submit" className="ac-btn-primary" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
      <p className="mt-5 text-center text-xs text-muted">
        Local dev seed · {DEFAULT_SEED_EMAIL} / {DEFAULT_SEED_PASSWORD}
      </p>
      <PoweredByAvyro className="mt-4" />
    </main>
  );
}
