import 'server-only';
import { Resend } from 'resend';
import { env } from './env';
import { getSettings } from './settings';

let resend = null;

/** Sends an email via Resend, or prints it to the server log when RESEND_API_KEY is missing (dev). */
export async function sendEmail({ to, subject, html, text, replyTo }) {
  if (!to) return { skipped: true };
  if (!env.hasResend) {
    console.log(`\n[email:dev] To: ${to}\n[email:dev] Subject: ${subject}\n[email:dev] ${text || stripHtml(html).slice(0, 600)}\n`);
    return { dev: true };
  }
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  const settings = await getSettings();
  const from = process.env.EMAIL_FROM || `${settings.store.name} <onboarding@resend.dev>`;
  const { data, error } = await resend.emails.send({
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text: text || stripHtml(html),
    replyTo: replyTo || settings.store.supportEmail || undefined,
  });
  if (error) throw new Error(`Resend: ${error.message || JSON.stringify(error)}`);
  return data;
}

function stripHtml(html = '') {
  return html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Simple branded HTML layout shared by every transactional email. */
export async function layout({ title, preheader = '', body, cta }) {
  const s = await getSettings();
  const color = s.store.brandColor || '#d6852a';
  const button = cta
    ? `<p style="margin:28px 0"><a href="${cta.href}" style="background:${color};color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">${escapeHtml(cta.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#fdf8ef;font-family:Arial,Helvetica,sans-serif;color:#1f1a17">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</span>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:${color};padding:18px 28px;color:#fff;font-size:20px;font-weight:bold;letter-spacing:.5px">${escapeHtml(s.store.name)}</td></tr>
<tr><td style="padding:28px">
<h1 style="font-size:22px;margin:0 0 16px">${escapeHtml(title)}</h1>
${body}
${button}
</td></tr>
<tr><td style="padding:18px 28px;background:#fdf3e3;font-size:12px;color:#7a706a">
Questions? Reply to this email${s.store.supportPhone ? ` or call ${escapeHtml(s.store.supportPhone)}` : ''}.<br>${escapeHtml(s.store.name)} · <a href="${env.siteUrl}" style="color:#7a706a">${env.siteUrl.replace(/^https?:\/\//, '')}</a>
</td></tr></table></td></tr></table></body></html>`;
}
