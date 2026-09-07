import { SplitOrder, SplitDestination } from '@coinswag/core';
import { SplitRouter } from '@coinswag/liquidity';

export interface ScheduledReleaseItem {
  orderId: string;
  destinationId: string;
  assetId: string;
  address: string;
  amountOut: number;
  releaseAt: number;
  status: 'HOLD_TIME_LOCKED' | 'BROADCASTING' | 'RELEASED' | 'FAILED';
}

export class TimeReleaseManager {
  private splitRouter: SplitRouter;
  private activeOrders: Map<string, SplitOrder> = new Map();
  private timerHandle?: NodeJS.Timeout;
  private isProcessing: boolean = false;
  private onOrderUpdated?: (order: SplitOrder) => void;

  constructor(splitRouter: SplitRouter, onOrderUpdated?: (order: SplitOrder) => void) {
    this.splitRouter = splitRouter;
    this.onOrderUpdated = onOrderUpdated;

    // Tick every 10 seconds to check for mature time-locks
    this.timerHandle = setInterval(() => this.processMaturedReleases(), 10000);
    if (this.timerHandle.unref) this.timerHandle.unref();
  }

  public registerOrder(order: SplitOrder): void {
    this.activeOrders.set(order.id, order);
  }

  public getOrder(orderId: string): SplitOrder | undefined {
    return this.activeOrders.get(orderId);
  }

  /**
   * Scans all active orders and executes payouts for destinations whose hold duration has elapsed.
   */
  public async processMaturedReleases(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;
    let releasedCount = 0;
    const now = Date.now();

    try {
      for (const [orderId, order] of this.activeOrders.entries()) {
        if (order.status === 'AWAITING_DEPOSIT' || order.status === 'EXPIRED' || order.status === 'FAILED') {
          continue;
        }

        let orderModified = false;

        for (const dest of order.destinations) {
          if ((dest.status === 'READY_TO_RELEASE' || dest.status === 'HOLD_TIME_LOCKED') && now >= dest.releaseAt) {
            dest.status = 'BROADCASTING';
            try {
              const result = await this.splitRouter.dispatchSplitLeg(dest);
              dest.payoutTxHash = result.txHash;
              dest.releasedAt = Date.now();
              dest.status = 'RELEASED';
              releasedCount++;
              orderModified = true;
            } catch (err: any) {
              console.error(`Failed to dispatch split payout for destination ${dest.id}:`, err);
              dest.status = 'FAILED';
              orderModified = true;
            }
          }
        }

        if (orderModified) {
          // Update order status based on remaining destinations
          const allReleased = order.destinations.every(d => d.status === 'RELEASED');
          const anyReleased = order.destinations.some(d => d.status === 'RELEASED');

          if (allReleased) {
            order.status = 'COMPLETED';
            order.statusMessage = 'All split destinations have been disbursed and settled.';
            order.completedAt = Date.now();
          } else if (anyReleased) {
            order.status = 'PARTIALLY_RELEASED';
            order.statusMessage = 'Some split tranches have matured and paid out; others remain time-locked.';
          }

          if (this.onOrderUpdated) {
            this.onOrderUpdated(order);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return releasedCount;
  }

  /**
   * Allows the owner (with valid secretToken) to prematurely release a time-locked tranche.
   */
  public async releaseTrancheEarly(
    orderId: string,
    destinationId: string,
    secretToken: string
  ): Promise<{ success: boolean; txHash?: string; message: string }> {
    const order = this.activeOrders.get(orderId);
    if (!order) {
      throw new Error(`Split order ${orderId} not found`);
    }
    if (order.secretToken !== secretToken) {
      throw new Error('Unauthorized: Invalid secret order token');
    }

    const dest = order.destinations.find(d => d.id === destinationId);
    if (!dest) {
      throw new Error(`Split destination ${destinationId} not found in order`);
    }

    if (dest.status === 'RELEASED') {
      return { success: true, txHash: dest.payoutTxHash, message: 'Tranche was already released' };
    }

    dest.status = 'BROADCASTING';
    const result = await this.splitRouter.dispatchSplitLeg(dest);
    dest.payoutTxHash = result.txHash;
    dest.releasedAt = Date.now();
    dest.status = 'RELEASED';

    const allReleased = order.destinations.every(d => d.status === 'RELEASED');
    if (allReleased) {
      order.status = 'COMPLETED';
      order.statusMessage = 'All split destinations have been disbursed and settled.';
      order.completedAt = Date.now();
    } else {
      order.status = 'PARTIALLY_RELEASED';
      order.statusMessage = 'Early tranche released; remaining tranches remain time-locked.';
    }

    if (this.onOrderUpdated) {
      this.onOrderUpdated(order);
    }

    return {
      success: true,
      txHash: result.txHash,
      message: `Tranche ${dest.id} successfully released early on-chain`
    };
  }

  /**
   * Retrieves the scheduled release timeline for an order.
   */
  public getScheduleTimeline(orderId: string): ScheduledReleaseItem[] {
    const order = this.activeOrders.get(orderId);
    if (!order) return [];

    return order.destinations.map(d => ({
      orderId: order.id,
      destinationId: d.id,
      assetId: d.assetId,
      address: d.address,
      amountOut: d.estimatedAmountOut,
      releaseAt: d.releaseAt,
      status: d.status === 'RELEASED' ? 'RELEASED' : (d.status === 'BROADCASTING' ? 'BROADCASTING' : (d.status === 'FAILED' ? 'FAILED' : 'HOLD_TIME_LOCKED'))
    }));
  }

  public stop(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
    }
  }
}
