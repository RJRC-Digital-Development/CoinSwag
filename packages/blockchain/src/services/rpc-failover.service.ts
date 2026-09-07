import { Blockchain } from '@coinswag/core';
import { ChainRpcConfig, DEFAULT_RPC_CONFIG } from '../config/rpc.config';
import { TorProxyService } from './tor-proxy.service';

export interface RpcNodeStatus {
  endpoint: string;
  chain: Blockchain;
  isHealthy: boolean;
  latencyMs: number;
  failureCount: number;
  lastChecked: number;
}

export class RpcFailoverManager {
  private configs: Map<Blockchain, ChainRpcConfig> = new Map();
  private nodeStatuses: Map<string, RpcNodeStatus> = new Map();
  private torService: TorProxyService;

  constructor(
    customConfigs?: Partial<Record<Blockchain, ChainRpcConfig>>,
    torService?: TorProxyService
  ) {
    this.torService = torService || new TorProxyService();

    // Initialize default endpoints
    for (const [chain, config] of Object.entries(DEFAULT_RPC_CONFIG) as [Blockchain, ChainRpcConfig][]) {
      const mergedConfig = customConfigs?.[chain] || config;
      this.configs.set(chain, mergedConfig);

      for (const endpoint of mergedConfig.endpoints) {
        this.nodeStatuses.set(endpoint, {
          endpoint,
          chain,
          isHealthy: true,
          latencyMs: 50,
          failureCount: 0,
          lastChecked: Date.now()
        });
      }
    }
  }

  public getTorService(): TorProxyService {
    return this.torService;
  }


  /**
   * Returns healthy endpoints for a blockchain sorted by lowest latency.
   */
  public getHealthyEndpoints(chain: Blockchain): string[] {
    const config = this.configs.get(chain);
    if (!config) return [];

    const nodes = config.endpoints
      .map(ep => this.nodeStatuses.get(ep)!)
      .filter(n => n && (n.isHealthy || n.failureCount < 3))
      .sort((a, b) => a.latencyMs - b.latencyMs);

    // If all nodes failed, fallback to all endpoints to allow recovery attempt
    if (nodes.length === 0) {
      return config.endpoints;
    }

    return nodes.map(n => n.endpoint);
  }

  /**
   * Executes a network operation against the external node pool with automatic failover.
   * If Endpoint 1 fails or times out, it seamlessly switches to Endpoint 2 and retries!
   */
  public async executeWithFailover<T>(
    chain: Blockchain,
    operation: (endpoint: string) => Promise<T>
  ): Promise<{ result: T; endpointUsed: string; attempts: number }> {
    const endpoints = this.getHealthyEndpoints(chain);
    const config = this.configs.get(chain);
    const timeoutMs = config?.timeoutMs || 6000;
    const maxRetries = Math.min(endpoints.length, config?.maxRetries || 3);

    let lastError: any = null;

    for (let i = 0; i < maxRetries; i++) {
      const endpoint = endpoints[i];
      const status = this.nodeStatuses.get(endpoint);
      const startTime = Date.now();

      try {
        // Wrap with timeout
        const result = await Promise.race([
          operation(endpoint),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms on ${endpoint}`)), timeoutMs)
          )
        ]);

        // Success: record latency and mark healthy
        if (status) {
          status.latencyMs = Date.now() - startTime;
          status.isHealthy = true;
          status.failureCount = 0;
          status.lastChecked = Date.now();
        }

        return {
          result,
          endpointUsed: endpoint,
          attempts: i + 1
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`[RpcFailoverManager] Node ${endpoint} failed for ${chain} (${err.message}). Failing over to next node...`);

        if (status) {
          status.failureCount++;
          if (status.failureCount >= 2) {
            status.isHealthy = false;
          }
          status.lastChecked = Date.now();
        }
      }
    }

    throw new Error(`All external nodes failed for chain ${chain}. Last error: ${lastError?.message || lastError}`);
  }

  /**
   * Retrieves current status for all nodes (for monitoring / UI status badge).
   */
  public getAllNodeStatuses(): RpcNodeStatus[] {
    return Array.from(this.nodeStatuses.values());
  }

  public getActiveNode(chain: Blockchain): string {
    const healthy = this.getHealthyEndpoints(chain);
    return healthy[0] || DEFAULT_RPC_CONFIG[chain].endpoints[0];
  }

  /**
   * Allows injecting a custom endpoint or testing simulated failures.
   */
  public registerCustomEndpoint(chain: Blockchain, endpoint: string, isPriority: boolean = false): void {
    const config = this.configs.get(chain);
    if (config) {
      if (isPriority) {
        config.endpoints.unshift(endpoint);
      } else {
        config.endpoints.push(endpoint);
      }
      this.nodeStatuses.set(endpoint, {
        endpoint,
        chain,
        isHealthy: true,
        latencyMs: 25,
        failureCount: 0,
        lastChecked: Date.now()
      });
    }
  }
}
