'use client';

import { useSiteImage } from '@/features/site-images/SiteImages';

/**
 * Full-screen dark brand canvas behind the auth card: the admin-managed "auth" photo,
 * dimmed and blurred, under brand glows and a faint dot grid.
 */
export function AuthBackdrop(): React.JSX.Element {
  const image = useSiteImage('auth');
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink" aria-hidden>
      <div
        className="absolute inset-0 scale-110 bg-cover bg-center opacity-30 blur-sm"
        style={{ backgroundImage: `url(${image})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-brand-950/80 to-ink" />
      <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-brand-600/30 blur-3xl" />
      <div className="absolute -bottom-48 -right-32 h-[36rem] w-[36rem] rounded-full bg-brand-900/50 blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '22px 22px' }}
      />
    </div>
  );
}
