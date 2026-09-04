/**
 * Push a message to whoever is running this.
 *
 * Everything the app records - problem reports, auto-quarantined listings -
 * otherwise sits in a database waiting for someone to remember to look. With
 * one part-time operator that means it is never read.
 *
 * Telegram is used because it is the only channel in this project with no
 * wall in front of it: a bot takes two minutes to create, costs nothing, has
 * no volume limit worth worrying about, and needs no business account,
 * verification or approval. SMS costs money, WhatsApp needs Meta approval,
 * email needs another provider signup.
 *
 * Entirely optional. With nothing configured the app behaves exactly as
 * before and everything is still readable in /admin.
 */

const MAX_LENGTH = 3500;

export function notifyConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

/**
 * Fire-and-forget. A failure here must never break the thing that triggered
 * it: someone reporting a problem should not be shown an error because our
 * notification channel is down.
 */
export async function notifyOperator(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, MAX_LENGTH),
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      console.error('[notify] telegram rejected the message:', await response.text());
    }
  } catch (err) {
    console.error('[notify] could not reach telegram', err);
  }
}
