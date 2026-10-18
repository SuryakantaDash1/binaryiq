import { Heading, Text } from '@binaryiq/ui';
import { ConsentCentre } from '../../../../features/privacy/ConsentCentre.js';

export default function PrivacyPage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <Heading level={2}>Privacy &amp; Data</Heading>
        <Text color="secondary" size="sm" className="mt-1">
          Manage your consent preferences and personal data rights.
        </Text>
      </div>
      <ConsentCentre />
    </div>
  );
}
