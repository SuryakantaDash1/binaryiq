import { Article, Section } from '../_article';

export const metadata = { title: 'Cookies Policy — Influencers' };

export default function CookiesPage(): React.JSX.Element {
  return (
    <Article title="Cookies Policy" updated="August 2026">
      <p>
        Cookies are small text files stored on your device. We use them to keep you signed in, to
        remember your preferences, and — with your consent — to understand how the platform is used.
      </p>

      <Section heading="Essential cookies">
        <p>
          These are required for the site to work. They keep you authenticated, secure your session
          and remember your language choice. They cannot be switched off.
        </p>
      </Section>

      <Section heading="Analytics cookies">
        <p>
          With your consent, we use analytics cookies to measure how members interact with the
          platform so we can improve it. You can accept or decline these from the cookie banner.
        </p>
      </Section>

      <Section heading="Managing cookies">
        <p>
          You can change your choice at any time by clearing your cookies or using the “Essential
          only” option in the banner. Blocking essential cookies may prevent you from signing in.
        </p>
      </Section>
    </Article>
  );
}
