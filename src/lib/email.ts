import { Resend } from "resend";
import type { WeeklySummaryRestaurant } from "./weekly-summary";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? "hello@tystable.app";

export type WeeklyDigestData = {
  userName: string;
  email: string;
  headline: string;
  cookNightsCompleted: number;
  cookNightsPlanned: number;
  savedThisWeek: number;
  restaurantsChosen: WeeklySummaryRestaurant[];
  appUrl: string;
};

function buildWeeklyDigestHtml(data: WeeklyDigestData): string {
  const { userName, headline, cookNightsCompleted, cookNightsPlanned, savedThisWeek, restaurantsChosen, appUrl } =
    data;

  const restaurantsHtml =
    restaurantsChosen.length > 0
      ? restaurantsChosen
          .map(
            (r) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #F0E6D8;">
            <p style="margin:0;font-family:Georgia,serif;font-size:15px;color:#2E2A27;font-weight:600;">
              ${r.name}
            </p>
            <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#8A8178;text-transform:uppercase;letter-spacing:0.08em;">
              ${r.dayLabel}
            </p>
          </td>
        </tr>`,
          )
          .join("")
      : `<tr><td style="padding:12px 0;font-family:Arial,sans-serif;font-size:13px;color:#8A8178;">No dine-out nights picked yet this week.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Your Weekly Table — Ty's Table</title>
</head>
<body style="margin:0;padding:0;background-color:#FDF9F7;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FDF9F7;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:#E5A78D;">
                Your Week at a Glance
              </p>
              <h1 style="margin:8px 0 0;font-family:Georgia,serif;font-size:34px;font-weight:normal;font-style:italic;color:#2E2A27;">
                Ty&rsquo;s Table
              </h1>
              <p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:13px;color:#8A8178;">
                Hey ${userName} &mdash; ${headline}
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#E4EFDF;border-radius:20px;padding:28px 32px;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#89B87E;">
                Saved by cooking this week
              </p>
              <p style="margin:8px 0 0;font-family:Georgia,serif;font-size:40px;font-weight:600;color:#2E2A27;line-height:1;">
                $${savedThisWeek}
              </p>
              <table style="margin-top:20px;width:100%;">
                <tr>
                  <td style="text-align:center;background:#FFFFFF;border-radius:12px;padding:14px;">
                    <p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:600;color:#2E2A27;">${cookNightsCompleted}/${cookNightsPlanned}</p>
                    <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#8A8178;">Cook Nights</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr><td height="24"></td></tr>

          <tr>
            <td style="background-color:#fff;border-radius:16px;padding:24px 28px;border:1px solid #F0E6D8;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#E5A78D;">
                Where You Ate Out
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
                ${restaurantsHtml}
              </table>
            </td>
          </tr>

          <tr><td height="32"></td></tr>

          <tr>
            <td align="center">
              <a href="${appUrl}"
                style="display:inline-block;background-color:#2E2A27;color:#FDF9F7;font-family:Arial,sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:16px 40px;border-radius:14px;">
                Plan Next Week
              </a>
            </td>
          </tr>

          <tr><td height="40"></td></tr>

          <tr>
            <td style="text-align:center;padding-top:24px;border-top:1px solid #F0E6D8;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:0.14em;color:#C9C2B9;">
                Ty&rsquo;s Table &mdash; Cook more. Save smart. Dine like you mean it.
              </p>
              <p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:11px;color:#C9C2B9;">
                Sent every Sunday
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
