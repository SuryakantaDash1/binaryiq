/** Minimal branded email templates. Full HTML templates land in Phase 7. */

export function verificationEmail(link: string): { subject: string; html: string } {
  return {
    subject: 'Confirm your registration',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#E91E8C">Welcome to Influencer Platform!</h2>
        <p>Confirm your email to activate your account and claim your
           <strong>500 welcome points</strong>.</p>
        <p><a href="${link}"
              style="display:inline-block;background:#E91E8C;color:#fff;padding:12px 20px;
                     border-radius:8px;text-decoration:none">Confirm your registration</a></p>
        <p style="color:#64748B;font-size:12px">This link expires in 24 hours.</p>
      </div>`,
  };
}

export function passwordResetEmail(link: string): { subject: string; html: string } {
  return {
    subject: 'Reset your password',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#E91E8C">Reset your password</h2>
        <p>Click below to choose a new password. If you didn't request this, ignore this email.</p>
        <p><a href="${link}"
              style="display:inline-block;background:#E91E8C;color:#fff;padding:12px 20px;
                     border-radius:8px;text-decoration:none">Reset password</a></p>
        <p style="color:#64748B;font-size:12px">This link expires in 1 hour.</p>
      </div>`,
  };
}
