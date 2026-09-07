import { Blockchain } from '../types/asset';

export class AddressValidator {
  /**
   * Validates if an address format is valid for the target blockchain.
   */
  public static isValid(chain: Blockchain, address: string): boolean {
    if (!address || typeof address !== 'string') return false;
    const cleanAddress = address.trim();

    switch (chain) {
      case 'monero':
        // Standard addresses start with 4, subaddresses with 8, integrated with 4. Length 95 or 106 chars.
        return /^[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93}$/.test(cleanAddress) || 
               /^[4][0-9AB][1-9A-HJ-NP-Za-km-z]{104}$/.test(cleanAddress);

      case 'bitcoin':
        // Legacy (1...), P2SH (3...), Native SegWit (bc1q...), Taproot (bc1p...)
        return /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})$/i.test(cleanAddress);

      case 'ethereum':
      case 'bsc':
      case 'polygon':
      case 'avalanche':
        // EVM 0x + 40 hex characters
        return /^0x[a-fA-F0-9]{40}$/.test(cleanAddress);

      case 'cardano':
        // Shelley addr1... (58-108 chars) or Byron
        return /^(addr1[a-z0-9]{50,110}|Ae2[a-zA-Z0-9]{56}|DdzFF[a-zA-Z0-9]{99})$/.test(cleanAddress);

      case 'polkadot':
        // Substrate base58 starting with 1, length 46-48
        return /^1[a-km-zA-HJ-NP-Z1-9]{46,48}$/.test(cleanAddress);

      case 'cosmos':
        // Bech32 starting with cosmos1
        return /^cosmos1[a-z0-9]{38,45}$/.test(cleanAddress);

      case 'near':
        // Named accounts (e.g. alice.near) or 64-hex implicit accounts
        return /^([a-z0-9._-]+\.near|[a-f0-9]{64})$/i.test(cleanAddress);

      case 'kaspa':
        // Bech32 starting with kaspa:
        return /^kaspa:[a-z0-9]{60,65}$/.test(cleanAddress);

      case 'ton':
        // Base64 user-friendly (EQ... or UQ...) 48 chars
        return /^(EQ|UQ)[a-zA-Z0-9_-]{46}$/.test(cleanAddress);

      case 'solana':
        // Base58 32-44 chars
        return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cleanAddress);

      case 'tron':
        // Starts with T, length 34
        return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(cleanAddress);

      case 'ripple':
        // Starts with r, 25-35 chars
        return /^r[0-9a-zA-Z]{24,34}$/.test(cleanAddress);

      case 'litecoin':
        // L..., M..., or ltc1...
        return /^(L[a-km-zA-HJ-NP-Z1-9]{26,33}|M[a-km-zA-HJ-NP-Z1-9]{26,33}|ltc1[a-z0-9]{39,59})$/i.test(cleanAddress);

      case 'dogecoin':
        // Starts with D, 34 chars
        return /^D{1}[5-9A-HJ-NP-U]{1}[1-9A-HJ-NP-Za-km-z]{32}$/.test(cleanAddress);

      case 'lightning':
        // BOLT11 invoice: starts with lnbc (mainnet), lntb (testnet), lnbcrt (regtest)
        // LNURL: starts with lnurl1
        // BOLT12: starts with lno1
        // Lightning Address: username@domain.com
        return /^(lnbc[0-9a-z]+|lntb[0-9a-z]+|lnbcrt[0-9a-z]+|lnurl1[0-9a-z]+|lno1[0-9a-z]+)$/i.test(cleanAddress) ||
               /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(cleanAddress);

      default:
        return cleanAddress.length >= 10;
    }
  }

  /**
   * Generates a sample valid dummy address for testing and sandbox simulations.
   */
  public static getSampleAddress(chain: Blockchain): string {
    switch (chain) {
      case 'lightning':
        return 'lnbc10u1pj8s092pp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdp82um59usxxck5xghhxccqzzsxqrrsssp50000000000000000000000000000000000000000000000000000';
      case 'monero':
        return '888tNkZrPN6JsEgekjMnABU4TBzc2Dt29EPAvkFxbANsAnJYPbb3iQ1YBRk1UXCDRSiKc9dhwMVgN5S9cQUiyoogDavup3H';
      case 'bitcoin':
        return 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
      case 'ethereum':
      case 'bsc':
      case 'polygon':
      case 'avalanche':
        return '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
      case 'cardano':
        return 'addr1q9r2yvh8m332n4766u47y3c8sh6858e9v49kcmv5r6l3y4q26h7f3x6m4p93z6x888hsm3y2q5j7z9c0y2g2k5l9m8s';
      case 'polkadot':
        return '1FRMM8PEiWXYax7rpS6X4XZX1aAAxSWx1CrKTyrVYhV24fg';
      case 'cosmos':
        return 'cosmos1hsk6jryyqjfhp5dhc55tc9jtckygx0e86eh6mm';
      case 'near':
        return 'coinswag.near';
      case 'kaspa':
        return 'kaspa:qrel0wdfw5e89w03t62e4j9fqu569y822d64gqvcv2y43f9a762q6a34x092f';
      case 'ton':
        return 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N';
      case 'solana':
        return '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
      case 'tron':
        return 'TLyqz4YmmYiiWrMSRnYWXdKApHDBpKE9MO';
      case 'ripple':
        return 'rG1QQv2nh2gr7RCZzpLhnq7zsHaWEnc69a';
      case 'litecoin':
        return 'ltc1qg6cv0vsv9f9mvgsv9lq3r7kvv7p7rvq2kv5e2r';
      case 'dogecoin':
        return 'DJr6r8e9FjF2u6GhyPkn8PZ7YhLz9t4k5x';
      default:
        return '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
    }
  }
}
