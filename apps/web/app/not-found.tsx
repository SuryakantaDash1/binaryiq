import { Button, Heading, Text } from '@binaryiq/ui';
import Link from 'next/link';

export default function NotFound(): React.JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 text-center">
      <Heading level={1}>404</Heading>
      <Text color="secondary">This page could not be found.</Text>
      <Link href="/">
        <Button variant="outline">Go home</Button>
      </Link>
    </main>
  );
}
