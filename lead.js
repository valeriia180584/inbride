/**
 * Vercel Serverless Function: приймає заявку з форми й надсилає її в Telegram.
 *
 * Потрібні змінні середовища (Vercel → Project → Settings → Environment Variables):
 *   TELEGRAM_BOT_TOKEN  — токен бота від @BotFather
 *   TELEGRAM_CHAT_ID    — ID чату/групи, куди надходитимуть заявки
 *
 * Поки змінні не задані, функція відповідає помилкою 503, а сайт показує
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

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('[lead] TELEGRAM_BOT_TOKEN або TELEGRAM_CHAT_ID не задані');
    return res.status(503).json({ ok: false, error: 'Lead delivery is not configured' });
  }

  const lines = [
    '<b>Нова заявка з сайту InBride</b>',
    '',
    `<b>Ім'я:</b> ${escapeHtml(data.name)}`,
    `<b>Телефон:</b> ${escapeHtml(data.phone)}`,
    `<b>Дата весілля:</b> ${escapeHtml(formatDate(data.weddingDate))}`,
    `<b>Аксесуар:</b> ${escapeHtml(data.accessory)}`,
  ];
  if (data.dressPhoto) lines.push(`<b>Фото сукні:</b> ${escapeHtml(data.dressPhoto)}`);
  lines.push('', 'Згода на обробку персональних даних: так');

  try {
    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join('\n'),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const result = await tg.json().catch(() => ({}));
    if (!tg.ok || !result.ok) {
      console.error('[lead] Telegram error', tg.status, result.description);
      return res.status(502).json({ ok: false, error: 'Delivery failed' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[lead] Network error', err);
    return res.status(502).json({ ok: false, error: 'Delivery failed' });
  }
};
