import { SwapOrder, SwapStatus } from '../types/order';

export class SwapStateMachine {
  private static VALID_TRANSITIONS: Record<SwapStatus, SwapStatus[]> = {
    'AWAITING_DEPOSIT': ['DEPOSIT_DETECTED', 'EXPIRED', 'FAILED'],
    'DEPOSIT_DETECTED': ['DEPOSIT_CONFIRMED', 'FAILED'],
    'DEPOSIT_CONFIRMED': [
      'HOP1_CONVERTING_TO_XMR',    // Normal double hop or A -> XMR
      'HOP2_CONVERTING_TO_TARGET', // If starting from XMR (skip hop 1)
      'REFUND_PENDING',
      'FAILED'
    ],
    'HOP1_CONVERTING_TO_XMR': ['XMR_RECEIVED_IN_HUB', 'REFUND_PENDING', 'FAILED'],
    'XMR_RECEIVED_IN_HUB': [
      'XMR_ANONYMIZING',           // If stealth delay or churn enabled
      'HOP2_CONVERTING_TO_TARGET', // Direct hop 2 execution
      'PAYOUT_BROADCASTING',       // If target is XMR (skip hop 2)
      'REFUND_PENDING',
      'FAILED'
    ],
    'XMR_ANONYMIZING': ['HOP2_CONVERTING_TO_TARGET', 'PAYOUT_BROADCASTING', 'REFUND_PENDING', 'FAILED'],
    'HOP2_CONVERTING_TO_TARGET': ['PAYOUT_BROADCASTING', 'REFUND_PENDING', 'FAILED'],
    'PAYOUT_BROADCASTING': ['COMPLETED', 'FAILED'],
    'COMPLETED': [],
    'EXPIRED': [],
    'REFUND_PENDING': ['REFUNDED', 'FAILED'],
    'REFUNDED': [],
    'FAILED': []
  };

  /**
   * Check whether a transition from current to next status is permitted.
   */
  public static canTransition(current: SwapStatus, next: SwapStatus): boolean {
    const allowed = this.VALID_TRANSITIONS[current];
    return allowed ? allowed.includes(next) : false;
  }

  /**
   * Advances the order to the next valid state according to Monero Hub routing rules.
   */
  public static transition(
    order: SwapOrder,
    nextStatus: SwapStatus,
    message?: string
  ): SwapOrder {
    if (!this.canTransition(order.status, nextStatus)) {
      throw new Error(`Illegal state transition from ${order.status} to ${nextStatus}`);
    }

    const updated: SwapOrder = {
      ...order,
      status: nextStatus,
      statusMessage: message || this.getDefaultMessage(nextStatus)
    };

    if (nextStatus === 'COMPLETED') {
      updated.completedAt = Date.now();
    }

    return updated;
  }

  /**
   * Returns a friendly status message for each stage.
   */
  public static getDefaultMessage(status: SwapStatus): string {
    switch (status) {
      case 'AWAITING_DEPOSIT':
        return 'Waiting for deposit to single-use address...';
      case 'DEPOSIT_DETECTED':
        return 'Deposit detected in mempool. Awaiting network confirmations...';
      case 'DEPOSIT_CONFIRMED':
        return 'Deposit confirmed on blockchain. Initiating swap pipeline...';
      case 'HOP1_CONVERTING_TO_XMR':
        return 'Hop 1: Exchanging deposit coin into Monero (XMR) Zero-Knowledge Hub...';
      case 'XMR_RECEIVED_IN_HUB':
        return 'Monero Hub: RingCT and stealth addresses activated. Ledger traceability broken.';
      case 'XMR_ANONYMIZING':
        return 'Monero Hub: Applying stealth delay / subaddress churn to decouple timing correlation...';
      case 'HOP2_CONVERTING_TO_TARGET':
        return 'Hop 2: Exchanging Monero into requested destination token...';
      case 'PAYOUT_BROADCASTING':
        return 'Signing and broadcasting payout transaction to destination network...';
      case 'COMPLETED':
        return 'Swap completed successfully! Funds delivered to destination wallet.';
      case 'EXPIRED':
        return 'Order expired: No deposit was detected within the payment window.';
      case 'REFUND_PENDING':
        return 'Swap could not be completed. Preparing automated refund...';
      case 'REFUNDED':
        return 'Deposit successfully refunded to emergency refund address.';
      case 'FAILED':
        return 'Swap encountered an unrecoverable error.';
      default:
        return 'Processing...';
    }
  }

  /**
   * Zero-KYC Janitor Data Shredder:
   * Permanently scrubs sensitive addresses and hashes once retention expires.
   */
  public static shredMetadata(order: SwapOrder): SwapOrder {
    return {
      ...order,
      depositAddress: '[PURGED_FOR_PRIVACY]',
      depositTxHash: '[PURGED_FOR_PRIVACY]',
      destinationAddress: '[PURGED_FOR_PRIVACY]',
      refundAddress: '[PURGED_FOR_PRIVACY]',
      metadataPurged: true,
      purgedAt: Date.now(),
      statusMessage: 'Order completed and all metadata permanently shredded under Zero-KYC policy.'
    };
  }
}
