import { Button, Heading, Text } from '@influencer/ui';
import Link from 'next/link';

export default function LandingPage(): React.JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <Heading level={1}>Influencer Platform</Heading>
      <Text color="secondary" size="lg">
        Take surveys, vote on polls, spin the daily wheel — and earn rewards.
      </Text>
      <div className="flex gap-3">
        <Link href="/sample">
          <Button>View sample (Phase 0)</Button>
        </Link>
        <Link href="/sample">
          <Button variant="outline">Explore</Button>
        </Link>
      </div>
      <Text color="muted" size="sm">
        Phase 0 skeleton — feature flows land in later phases.
      </Text>
    </main>
  );
}
