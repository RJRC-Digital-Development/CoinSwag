// @ts-ignore
import { SocksProxyAgent } from 'socks-proxy-agent';

export interface TorProxyConfig {

  enabled?: boolean;
  proxyUrl?: string; // e.g. 'socks5h://127.0.0.1:9050'
  strictMode?: boolean; // If true, throws if Tor is unreachable
}

export class TorProxyService {
  private enabled: boolean;
  private proxyUrl: string;
  private strictMode: boolean;
  private agent?: SocksProxyAgent;

  constructor(config?: TorProxyConfig) {
    this.enabled = config?.enabled ?? (process.env.USE_TOR_PROXY === 'true' || process.env.USE_TOR_PROXY === '1');
    this.proxyUrl = config?.proxyUrl || process.env.TOR_PROXY_URL || 'socks5h://127.0.0.1:9050';
    this.strictMode = config?.strictMode ?? (process.env.TOR_STRICT_MODE === 'true');

    if (this.enabled) {
      try {
        this.agent = new SocksProxyAgent(this.proxyUrl);
      } catch (err: any) {
        console.warn(`[TorProxyService] Failed to initialize SOCKS5 agent for ${this.proxyUrl}: ${err.message}`);
        if (this.strictMode) throw err;
      }
    }
  }

  public isTorEnabled(): boolean {
    return this.enabled;
  }

  public getProxyUrl(): string {
    return this.proxyUrl;
  }

  public getAgent(): SocksProxyAgent | undefined {
    return this.enabled ? this.agent : undefined;
  }

  /**
   * Helper that injects the SOCKS5 agent into fetch / HTTP request options.
   */
  public getFetchOptions(baseOptions: any = {}): any {
    if (!this.enabled || !this.agent) {
      return baseOptions;
    }

    return {
      ...baseOptions,
      agent: this.agent
    };
  }

  /**
   * Returns daemon startup flags for Monero CLI or other tools.
   */
  public getMoneroCliDaemonFlag(): string {
    if (!this.enabled) return '';
    const cleanAddress = this.proxyUrl.replace(/^socks5h?:\/\//, '');
    return ` --proxy ${cleanAddress}`;
  }
}
