export interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    first_name?: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  text?: string;
  date: number;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: { id: number; username?: string };
    data?: string;
    message?: TelegramMessage;
  };
}

export interface OutgoingReply {
  chatId: number;
  text: string;
  parseMode?: 'Markdown' | 'HTML';
  replyMarkup?: any;
}

export type MessageHandler = (msg: TelegramMessage, text: string) => Promise<OutgoingReply | null>;
export type CallbackHandler = (queryId: string, data: string, chatId: number) => Promise<OutgoingReply | null>;

export class TelegramBotEngine {
  private botToken?: string;
  private isRunning: boolean = false;
  private messageHandlers: Map<string, MessageHandler> = new Map();
  private callbackHandlers: Map<string, CallbackHandler> = new Map();
  private defaultHandler?: MessageHandler;
  private lastUpdateId: number = 0;

  // Sent message audit log (in-memory only for ephemeral testing)
  private sentMessages: OutgoingReply[] = [];

  constructor(token?: string) {
    this.botToken = token || process.env.TELEGRAM_BOT_TOKEN;
  }

  public registerCommand(command: string, handler: MessageHandler): void {
    const cmd = command.startsWith('/') ? command.toLowerCase() : `/${command.toLowerCase()}`;
    this.messageHandlers.set(cmd, handler);
  }

  public registerCallback(actionPrefix: string, handler: CallbackHandler): void {
    this.callbackHandlers.set(actionPrefix, handler);
  }

  public setDefaultHandler(handler: MessageHandler): void {
    this.defaultHandler = handler;
  }

  /**
   * Processes a message (called either by real Telegram long-poll or by tests).
   */
  public async processIncomingMessage(msg: TelegramMessage): Promise<OutgoingReply | null> {
    if (!msg.text) return null;

    const tokens = msg.text.trim().split(/\s+/);
    const cmd = tokens[0].toLowerCase().split('@')[0]; // strip bot username if present

    const handler = this.messageHandlers.get(cmd) || this.defaultHandler;
    if (handler) {
      const reply = await handler(msg, msg.text.trim());
      if (reply) {
        this.recordSentMessage(reply);
        if (this.botToken && !this.botToken.startsWith('mock_')) {
          await this.sendTelegramApiMessage(reply);
        }
        return reply;
      }
    }

    return null;
  }

  /**
   * Processes an inline keyboard callback query.
   */
  public async processCallbackQuery(update: TelegramUpdate): Promise<OutgoingReply | null> {
    const cb = update.callback_query;
    if (!cb || !cb.data || !cb.message) return null;

    for (const [prefix, handler] of this.callbackHandlers.entries()) {
      if (cb.data.startsWith(prefix)) {
        const reply = await handler(cb.id, cb.data, cb.message.chat.id);
        if (reply) {
          this.recordSentMessage(reply);
          if (this.botToken && !this.botToken.startsWith('mock_')) {
            await this.sendTelegramApiMessage(reply);
          }
          return reply;
        }
      }
    }
    return null;
  }

  private recordSentMessage(reply: OutgoingReply): void {
    this.sentMessages.push(reply);
    if (this.sentMessages.length > 50) this.sentMessages.shift();
  }

  public getSentMessages(): OutgoingReply[] {
    return this.sentMessages;
  }

  /**
   * Sends actual HTTP message to official Telegram Bot API endpoint.
   */
  private async sendTelegramApiMessage(reply: OutgoingReply): Promise<void> {
    try {
      await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: reply.chatId,
          text: reply.text,
          parse_mode: reply.parseMode || 'Markdown',
          reply_markup: reply.replyMarkup
        })
      });
    } catch (err: any) {
      console.warn('[TelegramBotEngine] Failed to dispatch API message:', err.message);
    }
  }

  /**
   * Launches long-polling loop if live token is supplied.
   */
  public async startPolling(): Promise<void> {
    if (!this.botToken || this.botToken.startsWith('mock_')) {
      console.log('[TelegramBotEngine] No live TELEGRAM_BOT_TOKEN provided. Running in simulation mode.');
      return;
    }

    this.isRunning = true;
    console.log('[TelegramBotEngine] Bot started polling Telegram API...');

    while (this.isRunning) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=30`);
        const data: any = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result as TelegramUpdate[]) {
            this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
            if (update.message) {
              await this.processIncomingMessage(update.message);
            } else if (update.callback_query) {
              await this.processCallbackQuery(update);
            }
          }
        }
      } catch (err: any) {
        // Sleep on error before retrying poll
        await new Promise(r => setTimeout(r, 4000));
      }
    }
  }

  public stop(): void {
    this.isRunning = false;
  }
}
