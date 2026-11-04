/**
 * Vercel Serverless Function: приймає заявку з форми й пересилає її власниці.
 *
 * Канали доставки (налаштовуються у Vercel → Project → Settings → Environment Variables).
 * Працює будь-який із них або обидва одразу:
 *
 *   Email через Resend (https://resend.com):
 *     RESEND_API_KEY  — ключ API з розділу API Keys у Resend
 *     LEAD_EMAIL_TO   — пошта, куди надходитимуть заявки
 *                       (без власного домену в Resend — лише пошта, з якою реєструвалися)
 *     LEAD_EMAIL_FROM — необов'язково; за замовчуванням "InBride <onboarding@resend.dev>"
 *
 *   Telegram:
 *     TELEGRAM_BOT_TOKEN — токен бота від @BotFather
 *     TELEGRAM_CHAT_ID   — ID чату/групи
 *
 * Поки жоден канал не налаштований, функція відповідає помилкою 503, а сайт показує
 * нареченій повідомлення «Не вдалося надіслати заявку» з підказкою зв'язатися напряму.
 */

const MAX = { name: 60, phone: 20, weddingDate: 10, accessory: 200, dressPhoto: 500 };

function clean(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  // Пастка для ботів: якщо приховане поле заповнене — тихо «приймаємо» й нічого не надсилаємо
  if (body.company) {
    return res.status(200).json({ ok: true });
  }

  const data = {
    name: clean(body.name, MAX.name),
    phone: clean(body.phone, MAX.phone),
    weddingDate: clean(body.weddingDate, MAX.weddingDate),
    accessory: clean(body.accessory, MAX.accessory),
    dressPhoto: clean(body.dressPhoto, MAX.dressPhoto),
  };

  const phoneDigits = data.phone.replace(/\D/g, '');
  const errors = [];
  if (data.name.length < 2) errors.push('name');
  if (phoneDigits.length < 10 || phoneDigits.length > 15) errors.push('phone');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.weddingDate)) errors.push('weddingDate');
  if (!data.accessory) errors.push('accessory');
  if (data.dressPhoto && !/^https?:\/\/\S+$/i.test(data.dressPhoto)) errors.push('dressPhoto');
  if (body.consent !== true) errors.push('consent');

  if (errors.length) {
    return res.status(400).json({ ok: false, error: 'Validation failed', fields: errors });
  }

  const rows = [
    ["Ім'я", data.name],
    ['Телефон', data.phone],
    ['Дата весілля', formatDate(data.weddingDate)],
    ['Аксесуар', data.accessory],
  ];
  if (data.dressPhoto) rows.push(['Фото сукні', data.dressPhoto]);

  const channels = [];

  // ---- Email через Resend ----
  const resendKey = process.env.RESEND_API_KEY;
  const emailTo = process.env.LEAD_EMAIL_TO;
  if (resendKey && emailTo) {
    const html =
      '<h2 style="font-family:Georgia,serif;font-weight:400">Нова заявка з сайту InBride</h2>' +
      '<table cellpadding="6" style="font-family:Arial,sans-serif;font-size:15px;border-collapse:collapse">' +
      rows.map(([k, v]) => `<tr><td style="color:#6F6458">${escapeHtml(k)}</td><td><b>${escapeHtml(v)}</b></td></tr>`).join('') +
      '</table>' +
      '<p style="font-family:Arial,sans-serif;font-size:13px;color:#6F6458">Згода на обробку персональних даних: так</p>';
    channels.push(
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.LEAD_EMAIL_FROM || 'InBride <onboarding@resend.dev>',
          to: emailTo.split(',').map((e) => e.trim()).filter(Boolean),
          subject: `Заявка InBride: ${data.name}, ${data.accessory}`.slice(0, 150),
          html,
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error('Resend ' + r.status + ' ' + (await r.text().catch(() => '')));
        return 'email';
      })
    );
  }

  // ---- Telegram ----
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (token && chatId) {
    const text = ['<b>Нова заявка з сайту InBride</b>', '']
      .concat(rows.map(([k, v]) => `<b>${escapeHtml(k)}:</b> ${escapeHtml(v)}`))
      .concat(['', 'Згода на обробку персональних даних: так'])
      .join('\n');
    channels.push(
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      }).then(async (r) => {
        const result = await r.json().catch(() => ({}));
        if (!r.ok || !result.ok) throw new Error('Telegram ' + r.status + ' ' + (result.description || ''));
        return 'telegram';
      })
    );
  }

  if (!channels.length) {
    console.error('[lead] Не налаштовано жодного каналу: потрібні RESEND_API_KEY + LEAD_EMAIL_TO або TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID');
    return res.status(503).json({ ok: false, error: 'Lead delivery is not configured' });
  }

  const results = await Promise.allSettled(channels);
  results.filter((r) => r.status === 'rejected').forEach((r) => console.error('[lead]', r.reason && r.reason.message));
  const delivered = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);

  if (!delivered.length) {
    return res.status(502).json({ ok: false, error: 'Delivery failed' });
  }
  return res.status(200).json({ ok: true, delivered });
};
