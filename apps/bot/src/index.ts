import { TelegramBotEngine } from './services/telegram-engine';
import { BotCommandHandler } from './handlers/command-handlers';

export async function createTelegramBot(token?: string): Promise<{ bot: TelegramBotEngine; handler: BotCommandHandler }> {
  const bot = new TelegramBotEngine(token);
  const handler = new BotCommandHandler();

  bot.registerCommand('/start', (msg) => handler.handleStart(msg));
  bot.registerCommand('/rates', (msg) => handler.handleRates(msg));
  bot.registerCommand('/quote', (msg, text) => handler.handleQuote(msg, text));
  bot.registerCommand('/swap', (msg, text) => handler.handleSwap(msg, text));
  bot.registerCommand('/track', (msg, text) => handler.handleTrack(msg, text));
  bot.registerCommand('/help', (msg) => handler.handleHelp(msg));

  // Default handler
  bot.setDefaultHandler(async (msg, text) => {
    if (text.startsWith('/')) {
      return {
        chatId: msg.chat.id,
        text: `Unknown command \`${text}\`. Type \`/help\` for available commands.`,
        parseMode: 'Markdown'
      };
    }
    return handler.handleStart(msg);
  });

  return { bot, handler };
}

// Auto-start when executed directly
if (require.main === module) {
  createTelegramBot().then(({ bot }) => {
    console.log('[CoinSwagBot] Initializing Monero-routed swap bot...');
    bot.startPolling();
  });
}
