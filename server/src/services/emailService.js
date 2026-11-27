import { AppError } from '../middlewares/errorHandler.js';

const RESEND_API_URL = 'https://api.resend.com/emails';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildVerificationEmailContent({ fullName, verificationUrl, expiresMinutes = 30 }) {
  const safeName = escapeHtml(fullName || 'Quý khách');
  const safeUrl = escapeHtml(verificationUrl);
  const subject = '[canho.com] Xác nhận địa chỉ Email kích hoạt tài khoản';

  const text = [
    `Xin chào ${fullName || 'Quý khách'},`,
    '',
    'Cảm ơn bạn đã đăng ký tài khoản Khách thuê tại canho.com — Đẳng cấp tạo nên thương hiệu.',
    `Vui lòng truy cập liên kết sau để xác nhận Email (hiệu lực ${expiresMinutes} phút):`,
    verificationUrl,
    '',
    'Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="vi">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;background-color:#F7F4EE;font-family:'Be Vietnam Pro',Arial,sans-serif;color:#24120E;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E6DDD0;border-radius:6px;overflow:hidden;">
    <tr>
      <td style="background:#24120E;padding:24px 28px;border-bottom:2px solid #C69C49;">
        <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:#FFFFFF;">canho.com</div>
        <div style="font-size:12px;color:#C69C49;margin-top:4px;">Đẳng cấp tạo nên thương hiệu</div>
      </td>
    </tr>
    <tr>
      <td style="padding:28px;">
        <h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:20px;color:#24120E;">Xác nhận địa chỉ Email</h1>
        <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#24120E;">
          Xin chào <strong>${safeName}</strong>,
        </p>
        <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#6E5A4F;">
          Vui lòng nhấn nút bên dưới để kích hoạt tài khoản Khách thuê trên <strong>canho.com</strong>. Liên kết có hiệu lực trong vòng <strong>${expiresMinutes} phút</strong>.
        </p>
        <p style="margin:0 0 24px;text-align:center;">
          <a href="${safeUrl}" style="display:inline-block;background:#A6342E;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:9999px;">
            Kích hoạt tài khoản ngay
          </a>
        </p>
        <div style="padding:12px 14px;background:#EFE9DE;border:1px solid #E6DDD0;border-radius:6px;font-size:12px;color:#6E5A4F;word-break:break-all;">
          Nếu nút không bấm được, hãy copy liên kết này dán vào trình duyệt:<br />
          <a href="${safeUrl}" style="color:#A6342E;">${safeUrl}</a>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px;border-top:1px solid #E6DDD0;font-size:11px;color:#6E5A4F;text-align:center;">
        © 2026 canho.com • Nếu bạn không yêu cầu đăng ký, vui lòng bỏ qua email này.
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

/**
 * Send email verification link via Resend REST API when RESEND_API_KEY is configured.
 * Falls back cleanly to console logging when running locally or in automated tests without an API key.
 */
export async function sendVerificationEmail({
  to,
  fullName,
  verificationUrl,
  expiresMinutes = 30,
  forceSend = false,
}) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.RESEND_FROM || 'canho.com <onboarding@resend.dev>').trim();

  if (!apiKey || (process.env.NODE_ENV === 'test' && !forceSend)) {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[Email Verification Fallback] ${to} -> ${verificationUrl}`);
    }
    return { sent: false, provider: 'console', id: null };
  }

  const { subject, text, html } = buildVerificationEmailContent({
    fullName,
    verificationUrl,
    expiresMinutes,
  });

  let response;
  try {
    response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
      }),
    });
  } catch (err) {
    throw new AppError(`Không thể kết nối dịch vụ gửi email Resend: ${err.message}`, 502);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.message || payload?.name || response.statusText || 'Unknown error';
    throw new AppError(`Resend không thể gửi email xác thực: ${detail}`, 502);
  }

  return { sent: true, provider: 'resend', id: payload?.id || null };
}
