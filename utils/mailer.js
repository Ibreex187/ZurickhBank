const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
const { promisify } = require('util');

const renderFile = promisify(ejs.renderFile);

async function createTransporter() {
  const hasSmtpConfig = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

  if (hasSmtpConfig) {
    return {
      hasSmtpConfig,
      transporter: nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
    };
  }

  const testAccount = await nodemailer.createTestAccount();
  return {
    hasSmtpConfig,
    transporter: nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    })
  };
}

async function sendWelcomeEmail(to, name, username, accountNumber = '') {
  if (!to) throw new Error('Missing recipient email');

  const { transporter, hasSmtpConfig } = await createTransporter();

  const fromAddress = process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@example.com';

  // Try rendering the EJS template; fall back to a simple HTML body if rendering fails
  let htmlBody;
  try {
    const templatePath = path.join(__dirname, '..', 'middleware', 'views', 'welcomeMail.ejs');
    htmlBody = await renderFile(templatePath, { name, username, accountNumber, supportEmail: process.env.SUPPORT_EMAIL });
  } catch (err) {
    console.error('EJS render failed, falling back to default HTML:', err.message);
    htmlBody = `
      <p>Hi ${name || username || 'there'},</p>
      <p>Welcome to Zurich Bank! Your account (${accountNumber || 'N/A'}) has been successfully created.</p>
      <p>— The Zurich Bank Team</p>
    `;
  }

  const mailOptions = {
    from: fromAddress,
    to,
    subject: 'Welcome to Zurich Bank — Account Created',
    html: htmlBody,
  };

  const info = await transporter.sendMail(mailOptions);

  if (!hasSmtpConfig) {
    // Print preview URL for Ethereal
    console.log('Ethereal preview URL:', nodemailer.getTestMessageUrl(info));
  }

  return info;
}

async function sendOtpEmail(to, name, otp, context = 'verification') {
  if (!to) throw new Error('Missing recipient email');

  const { transporter, hasSmtpConfig } = await createTransporter();
  const fromAddress = process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@example.com';

  const mailOptions = {
    from: fromAddress,
    to,
    subject: 'Your Zurich Bank OTP Code',
    html: `
      <p>Hi ${name || 'there'},</p>
      <p>Your OTP for ${context} is:</p>
      <h2 style="letter-spacing: 4px;">${otp}</h2>
      <p>This code expires in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
    `,
  };

  const info = await transporter.sendMail(mailOptions);

  if (!hasSmtpConfig) {
    console.log('Ethereal preview URL:', nodemailer.getTestMessageUrl(info));
  }

  return info;
}

module.exports = { sendWelcomeEmail, sendOtpEmail };