import { Article, Section } from '../_article';

export const metadata = { title: 'About Us — Influencers' };

export default function AboutPage(): React.JSX.Element {
  return (
    <Article title="About Us">
      <p>
        Influencers is a global community where everyday people share their opinions and get rewarded
        for it. Brands want to hear from real people — and we make sure your voice reaches them while
        you earn points redeemable for gift cards, vouchers and more.
      </p>

      <Section heading="Our mission">
        <p>
          We believe every opinion counts. Our mission is to give members a fun, fair and rewarding
          way to influence the products and services they use every day.
        </p>
      </Section>

      <Section heading="How it works">
        <p>
          Create a free account, complete your profile, and start receiving surveys and polls matched
          to you. Every completed activity earns points you can redeem from our rewards catalogue.
        </p>
      </Section>

      <Section heading="Our community">
        <p>
          Millions of members across dozens of countries take part every month, in over 20 languages.
          Together, they help shape the brands of tomorrow.
        </p>
      </Section>
    </Article>
  );
}
