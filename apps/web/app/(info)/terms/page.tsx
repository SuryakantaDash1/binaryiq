import { Article, Section } from '../_article';

export const metadata = { title: 'Terms & Conditions — Influencers' };

export default function TermsPage(): React.JSX.Element {
  return (
    <Article title="Terms & Conditions" updated="August 2026">
      <p>
        These terms govern your use of Influencers. By registering an account you agree to follow
        them. Please read them carefully.
      </p>

      <Section heading="Membership">
        <p>
          Membership is free and open to individuals who meet the minimum age requirement for their
          country. You are responsible for keeping your login details secure and for the accuracy of
          the information in your profile.
        </p>
      </Section>

      <Section heading="Earning and redeeming points">
        <p>
          You earn points by completing eligible surveys, polls and activities. Points have no cash
          value until redeemed through the rewards catalogue, and are subject to validation. We may
          reverse points awarded for incomplete, fraudulent or duplicate activity.
        </p>
      </Section>

      <Section heading="Acceptable use">
        <p>
          You agree not to submit false responses, use automated tools, hold multiple accounts, or
          interfere with the platform. Violations may result in suspension and forfeiture of points.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          We may update these terms from time to time. We will notify you of material changes, and
          continued use of the platform after an update constitutes acceptance.
        </p>
      </Section>
    </Article>
  );
}
