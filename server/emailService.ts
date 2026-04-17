import crypto from 'crypto';

const ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL || 'admin@nutricoreapp.com';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

async function sendEmail(options: EmailOptions): Promise<boolean> {
  console.log(`[EMAIL SERVICE] Attempting to send email to: ${options.to}`);
  console.log(`[EMAIL SERVICE] Subject: ${options.subject}`);
  
  try {
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (sendgridApiKey) {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: options.to }] }],
          from: { email: 'noreply@nutricoreapp.com', name: 'NutriCore' },
          subject: options.subject,
          content: [
            { type: 'text/html', value: options.html },
            ...(options.text ? [{ type: 'text/plain', value: options.text }] : []),
          ],
        }),
      });
      
      if (response.ok || response.status === 202) {
        console.log(`[EMAIL SERVICE] Email sent successfully via SendGrid`);
        return true;
      }
      console.error(`[EMAIL SERVICE] SendGrid error: ${response.status}`);
    }
    
    if (resendApiKey) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'NutriCore <noreply@nutricoreapp.com>',
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
      });
      
      if (response.ok) {
        console.log(`[EMAIL SERVICE] Email sent successfully via Resend`);
        return true;
      }
      console.error(`[EMAIL SERVICE] Resend error: ${response.status}`);
    }
    
    console.log(`[EMAIL SERVICE] No email service configured - email logged only`);
    console.log(`[EMAIL SERVICE] HTML Content: ${options.html.substring(0, 500)}...`);
    return false;
  } catch (error) {
    console.error('[EMAIL SERVICE] Error sending email:', error);
    return false;
  }
}

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function getVerificationExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24);
  return expiry;
}

export async function sendVerificationEmail(email: string, token: string, firstName?: string): Promise<boolean> {
  const verificationUrl = `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'https://nutricoreapp.com'}/verify-email?token=${token}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Outfit', 'Segoe UI', sans-serif; background: #0a0a0a; color: #fff; padding: 40px; }
    .container { max-width: 600px; margin: 0 auto; background: #111; border-radius: 16px; padding: 40px; }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo h1 { color: #6b8e5f; font-size: 32px; margin: 0; }
    .content { line-height: 1.7; color: #ccc; }
    .button { display: inline-block; background: linear-gradient(135deg, #6b8e5f, #4a5d4a); color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 600; margin: 24px 0; }
    .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>NutriCore</h1>
    </div>
    <div class="content">
      <h2>Welcome to the Focus Group${firstName ? `, ${firstName}` : ''}!</h2>
      <p>Thank you for signing up for the NutriCore Focus Group. You're one step away from joining our exclusive community of early adopters.</p>
      <p>Please verify your email address to complete your registration:</p>
      <p style="text-align: center;">
        <a href="${verificationUrl}" class="button">Verify My Email</a>
      </p>
      <p>After verification, you'll be added to our waitlist. Once your spot opens, you'll receive full access to:</p>
      <ul>
        <li>Personalized workout plans</li>
        <li>Custom diet recommendations</li>
        <li>Memory-based AI coaching</li>
        <li>Unlimited chat with your trainer</li>
      </ul>
      <p>This link expires in 24 hours.</p>
    </div>
    <div class="footer">
      <p>NutriCore - AI Fitness That Knows You</p>
      <p>If you didn't sign up, please ignore this email.</p>
    </div>
  </div>
</body>
</html>
  `;
  
  return sendEmail({
    to: email,
    subject: 'Verify Your Email - NutriCore Focus Group',
    html,
    text: `Welcome to NutriCore! Please verify your email by visiting: ${verificationUrl}`,
  });
}

export async function sendActivationEmail(email: string, firstName?: string): Promise<boolean> {
  const appUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
    : 'https://nutricoreapp.com';
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Outfit', 'Segoe UI', sans-serif; background: #0a0a0a; color: #fff; padding: 40px; }
    .container { max-width: 600px; margin: 0 auto; background: #111; border-radius: 16px; padding: 40px; }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo h1 { color: #6b8e5f; font-size: 32px; margin: 0; }
    .content { line-height: 1.7; color: #ccc; }
    .highlight { background: linear-gradient(135deg, #6b8e5f22, #4a5d4a22); border-left: 4px solid #6b8e5f; padding: 20px; margin: 24px 0; border-radius: 8px; }
    .button { display: inline-block; background: linear-gradient(135deg, #d4af37, #c9a032); color: #1a1a1a; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 600; margin: 24px 0; }
    .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>NutriCore</h1>
    </div>
    <div class="content">
      <h2>You're In${firstName ? `, ${firstName}` : ''}! 🎉</h2>
      <div class="highlight">
        <strong>You've been granted full access to the NutriCore Focus Group.</strong>
      </div>
      <p>Your spot has opened up, and you now have complete access to all premium features:</p>
      <ul>
        <li><strong>Personalized Workout Plans</strong> - AI-generated training programs</li>
        <li><strong>Custom Diet Plans</strong> - Macro-optimized meal recommendations</li>
        <li><strong>Memory-Based AI</strong> - Your trainer remembers everything about you</li>
        <li><strong>Unlimited Chat</strong> - No message limits</li>
        <li><strong>Progress Tracking</strong> - Full coaching continuity</li>
      </ul>
      <p style="text-align: center;">
        <a href="${appUrl}/chat" class="button">Start Training Now</a>
      </p>
      <p>As a Focus Group member, your feedback is invaluable. We'd love to hear about your experience!</p>
    </div>
    <div class="footer">
      <p>NutriCore - AI Fitness That Knows You</p>
      <p>Thank you for being an early adopter!</p>
    </div>
  </div>
</body>
</html>
  `;
  
  return sendEmail({
    to: email,
    subject: "You're In! Full NutriCore Access Activated",
    html,
    text: `Congratulations${firstName ? ` ${firstName}` : ''}! You've been granted full access to NutriCore Focus Group. Enjoy unlimited training and nutrition coaching. Start now: ${appUrl}/chat`,
  });
}

export async function notifyAdminNewSignup(userEmail: string, firstName?: string): Promise<void> {
  const html = `
    <h2>New Focus Group Signup</h2>
    <p><strong>Email:</strong> ${userEmail}</p>
    <p><strong>Name:</strong> ${firstName || 'Not provided'}</p>
    <p><strong>Status:</strong> Waitlist (pending verification)</p>
    <p>Log in to the admin dashboard to manage this user.</p>
  `;
  
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `[NutriCore] New Focus Group Signup: ${userEmail}`,
    html,
  });
}
