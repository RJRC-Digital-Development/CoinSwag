import { 
  FeeCalculatorService, 
  PriceFeedService, 
  ASSET_MAP, 
  AddressValidator 
} from '@coinswag/core';
import { BlockchainAdapterRegistry } from '@coinswag/blockchain';
import { TelegramMessage, OutgoingReply } from '../services/telegram-engine';

function resolveAsset(input: string) {
  if (!input) return undefined;
  const norm = input.toUpperCase().replace(/[-_]/g, '');
  if (norm === 'BTCLN' || norm === 'LIGHTNING' || norm === 'LN') {
    return ASSET_MAP['BTC_LN'];
  }
  return ASSET_MAP[input.toUpperCase()] || ASSET_MAP[norm];
}

export class BotCommandHandler {
  private priceFeed: PriceFeedService;
  private feeCalculator: FeeCalculatorService;
  private registry: BlockchainAdapterRegistry;
  
  // Ephemeral order cache for tracking via bot
  private orders: Map<string, any> = new Map();

  constructor(
    priceFeed?: PriceFeedService,
    feeCalculator?: FeeCalculatorService,
    registry?: BlockchainAdapterRegistry
  ) {
    this.priceFeed = priceFeed || new PriceFeedService();
    this.feeCalculator = feeCalculator || new FeeCalculatorService(this.priceFeed);
    this.registry = registry || new BlockchainAdapterRegistry();
  }

