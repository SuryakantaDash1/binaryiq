import { Article, Section } from '../_article';

export const metadata = { title: 'Contact Us — Influencers' };

export default function ContactPage(): React.JSX.Element {
  return (
    <Article title="Contact Us">
      <p>
        We are here to help. Choose the option that best fits your question and we will get back to
        you as soon as we can.
      </p>

      <Section heading="Member support">
        <p>
          For questions about your account, points or rewards, sign in and open the Luna chat
          assistant, or email{' '}
          <a href="mailto:support@influencers.example" className="text-pink-600 underline">
            support@influencers.example
          </a>
          . We typically reply within 1–2 business days.
        </p>
      </Section>

      <Section heading="Privacy requests">
        <p>
          For data access, export or deletion requests, email{' '}
          <a href="mailto:privacy@influencers.example" className="text-pink-600 underline">
            privacy@influencers.example
          </a>{' '}
          or use the tools in your account privacy settings.
        </p>
      </Section>

      <Section heading="Business & partnerships">
        <p>
          Interested in running research with our community? Reach out to{' '}
          <a href="mailto:partners@influencers.example" className="text-pink-600 underline">
            partners@influencers.example
          </a>
          .
        </p>
      </Section>
    </Article>
  );
}
