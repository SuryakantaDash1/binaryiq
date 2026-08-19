import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface px-6 py-4">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-text">Admin Dashboard</span>
          <nav className="flex gap-4 text-sm">
            <a
              href="/admin/support"
              className="text-text/60 hover:text-text transition-colors"
            >
              Support Tickets
            </a>
          </nav>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