  /**
   * /start command
   */
  public async handleStart(msg: TelegramMessage): Promise<OutgoingReply> {
    const text = 
`⚡ *Welcome to CoinSwag Bot*
*Monero-Routed Multi-Chain Swaps*

🔒 *Eligible routes use Monero (XMR) as a conversion leg* (\`Coin A ➔ XMR ➔ Coin B\`). Use the service only in accordance with applicable law and the platform terms.

⚡ *Bitcoin Lightning Network:* Instant 0-conf settlement with sub-cent routing fees!

💰 *Ultra-Competitive Fees:*
• Single-Hop (\`XMR ➔ Coin\` / \`Coin ➔ XMR\`): *0.45%*
• Double-Hop Privacy Route (\`Coin A ➔ XMR ➔ Coin B\`): *0.75% all-in*

🚀 *Quick Commands:*
• \`/swap <from> <to> <amount> <payout_address>\` — Instant swap
• \`/quote <from> <to> <amount>\` — Calculate rates & fees
• \`/rates\` — View supported tokens & prices
• \`/track <order_id>\` — Monitor swap progress
• \`/help\` — Routing and compliance information`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '⚡ Lightning ➔ XMR', callback_data: 'quick_swap_ln_xmr' },
          { text: '⚡ BTC ➔ SOL', callback_data: 'quick_swap_btc_sol' }
        ],
        [
          { text: '🔒 Swap XMR ➔ BTC', callback_data: 'quick_swap_xmr_btc' },
          { text: '📊 Live Rates', callback_data: 'rates' }
        ],
        [
          { text: '🛡️ Privacy Hub Explainer', callback_data: 'privacy_info' }
        ]
      ]
    };

    return {
      chatId: msg.chat.id,
      text,
      parseMode: 'Markdown',
      replyMarkup
    };
  }

  /**
   * /rates command
   */
  public async handleRates(msg: TelegramMessage): Promise<OutgoingReply> {
    const assets = ['BTC', 'BTC_LN', 'ETH', 'SOL', 'XMR', 'USDT-ERC20', 'USDC-ERC20', 'BNB', 'LTC', 'DOGE', 'AVAX'];
    let text = `📊 *CoinSwag Live Asset Rates & Privacy Hub*\n\n`;

    for (const id of assets) {
      const asset = ASSET_MAP[id];
      if (asset) {
        const price = this.priceFeed.getPriceUsd(id);
        const icon = id === 'XMR' ? '🔒' : (id === 'BTC_LN' ? '⚡' : '•');
        text += `${icon} *${asset.symbol}* (${asset.name}): \`$${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}\`\n`;
      }
    }

    text += `\n💡 *Platform Fees:* 0.45% direct, 0.75% Monero Privacy Hub.\n`;
    text += `⚡ *Lightning Network:* 0-conf instant settlement, ~10 sats network fee.\n`;
    text += `Use \`/quote <from> <to> <amount>\` to calculate exact receive amounts.`;

    return {
      chatId: msg.chat.id,
      text,
      parseMode: 'Markdown'
    };
  }

  /**
   * /quote <from> <to> <amount>
   */
  public async handleQuote(msg: TelegramMessage, rawText: string): Promise<OutgoingReply> {
    const parts = rawText.trim().split(/\s+/);
    if (parts.length < 4) {
      return {
        chatId: msg.chat.id,
        text: `⚠️ *Usage:* \`/quote <from> <to> <amount>\`\n*Example:* \`/quote BTC SOL 0.1\` or \`/quote BTC_LN XMR 0.005\``,
        parseMode: 'Markdown'
      };
    }

    const fromSymbol = parts[1].toUpperCase();
    const toSymbol = parts[2].toUpperCase();
    const amount = parseFloat(parts[3]);

    if (isNaN(amount) || amount <= 0) {
      return {
        chatId: msg.chat.id,
        text: `❌ *Invalid amount:* ${parts[3]}`,
        parseMode: 'Markdown'
      };
    }

    const fromAsset = resolveAsset(fromSymbol);
    const toAsset = resolveAsset(toSymbol);

    if (!fromAsset || !toAsset) {
      return {
        chatId: msg.chat.id,
        text: `❌ *Unsupported token pair:* ${fromSymbol} / ${toSymbol}. Use \`/rates\` to view supported tokens.`,
        parseMode: 'Markdown'
      };
    }

    const quote = this.feeCalculator.generateQuote(fromAsset, toAsset, amount, 'FLOAT');
    const isDoubleHop = fromAsset.id !== 'XMR' && toAsset.id !== 'XMR';

    const text = 
`⚡ *Instant Swap Quote*
• *You Send:* \`${quote.amountIn} ${fromAsset.symbol}\`${fromAsset.chain === 'lightning' ? ` (${Math.round(quote.amountIn * 1e8).toLocaleString()} sats)` : ''}
• *You Receive (Est):* \`${quote.estimatedAmountOut} ${toAsset.symbol}\`${toAsset.chain === 'lightning' ? ` (${Math.round(quote.estimatedAmountOut * 1e8).toLocaleString()} sats)` : ''}
• *Exchange Rate:* \`1 ${fromAsset.symbol} ≈ ${quote.rate} ${toAsset.symbol}\`

🛡️ *Route:* ${isDoubleHop ? `\`${fromAsset.symbol} ➔ Monero Hub (RingCT) ➔ ${toAsset.symbol}\`` : `Direct Single-Hop`}
💰 *Platform Fee:* \`${(quote.feeBreakdown.serviceFeePercent * 100).toFixed(2)}%\` ($${quote.feeBreakdown.totalFeeUsd.toFixed(2)})
⛽ *Network Fee:* \`${quote.feeBreakdown.networkMinerFeeToAsset} ${toAsset.symbol}\`${toAsset.chain === 'lightning' ? ' (Instant 0-conf)' : ''}

To start this swap, run:
\`/swap ${fromAsset.id} ${toAsset.id} ${amount} <your_${toAsset.symbol}_address>\``;


    return {
      chatId: msg.chat.id,
      text,
      parseMode: 'Markdown'
    };
  }

  /**
   * /swap <from> <to> <amount> <payoutAddress> [refundAddress]
   */
  public async handleSwap(msg: TelegramMessage, rawText: string): Promise<OutgoingReply> {
    const parts = rawText.trim().split(/\s+/);
    if (parts.length < 5) {
      return {
        chatId: msg.chat.id,
        text: `⚠️ *Usage:* \`/swap <from> <to> <amount> <destination_address> [refund_address]\`\n\n*Example:* \`/swap BTC SOL 0.05 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU\`\n*Lightning:* \`/swap BTC_LN XMR 0.005 888tNkZrPN6JsEgekjMnABU4TBzc...\``,
        parseMode: 'Markdown'
      };
    }

    const fromSymbol = parts[1].toUpperCase();
    const toSymbol = parts[2].toUpperCase();
    const amount = parseFloat(parts[3]);
    const destinationAddress = parts[4];
    const refundAddress = parts[5] || 'AUTO_EMERGENCY_BUFFER';

    const fromAsset = resolveAsset(fromSymbol);
    const toAsset = resolveAsset(toSymbol);

    if (!fromAsset || !toAsset) {
      return {
        chatId: msg.chat.id,
        text: `❌ *Unsupported token pair:* ${fromSymbol} / ${toSymbol}`,
        parseMode: 'Markdown'
      };
    }

    if (!AddressValidator.isValid(toAsset.chain, destinationAddress)) {
      return {
        chatId: msg.chat.id,
        text: `❌ *Invalid ${toAsset.name} payout address:* \`${destinationAddress}\``,
        parseMode: 'Markdown'
      };
    }

    const quote = this.feeCalculator.generateQuote(fromAsset, toAsset, amount, 'FLOAT');
    const adapter = this.registry.getAdapter(fromAsset.chain);
    const orderId = `tg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const deposit = await adapter.generateDepositAddress(orderId);

    const orderData = {
      orderId,
      fromSymbol: fromAsset.symbol,
      toSymbol: toAsset.symbol,
      amountIn: quote.amountIn,
      estimatedOut: quote.estimatedAmountOut,
      depositAddress: deposit.address,
      destinationAddress,
      status: 'AWAITING_DEPOSIT',
      createdAt: Date.now()
    };

    this.orders.set(orderId, orderData);

    const isLightningIn = fromAsset.chain === 'lightning';
    const text = 
`🎉 *Swap Session Created!*

Order ID: \`${orderId}\`
• *Send Exactly:* \`${quote.amountIn} ${fromAsset.symbol}\`${isLightningIn ? ` (${Math.round(quote.amountIn * 1e8).toLocaleString()} sats)` : ''}
• *To Single-Use ${isLightningIn ? 'Lightning Invoice (0-Conf Instant)' : 'Deposit Address'}:*
\`${deposit.address}\`
${isLightningIn ? `\n📱 [Open in Lightning Wallet](lightning:${deposit.address})\n` : ''}
📥 *Destination Payout:*
\`${destinationAddress}\` (\`${quote.estimatedAmountOut} ${toAsset.symbol}\`)

🔒 *Monero Privacy Hub Active:* Unlinkable RingCT routing.
⏱️ Track progress anytime with: \`/track ${orderId}\``;

    return {
      chatId: msg.chat.id,
      text,
      parseMode: 'Markdown'
    };
  }

  /**
   * /track <orderId>
   */
  public async handleTrack(msg: TelegramMessage, rawText: string): Promise<OutgoingReply> {
    const parts = rawText.trim().split(/\s+/);
    if (parts.length < 2) {
      return {
        chatId: msg.chat.id,
        text: `⚠️ *Usage:* \`/track <order_id>\`\n*Example:* \`/track tg_1788758000_abc\``,
        parseMode: 'Markdown'
      };
    }

    const orderId = parts[1].trim();
    const order = this.orders.get(orderId);

    if (!order) {
      return {
        chatId: msg.chat.id,
        text: `🔍 Order \`${orderId}\` not found or already purged under Zero-KYC Janitor policy.`,
        parseMode: 'Markdown'
      };
    }

    const text = 
`🔍 *Order Tracker: ${order.orderId}*

• *Pair:* \`${order.amountIn} ${order.fromSymbol} ➔ ${order.estimatedOut} ${order.toSymbol}\`
• *Deposit Address:* \`${order.depositAddress}\`
• *Status:* ⏳ \`${order.status.replace(/_/g, ' ')}\`

[▓▓▓▓▓▓░░░░] *Monero Privacy Hub: Shielding RingCT*
Zero-KYC Janitor will permanently scrub all records post-settlement.`;

    return {
      chatId: msg.chat.id,
      text,
      parseMode: 'Markdown'
    };
  }

  /**
   * /help command
   */
  public async handleHelp(msg: TelegramMessage): Promise<OutgoingReply> {
    const text = 
`🛡️ *CoinSwag Zero-KYC Guarantee*

1. *Zero Accounts / No Registration:* We do not log IP addresses, telegram handles, or chat records.
2. *Monero RingCT Pivot:* All cross-chain swaps route through Monero's zero-knowledge hub to sever transaction linkability between sender and recipient.
3. *Ephemeral Sessions:* Order metadata is permanently shredded by our automated Janitor after settlement.

Commands:
• \`/start\` — Welcome & quick actions
• \`/rates\` — Supported assets & fees
• \`/quote <from> <to> <amount>\` — Live rate quote
• \`/swap <from> <to> <amount> <addr>\` — Create swap
• \`/track <id>\` — Check order status`;

    return {
      chatId: msg.chat.id,
      text,
      parseMode: 'Markdown'
    };
  }
}
