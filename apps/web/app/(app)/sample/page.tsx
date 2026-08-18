import { Button, Card, CardBody, CardHeader, Heading, Text } from '@influencer/ui';

import { HealthStatus } from './health-status';

/**
 * Token-driven sample page (Phase 0 acceptance #7): renders inside AppShell
 * using only semantic tokens + @influencer/ui primitives, and calls the API
 * through the typed client. Works in light and dark theme.
 */
export default function SamplePage(): React.JSX.Element {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Heading level={2}>Foundation smoke test</Heading>
        <Text color="secondary">
          Design tokens, the base UI kit, and the typed API client — all wired.
        </Text>
      </div>

      <Card>
        <CardHeader>
          <Heading level={5}>API health</Heading>
        </CardHeader>
        <CardBody>
          <HealthStatus />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <Heading level={5}>Buttons</Heading>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Loading</Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <Heading level={5}>Color tokens</Heading>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-3">
          <Swatch label="primary" className="bg-primary text-on-primary" />
          <Swatch label="surface-alt" className="bg-surface-alt text-text" />
          <Swatch label="success" className="bg-success text-white" />
          <Swatch label="danger" className="bg-danger text-white" />
        </CardBody>
      </Card>
    </div>
  );
}

function Swatch({ label, className }: { label: string; className: string }): React.JSX.Element {
  return (
    <div className={`flex h-16 w-28 items-center justify-center rounded-md text-sm ${className}`}>
      {label}
    </div>
  );
}
