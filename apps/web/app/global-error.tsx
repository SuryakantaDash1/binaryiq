'use client';

/**
 * Last-resort boundary for errors in the root layout itself. Deliberately shows
 * no error details — messages and stacks can contain internal or personal data.
 */
export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f9fafb' }}>
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 16,
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: 24, margin: 0, color: '#111827' }}>Something went wrong</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>An unexpected error occurred. Please try again.</p>
          <button
            type="button"
            onClick={reset}
            style={{ padding: '10px 24px', borderRadius: 9999, border: 0, background: '#111827', color: '#fff', cursor: 'pointer' }}
          >
            Retry
          </button>
        </main>
      </body>
    </html>
  );
}
