import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? "hello@tystable.app";

export type WeeklyDigestData = {
  userName: string;
  email: string;
  fundName: string;
  balance: number;
  targetAmount: number;
  depositCount: number; // cook nights this week
  savedThisWeek: number;
  weeklySummaryText: string;
  dallasFeedItems: { title: string; date?: string; description?: string }[];
  appUrl: string;
};

function progressBar(balance: number, target: number): string {
  const pct = Math.min(Math.round((balance / target) * 100), 100);
  const filled = Math.round(pct / 5); // 20 segments
  const empty = 20 - filled;
  return "█".repeat(filled) + "░".repeat(empty) + ` ${pct}%`;
}

function buildWeeklyDigestHtml(data: WeeklyDigestData): string {
  const {
    userName,
    fundName,
    balance,
    targetAmount,
    depositCount,
    savedThisWeek,
    weeklySummaryText,
    dallasFeedItems,
    appUrl,
  } = data;

  const remaining = Math.max(0, targetAmount - balance);
  const feedHtml =
    dallasFeedItems.length > 0
      ? dallasFeedItems
          .slice(0, 4)
          .map(
            (item) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #E8DFC8;">
            <p style="margin:0;font-family:'Georgia',serif;font-size:15px;color:#0F1310;font-weight:600;">
              ${item.title}
            </p>
            ${item.date ? `<p style="margin:4px 0 0;font-family:monospace;font-size:11px;color:#0F1310;opacity:0.5;text-transform:uppercase;letter-spacing:0.1em;">${item.date}</p>` : ""}
            ${item.description ? `<p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#0F1310;opacity:0.7;line-height:1.5;">${item.description}</p>` : ""}
          </td>
        </tr>`,
          )
          .join("")
      : `<tr><td style="padding:12px 0;font-family:Arial,sans-serif;font-size:13px;color:#0F1310;opacity:0.6;">No events this week — check back Sunday.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Your Weekly Table — Ty's Table</title>
</head>
<body style="margin:0;padding:0;background-color:#F2EAD8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F2EAD8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <p style="margin:0;font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.22em;color:#C28840;">
                Your Weekly Table
              </p>
              <h1 style="margin:8px 0 0;font-family:'Georgia',serif;font-size:36px;font-weight:normal;font-style:italic;color:#0F1310;">
                Ty&rsquo;s Table
              </h1>
              <p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#0F1310;opacity:0.6;">
                Hey ${userName} &mdash; here&rsquo;s your week at a glance.
              </p>
            </td>
          </tr>

          <!-- Savings Card -->
          <tr>
            <td style="background-color:#0F1310;border-radius:16px;padding:28px 32px;margin-bottom:24px;">
              <p style="margin:0;font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.2em;color:#C28840;">
                ${fundName}
              </p>
              <p style="margin:12px 0 0;font-family:'Georgia',serif;font-size:42px;font-weight:500;color:#F2EAD8;line-height:1;">
                $${balance}
              </p>
              <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#F2EAD8;opacity:0.5;">
                of $${targetAmount} goal &mdash; $${remaining} to go
              </p>
              <p style="margin:16px 0 0;font-family:monospace;font-size:12px;color:#C28840;letter-spacing:0.05em;">
                ${progressBar(balance, targetAmount)}
              </p>
              <table style="margin-top:20px;width:100%;">
                <tr>
                  <td style="text-align:center;background:#1a2018;border-radius:8px;padding:12px;">
                    <p style="margin:0;font-family:'Georgia',serif;font-size:24px;font-weight:500;color:#F2EAD8;">${depositCount}</p>
                    <p style="margin:4px 0 0;font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.14em;color:#C28840;">Cook Nights</p>
                  </td>
                  <td width="12"></td>
                  <td style="text-align:center;background:#1a2018;border-radius:8px;padding:12px;">
                    <p style="margin:0;font-family:'Georgia',serif;font-size:24px;font-weight:500;color:#F2EAD8;">$${savedThisWeek}</p>
                    <p style="margin:4px 0 0;font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.14em;color:#C28840;">Saved This Week</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr><td height="24"></td></tr>

          <!-- Weekly Brief -->
          ${
            weeklySummaryText
              ? `<tr>
            <td style="background-color:#fff;border-radius:12px;padding:24px 28px;border:1px solid #E8DFC8;">
              <p style="margin:0;font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.2em;color:#C28840;">
                Your Strategist Says
              </p>
              <p style="margin:12px 0 0;font-family:'Georgia',serif;font-size:15px;color:#0F1310;line-height:1.7;font-style:italic;">
                &ldquo;${weeklySummaryText}&rdquo;
              </p>
            </td>
          </tr>
          <tr><td height="24"></td></tr>`
              : ""
          }

          <!-- Dallas Feed -->
          <tr>
            <td style="background-color:#fff;border-radius:12px;padding:24px 28px;border:1px solid #E8DFC8;">
              <p style="margin:0;font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.2em;color:#C28840;">
                This Week in Dallas
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
                ${feedHtml}
              </table>
            </td>
          </tr>

          <tr><td height="32"></td></tr>

          <!-- CTA -->
          <tr>
            <td align="center">
              <a href="${appUrl}"
                style="display:inline-block;background-color:#0F1310;color:#F2EAD8;font-family:Arial,sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:16px 40px;border-radius:12px;">
                Open Ty&rsquo;s Table
              </a>
            </td>
          </tr>

          <tr><td height="40"></td></tr>

          <!-- Footer -->
          <tr>
            <td style="text-align:center;padding-top:24px;border-top:1px solid #D9CDB0;">
              <p style="margin:0;font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.16em;color:#0F1310;opacity:0.4;">
                Ty&rsquo;s Table &mdash; Cook more. Save smart. Dine like you mean it.
              </p>
              <p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#0F1310;opacity:0.35;">
                Dallas, TX &mdash; Sent every Sunday
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendWeeklyDigest(data: WeeklyDigestData) {
  const html = buildWeeklyDigestHtml(data);

  const { data: result, error } = await resend.emails.send({
    from: FROM,
    to: data.email,
    subject: `Your week at Ty's Table — $${data.savedThisWeek} saved 🍽️`,
    html,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
  return result;
}
