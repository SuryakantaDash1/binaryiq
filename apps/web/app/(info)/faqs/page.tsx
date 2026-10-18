import { Article, Section } from '../_article';

export const metadata = { title: "FAQ's — BinaryIQ" };

export default function FaqsPage(): React.JSX.Element {
  return (
    <Article title="Frequently Asked Questions">
      <Section heading="Is it free to join?">
        <p>Yes. Creating an account and taking part is completely free, and you receive 500 welcome points once you confirm your email.</p>
      </Section>

      <Section heading="How do I earn points?">
        <p>You earn points by completing surveys and polls matched to your profile, and by taking part in daily activities. The points are credited to your balance once your response is validated.</p>
      </Section>

      <Section heading="How do I redeem my points?">
        <p>Head to the Rewards section and choose from gift cards, vouchers and other options. Redemptions are processed after a short validation check.</p>
      </Section>

      <Section heading="Why don't I qualify for every survey?">
        <p>Each survey looks for people who match a specific profile. If you don't qualify, it simply means that survey was looking for a different audience — more will come your way.</p>
      </Section>

      <Section heading="How do I change my language?">
        <p>Use the language selector on the home page. Your choice is remembered and applied across the whole platform.</p>
      </Section>

      <Section heading="Still need help?">
        <p>Open the Byte chat assistant on any page, or visit the Contact Us page to reach our support team.</p>
      </Section>
    </Article>
  );
}
