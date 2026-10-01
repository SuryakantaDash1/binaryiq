import { Article, Section } from '../_article';

export const metadata = { title: 'Privacy Policy — Influencers' };

export default function PrivacyPage(): React.JSX.Element {
  return (
    <Article title="Privacy Policy" updated="August 2026">
      <p>
        Your privacy matters to us. This policy explains what personal data we collect when you use
        Influencers, why we collect it, and the choices you have. By creating an account you agree to
        the practices described here.
      </p>

      <Section heading="Information we collect">
        <p>
          We collect the details you provide when registering (name, email, date of birth, gender,
          country and postal code), the survey and poll responses you submit, and technical data such
          as your device type and IP address used to keep your account secure.
        </p>
      </Section>

      <Section heading="How we use your information">
        <p>
          We use your data to match you with relevant surveys, credit your reward points, prevent
          fraud, and — only with your consent — send you marketing updates. We never sell your
          personal data.
        </p>
      </Section>

      <Section heading="Cookies">
        <p>
          We use essential cookies for authentication and, with your consent, analytics cookies to
          improve your experience. You can manage your choices at any time from the cookie banner or
          your account privacy settings.
        </p>
      </Section>

      <Section heading="Your rights">
        <p>
          You can access, correct, export or delete your personal data at any time from your account
          settings. To exercise any of these rights or ask a question, contact us at{' '}
          <a href="mailto:privacy@influencers.example" className="text-brand-800 underline">
            privacy@influencers.example
          </a>
          .
        </p>
      </Section>
    </Article>
  );
}
