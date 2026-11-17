const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;
if (env.smtpEnabled) {
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
}

/** Send an email; in demo mode (no SMTP configured) the email is logged instead. Never throws. */
async function sendEmail({ to, subject, text, html }) {
  if (!to) return { sent: false };
  if (!transporter) {
    if (!env.isTest) console.log(`[email:demo] to=${to} subject="${subject}"\n${text || ''}`);
    return { sent: false, demo: true };
  }
  try {
    await transporter.sendMail({ from: env.smtp.from, to, subject, text, html });
    return { sent: true };
  } catch (err) {
    console.error('[email] failed:', err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendEmail };
