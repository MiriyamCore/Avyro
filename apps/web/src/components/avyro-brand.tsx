import Link from 'next/link';

const AVYRO_URL = 'https://miriyamcore.com/avyro';

export function PoweredByAvyro({
  className = '',
  align = 'center',
}: {
  className?: string;
  align?: 'center' | 'left';
}) {
  return (
    <div
      className={`text-[10px] text-muted ${align === 'center' ? 'text-center' : 'text-left'} ${className}`.trim()}
    >
      <a
        href={AVYRO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="transition hover:text-brand"
      >
        Powered by Avyro
      </a>
    </div>
  );
}

export function AvyroIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/avyro-icon.svg" alt="" className={`shrink-0 ${className}`} />
  );
}

export function AvyroLogo({ className = 'h-8 w-auto' }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/avyro-logo.svg" alt="Avyro" className={className} />
  );
}

export function AvyroSidebarBrand() {
  return (
    <Link href="/app" className="flex items-center gap-2.5">
      <AvyroIcon className="h-9 w-9" />
      <span className="text-base font-semibold tracking-tight text-[#050a30]">Avyro</span>
    </Link>
  );
}

export function AvyroHomeLink({
  className = 'h-14 w-auto sm:h-16',
  linkClassName = '',
}: {
  className?: string;
  linkClassName?: string;
}) {
  return (
    <Link href="/" className={`inline-block ${linkClassName}`.trim()}>
      <AvyroLogo className={className} />
    </Link>
  );
}
