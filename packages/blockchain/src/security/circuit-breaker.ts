export interface OutflowRecord {
  id: string;
  timestamp: number;
  assetId: string;
  amount: number;
  usdValue: number;
  destinationAddress: string;
}

export type CircuitBreakerState = 'CLOSED' | 'TRIPPED' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  windowMs?: number;               // Rolling window duration (default 10 minutes)
  maxVelocityWindowUsd?: number;   // Max total USD outflow allowed per window (default $100,000)
  maxSinglePayoutUsd?: number;     // Max single USD payout allowed (default $50,000)
  maxConsecutiveFailures?: number; // Failures before auto-trip (default 5)
}

export class EmergencyDrainCircuitBreakerError extends Error {
  constructor(message: string) {
    super(`[FINANCIAL SENTINEL - CIRCUIT BREAKER TRIPPED] ${message}`);
    this.name = 'EmergencyDrainCircuitBreakerError';
  }
}

export class FinancialCircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private trippedReason?: string;
  private trippedAt?: number;
  private consecutiveFailures: number = 0;

  private outflows: OutflowRecord[] = [];
  private readonly windowMs: number;
  private readonly maxVelocityWindowUsd: number;
  private readonly maxSinglePayoutUsd: number;
  private readonly maxConsecutiveFailures: number;

  constructor(config: CircuitBreakerConfig = {}) {
    this.windowMs = config.windowMs || 10 * 60 * 1000; // 10 minutes
    this.maxVelocityWindowUsd = config.maxVelocityWindowUsd || 100000; // $100k / 10min
    this.maxSinglePayoutUsd = config.maxSinglePayoutUsd || 50000; // $50k single
    this.maxConsecutiveFailures = config.maxConsecutiveFailures || 5;
  }

  /**
   * Evaluates if an outflow payout is safe to broadcast.
   * Throws EmergencyDrainCircuitBreakerError if limits are breached or breaker is tripped.
   */
  public authorizeOutflow(
    assetId: string,
    amount: number,
    usdValue: number,
    destinationAddress: string
  ): void {
    if (this.state === 'TRIPPED') {
      throw new EmergencyDrainCircuitBreakerError(
        `Outflows are currently frozen. Reason: ${this.trippedReason || 'Emergency circuit tripped'}`
      );
    }

    // Check single payout limit
    if (usdValue > this.maxSinglePayoutUsd) {
      this.trip(`Single payout amount ($${usdValue.toFixed(2)}) exceeds maximum safe limit ($${this.maxSinglePayoutUsd.toFixed(2)})`);
      throw new EmergencyDrainCircuitBreakerError(
        `Payout of $${usdValue.toFixed(2)} exceeds single payout limit of $${this.maxSinglePayoutUsd.toFixed(2)}. Outflow halted.`
      );
    }

    const now = Date.now();
    this.purgeStaleOutflows(now);

    const currentVelocityUsd = this.getRollingVelocityUsd();
    if (currentVelocityUsd + usdValue > this.maxVelocityWindowUsd) {
      this.trip(
        `Rolling outflow velocity limit breached ($${(currentVelocityUsd + usdValue).toFixed(2)} / $${this.maxVelocityWindowUsd.toFixed(2)} in ${Math.round(this.windowMs / 60000)}m)`
      );
      throw new EmergencyDrainCircuitBreakerError(
        `Outflow velocity ceiling breached. Hot wallet drain protection active.`
      );
    }

    // Record approved outflow
    this.outflows.push({
      id: `out_${now}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now,
      assetId,
      amount,
      usdValue,
      destinationAddress
    });

    this.consecutiveFailures = 0; // Reset consecutive failures on success
  }

  /**
   * Reports an on-chain broadcast error to detect drain or RPC exploitation loops.
   */
  public recordBroadcastFailure(reason: string): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.trip(`Too many consecutive broadcast failures (${this.consecutiveFailures}). Last error: ${reason}`);
    }
  }

  /**
   * Manually or automatically trip the breaker.
   */
  public trip(reason: string): void {
    this.state = 'TRIPPED';
    this.trippedReason = reason;
    this.trippedAt = Date.now();
    console.error(`🚨 [CIRCUIT BREAKER ENGAGED] All crypto outflows blocked! Reason: ${reason}`);
  }

  /**
   * Resets the breaker to CLOSED status (requires operator intervention).
   */
  public reset(): void {
    this.state = 'CLOSED';
    this.trippedReason = undefined;
    this.trippedAt = undefined;
    this.consecutiveFailures = 0;
    this.outflows = [];
    console.log(`🛡️ [CIRCUIT BREAKER RESET] Outflows safely resumed in CLOSED state.`);
  }

  /**
   * Calculate current rolling window velocity in USD.
   */
  public getRollingVelocityUsd(): number {
    this.purgeStaleOutflows(Date.now());
    return this.outflows.reduce((sum, item) => sum + item.usdValue, 0);
  }

  /**
   * Returns current breaker status and telemetry.
   */
  public getStatus() {
    return {
      state: this.state,
      isHalted: this.state === 'TRIPPED',
      rollingWindowTotalUsd: this.getRollingVelocityUsd(),
      windowMinutes: Math.round(this.windowMs / 60000),
      maxVelocityWindowUsd: this.maxVelocityWindowUsd,
      maxSinglePayoutUsd: this.maxSinglePayoutUsd,
      recentOutflowsCount: this.outflows.length,
      trippedReason: this.trippedReason,
      trippedAt: this.trippedAt,
      consecutiveFailures: this.consecutiveFailures
    };
  }

  private purgeStaleOutflows(now: number): void {
    const cutoff = now - this.windowMs;
    this.outflows = this.outflows.filter(o => o.timestamp > cutoff);
  }
}
