/**
 * SMS delivery.
 *
 * ⚠️  A2P deliverability to Algerian carriers (+213) is the single largest
 *     unvalidated risk in this project. Test every provider against a real
 *     Algerian number BEFORE building anything else on top of this.
 *
 * If SMS is unavailable the app must still work: callers treat a failed send
 * as "unverified tier" rather than a hard error. Unverified users can post,
 * but their posts rank below verified ones and they cannot claim a request
 * or see anyone's address.
 */

export type SmsResult =
  | { ok: true; provider: string }
  | { ok: false; provider: string; error: string };

const provider = (process.env.SMS_PROVIDER ?? 'none').toLowerCase();

export function smsConfigured(): boolean {
  return provider !== 'none';
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  switch (provider) {
    case 'twilio':
      return sendViaTwilio(to, body);
    case 'none':
    default:
      // Dev/no-provider mode. The code is printed so the flow can be tested
      // end to end without spending money or waiting on carrier delivery.
      console.log(`[sms:none] → ${to}: ${body}`);
      return { ok: true, provider: 'none' };
  }
}

async function sendViaTwilio(to: string, body: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;

  if (!sid || !token || !from) {
    return { ok: false, provider: 'twilio', error: 'Twilio credentials are not configured' };
  }

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, provider: 'twilio', error: `${res.status}: ${detail.slice(0, 300)}` };
    }
    return { ok: true, provider: 'twilio' };
  } catch (err) {
    return {
      ok: false,
      provider: 'twilio',
      error: err instanceof Error ? err.message : 'Unknown network error',
    };
  }
}

/** True when the dev console is the only place the code appears. */
export function isDevEchoMode(): boolean {
  return provider === 'none' && process.env.NODE_ENV !== 'production';
}
