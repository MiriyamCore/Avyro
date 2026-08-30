'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signOut } from '@/lib/api';

export function SignOutButton({
  className = '',
  variant = 'link',
}: {
  className?: string;
  variant?: 'link' | 'button';
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      await signOut();
    } catch {
      // Still redirect — session may already be cleared.
    } finally {
      router.push('/login');
      router.refresh();
      setLoading(false);
    }
  }

  if (variant === 'button') {
    return (
      <button
        type="button"
        className={`ac-btn-secondary ${className}`.trim()}
        onClick={() => void handleSignOut()}
        disabled={loading}
      >
        {loading ? 'Signing out…' : 'Sign out'}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`text-xs font-semibold text-muted transition hover:text-danger ${className}`.trim()}
      onClick={() => void handleSignOut()}
      disabled={loading}
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
