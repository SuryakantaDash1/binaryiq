/** Branded, email-client-safe HTML templates (table layout + inline styles). */

/** Served from our own web app, so opening an email doesn't ping a third party. */
const heroImg = (webUrl: string): string => `${webUrl}/images/community-hero.jpg`;

const PINK = '#D91A98';
const BLUE = '#4A2B9D';

interface VerificationParams {
  link: string;
  firstName: string;
  webUrl: string;
}

/** Wraps content in the shared branded shell (logo, hero, footer). */
function shell(webUrl: string, heroBig: string, heroSmall: string, inner: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;margin:0;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
        <!-- Logo -->
        <tr><td style="padding:22px 32px 10px">
          <span style="font-size:22px;font-weight:bold;color:#0f172a;vertical-align:middle">✦ Influencers</span>
          <span style="font-size:12px;color:#64748b"> &nbsp;surveys &amp; rewards</span>
        </td></tr>
        <!-- Hero -->
        <tr><td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td background="${heroImg(webUrl)}" bgcolor="#9A268F" height="190" valign="bottom"
                  style="background-image:url('${heroImg(webUrl)}');background-size:cover;background-position:center;height:190px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                       style="background:linear-gradient(180deg,rgba(17,11,34,0.15),rgba(154,38,143,0.55))">
                  <tr><td style="padding:22px 32px;color:#ffffff">
                    <div style="font-size:22px;font-weight:600">${heroSmall}</div>
                    <div style="font-size:44px;font-weight:800;letter-spacing:-1px;line-height:1">${heroBig}</div>
                  </td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>
        ${inner}
        <!-- Divider -->
        <tr><td style="padding:8px 32px 0"><div style="border-top:1px solid #e2e8f0"></div></td></tr>
        <!-- Footer links -->
        <tr><td style="padding:18px 32px 6px;text-align:center;font-size:13px;color:${BLUE}">
          <a href="${webUrl}/terms" style="color:${BLUE};text-decoration:none">Terms and conditions</a> &nbsp;|&nbsp;
          <a href="${webUrl}/account" style="color:${BLUE};text-decoration:none">Unsubscribe</a> &nbsp;|&nbsp;
          <a href="${webUrl}/faqs" style="color:${BLUE};text-decoration:none">FAQs</a> &nbsp;|&nbsp;
          <a href="${webUrl}/contact" style="color:${BLUE};text-decoration:none">Contact Us</a> &nbsp;|&nbsp;
          <a href="${webUrl}/privacy" style="color:${BLUE};text-decoration:none">Privacy</a>
        </td></tr>
        <!-- Disclaimers -->
        <tr><td style="padding:8px 40px 4px;text-align:center;font-size:12px;color:#94a3b8;line-height:1.6">
          Your participation is completely voluntary, and your responses will remain confidential.<br/>
          Full incentive terms and conditions are available at
          <a href="${webUrl}/terms" style="color:${BLUE}">${webUrl}/terms</a>.
        </td></tr>
        <tr><td style="padding:2px 32px 26px;text-align:center;font-size:12px;color:#94a3b8">
          © 2026 Influencers. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>`;
}

export function verificationEmail(params: VerificationParams): { subject: string; html: string } {
  const { link, firstName, webUrl } = params;
  const inner = `
    <!-- Hello -->
    <tr><td style="padding:26px 32px 0;text-align:center">
      <p style="margin:0;font-size:24px;font-weight:bold;color:${BLUE}">Hello ${firstName}!</p>
    </td></tr>
    <tr><td style="padding:14px 120px 0"><div style="height:3px;background:${BLUE};border-radius:2px"></div></td></tr>
    <!-- Body -->
    <tr><td style="padding:24px 40px 8px;text-align:center;color:#334155;font-size:15px;line-height:1.7">
      You&rsquo;re almost there! Just one more step to share your thoughts and get rewarded on
      Influencers. Please click on the button below to verify your email address.
    </td></tr>
    <!-- Button -->
    <tr><td align="center" style="padding:18px 32px 6px">
      <a href="${link}" style="display:inline-block;background:${PINK};color:#ffffff;padding:15px 40px;border-radius:999px;text-decoration:none;font-weight:bold;font-size:15px">Confirm your email</a>
    </td></tr>
    <!-- Fallback -->
    <tr><td style="padding:14px 32px 0;text-align:center;color:#64748b;font-size:13px">
      If the button doesn&rsquo;t work, please <a href="${link}" style="color:${BLUE}">click here</a>.
    </td></tr>
    <!-- Sign-off -->
    <tr><td style="padding:22px 32px 2px;text-align:center;color:#334155;font-size:15px">See you soon!</td></tr>
    <tr><td style="padding:0 32px 22px;text-align:center;color:${PINK};font-size:16px;font-weight:bold">The Influencers Team</td></tr>`;

  return {
    subject: "Thank you for joining Influencers! Don't forget to verify your email address",
    html: shell(webUrl, 'Started', 'Get', inner),
  };
}

interface ResetParams {
  link: string;
  firstName: string;
  webUrl: string;
}

export function passwordResetEmail(params: ResetParams): { subject: string; html: string } {
  const { link, firstName, webUrl } = params;
  const inner = `
    <tr><td style="padding:26px 32px 0;text-align:center">
      <p style="margin:0;font-size:24px;font-weight:bold;color:${BLUE}">Hello ${firstName}!</p>
    </td></tr>
    <tr><td style="padding:14px 120px 0"><div style="height:3px;background:${BLUE};border-radius:2px"></div></td></tr>
    <tr><td style="padding:24px 40px 8px;text-align:center;color:#334155;font-size:15px;line-height:1.7">
      We received a request to reset your password. Click the button below to choose a new one.
      If you didn&rsquo;t request this, you can safely ignore this email.
    </td></tr>
    <tr><td align="center" style="padding:18px 32px 6px">
      <a href="${link}" style="display:inline-block;background:${PINK};color:#ffffff;padding:15px 40px;border-radius:999px;text-decoration:none;font-weight:bold;font-size:15px">Reset your password</a>
    </td></tr>
    <tr><td style="padding:14px 32px 0;text-align:center;color:#64748b;font-size:13px">
      If the button doesn&rsquo;t work, please <a href="${link}" style="color:${BLUE}">click here</a>.
      This link expires in 1 hour.
    </td></tr>
    <tr><td style="padding:22px 32px 22px;text-align:center;color:${PINK};font-size:16px;font-weight:bold">The Influencers Team</td></tr>`;

  return {
    subject: 'Reset your Influencers password',
    html: shell(webUrl, 'Reset', 'Password', inner),
  };
}
