import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="bg-bg flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="text-primary mb-6 text-xl font-bold">
        Influencer
      </Link>
      <div className="border-border bg-surface w-full max-w-md rounded-lg border p-6 shadow-md">
        {children}
      </div>
    </div>
  );
}
