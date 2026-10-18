'use client';

import { Button, Heading, Text } from '@binaryiq/ui';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 text-center">
      <Heading level={2}>Something went wrong</Heading>
      <Text color="secondary">An unexpected error occurred. Please try again.</Text>
      <Button onClick={reset}>Retry</Button>
    </main>
  );
}
