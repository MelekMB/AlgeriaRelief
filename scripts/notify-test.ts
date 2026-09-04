/**
 * Send one test notification and say exactly what happened.
 *
 *   npm run notify:test
 *
 * Isolates the Telegram wiring from the rest of the app, so a silent report
 * can be traced to the right thing: missing secrets, a bad token, a wrong
 * chat id, or simply never having messaged the bot.
 */
import { notifyConfigured } from '../src/lib/notify.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

console.log('\nSecrets');
console.log(`  TELEGRAM_BOT_TOKEN : ${token ? `set (${token.slice(0, 10)}…)` : 'MISSING'}`);
console.log(`  TELEGRAM_CHAT_ID   : ${chatId ? chatId : 'MISSING'}`);

if (!notifyConfigured()) {
  console.error('\nBoth secrets are required. Add them in Replit -> Tools -> Secrets,');
  console.error('then restart the app so it picks them up.\n');
  process.exit(1);
}

const text =
  '✅ Test from the Algeria relief app.\n' +
  'If you can read this, problem reports will reach you here.';

console.log('\nSending…');

const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: chatId, text }),
});

const payload = (await response.json()) as {
  ok: boolean;
  description?: string;
  error_code?: number;
};

if (payload.ok) {
  console.log('\nSENT. Check Telegram - the message should already be there.\n');
  process.exit(0);
}

console.error(`\nFAILED: ${payload.error_code} ${payload.description ?? ''}`);

// Telegram's errors are terse; translate the three that actually happen.
switch (payload.error_code) {
  case 401:
    console.error('\nThe bot token is wrong or has been revoked.');
    console.error('Get a fresh one from @BotFather with /token, and note that');
    console.error('revoking a token invalidates the previous one immediately.');
    break;
  case 400:
    console.error('\nUsually the chat id is wrong.');
    console.error('Message @userinfobot on Telegram - it replies with your id.');
    console.error('It is digits only, sometimes with a leading minus for a group.');
    break;
  case 403:
    console.error('\nThe bot is not allowed to message you.');
    console.error('Open t.me/AlgreliefBot and send it any message first: a bot');
    console.error('can never start the conversation.');
    break;
  default:
    console.error('\nSee https://core.telegram.org/bots/api for this error code.');
}

console.error('');
process.exit(1);
