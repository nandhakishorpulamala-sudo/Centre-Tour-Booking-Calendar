// notifications.js
// SMTP (nodemailer) and WhatsApp Business (Meta Cloud API) or Twilio support.
const nodemailer = require('nodemailer');
const axios = require('axios');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@example.com';

const WHATSAPP_PROVIDER = process.env.WHATSAPP_PROVIDER || 'meta'; // 'meta' or 'twilio'

// Meta WhatsApp Cloud API
const WA_META_PHONE_NUMBER_ID = process.env.WA_META_PHONE_NUMBER_ID; // e.g. '10987654321'
const WA_META_TOKEN = process.env.WA_META_TOKEN;

// Twilio
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM; // e.g. 'whatsapp:+1415...'

let transporter = null;
if (SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT || 587,
    secure: SMTP_SECURE || false,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
  });
}

async function sendEmail(email, subject, body) {
  if (!email) throw new Error('no email');
  if (!transporter) throw new Error('SMTP not configured');
  const info = await transporter.sendMail({ from: EMAIL_FROM, to: email, subject, text: body });
  return { ok: true, info };
}

async function sendWhatsAppMeta(phone, message) {
  if (!WA_META_PHONE_NUMBER_ID || !WA_META_TOKEN) throw new Error('Meta WhatsApp not configured');
  // phone should be in international format without plus for Meta API
  const payload = {
    messaging_product: 'whatsapp',
    to: phone.replace(/^\+/, ''),
    type: 'text',
    text: { body: message }
  };
  const url = `https://graph.facebook.com/v15.0/${WA_META_PHONE_NUMBER_ID}/messages`;
  const res = await axios.post(url, payload, { headers: { Authorization: `Bearer ${WA_META_TOKEN}` } });
  return { ok: true, data: res.data };
}

async function sendWhatsAppTwilio(phone, message) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) throw new Error('Twilio WhatsApp not configured');
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const params = new URLSearchParams();
  params.append('From', TWILIO_WHATSAPP_FROM);
  params.append('To', `whatsapp:${phone}`);
  params.append('Body', message);
  const res = await axios.post(url, params.toString(), {
    auth: { username: TWILIO_ACCOUNT_SID, password: TWILIO_AUTH_TOKEN },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  return { ok: true, data: res.data };
}

async function sendWhatsApp(phone, message) {
  if (!phone) throw new Error('no phone');
  if (WHATSAPP_PROVIDER === 'twilio') return sendWhatsAppTwilio(phone, message);
  return sendWhatsAppMeta(phone, message);
}

async function notifyForAction(action, booking) {
  try {
    const name = booking.name || 'Parent';
    if (action === 'confirm') {
      const subject = 'Your centre tour is confirmed';
      const body = `Hi ${name}, your tour has been confirmed. We look forward to seeing you.`;
      if (booking.email) await sendEmail(booking.email, subject, body).catch(e => console.error('email send failed', e));
      if (booking.phone) await sendWhatsApp(booking.phone, body).catch(e => console.error('whatsapp send failed', e));
      return { sent: true };
    }

    if (action === 'schedule') {
      const subject = 'Your centre tour has been scheduled';
      const body = `Hi ${name}, your tour has been scheduled for ${booking.preferred_datetime || 'the selected time'}.`;
      if (booking.email) await sendEmail(booking.email, subject, body).catch(e => console.error('email send failed', e));
      if (booking.phone) await sendWhatsApp(booking.phone, body).catch(e => console.error('whatsapp send failed', e));
      return { sent: true };
    }

    if (action === 'reminder-sent') {
      const subject = 'Reminder: Upcoming centre tour';
      const body = `Hi ${name}, this is a reminder for your upcoming tour at ${booking.preferred_datetime || 'the scheduled time'}.`;
      if (booking.email) await sendEmail(booking.email, subject, body).catch(e => console.error('email send failed', e));
      if (booking.phone) await sendWhatsApp(booking.phone, body).catch(e => console.error('whatsapp send failed', e));
      return { sent: true };
    }

    // default: no-op
    return { sent: false };
  } catch (err) {
    console.error('notification error', err);
    return { sent: false, error: String(err) };
  }
}

module.exports = { sendEmail, sendWhatsApp, notifyForAction };
