import type { ReactNode } from 'react';

import { AppHeader } from '../../features/app/AppHeader.js';
import { AuthGate } from '../../features/app/AuthGate.js';
import { LunaBubble } from '../../features/landing/LunaBubble.js';

export default function AppGroupLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <AuthGate>
    <div className="flex min-h-screen flex-col bg-gray-50">
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6">{children}</main>

      {/* Same Byte bubble as the public pages, but backed by real chatbot flows +
          actual SupportTicket creation now that the user is authenticated. */}
      <LunaBubble authenticated />

      <footer className="border-t border-gray-200 py-3 text-center text-[10px] text-gray-400">
        SSL Secured · DPDP 2023 Compliant · CERT-In Registered
      </footer>
    </div>
    </AuthGate>
  );
}
