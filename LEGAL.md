# CoinSwag Non-Custodial Protocol Legal Disclaimer & Terms of Service

**Last Updated**: September 2026

PLEASE READ THIS LEGAL DISCLAIMER, RISK DISCLOSURE, AND TERMS OF SERVICE ("TERMS") CAREFULLY BEFORE INTERACTING WITH OR USING THE COINSWAG SOFTWARE, INTERFACE, APIS, TELEGRAM BOT, SMART PROTOCOLS, OR ASSOCIATED SERVICES (COLLECTIVELY, THE "PLATFORM"). BY ACCESSING, BROWSING, OR INITIATING ANY TRANSACTION ON COINSWAG, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND UNEQUIVOCALLY AGREE TO BE BOUND BY ALL PROVISIONS SET FORTH HEREIN. IF YOU DO NOT AGREE, YOU MUST IMMEDIATELY CEASE USING THE PLATFORM.

---

### 1. Non-Custodial, Decentralized Software Protocol Disclosure
1.1. **No Custody of Funds**: CoinSwag operates strictly as an autonomous, decentralized, and non-custodial software protocol and routing interface. CoinSwag, its developers, operators, contributors, node runners, and maintainers (the "Platform Entities") do not at any point hold, possess, custody, manage, control, or take legal ownership of any cryptographic assets, tokens, private keys, or deposits submitted through the interface.  
1.2. **Peer-to-Peer & Algorithmic Routing**: The platform facilitates automated cross-chain interoperability by programmatically dispatching user-specified transactions through decentralized liquidity networks, third-party decentralized bridges (e.g., THORChain), and distributed blockchain ledger networks. All conversions and payouts are executed algorithmically without human intermediation.  
1.3. **No Banking or Financial Institution Status**: CoinSwag is not a bank, broker-dealer, financial institution, money transmitter, virtual asset service provider (VASP), escrow agent, or investment advisor. No fiduciary, custodial, or attorney-client relationship exists between you and the Platform Entities.

---

### 2. Irreversibility of Blockchain Transactions & User Assumption of Risk
2.1. **Blockchain Finality**: Digital asset transactions are inherently irreversible and permanent. Once a deposit, swap, or withdrawal transaction is broadcast to a public blockchain network, it cannot be canceled, altered, modified, or refunded by anyone, including the Platform Entities.  
2.2. **Address & Parameter Accuracy**: You are solely and exclusively responsible for ensuring the absolute accuracy of all input parameters, including but not limited to source asset selection, target asset selection, destination wallet addresses, refund addresses, network type, and any required memo IDs, destination tags, or payment IDs.  
2.3. **Loss of Funds**: Entering an invalid, incorrect, incompatible, or unsupported destination address or network will result in the immediate and permanent loss of your funds. The Platform Entities have no administrative keys, backdoors, or technical capability to retrieve funds sent to erroneous destinations.

---

### 3. Address Splitting, Time-Release Vaults & Keypair Generation
3.1. **Client-Side / Ephemeral Key Generation**: When you utilize the address splitting engine with automated keypair generation, all cryptographic keypairs and mnemonic recovery seeds are generated ephemerally in volatile memory.  
3.2. **Zero-Persistence & No Server Backups**: CoinSwag **does not persist, store, log, or backup private keys, mnemonics, or user passphrases on any disk, database, or server storage**.
3.3. **User Custody Obligation**: You are solely responsible for immediately downloading, securely backing up, and safeguarding your paper key vault or AES-256-GCM encrypted vault bundle.  
3.4. **Automated Memory Shredding**: Completed, settled, or expired order records in volatile memory are permanently zeroized using a 3-pass DoD cryptographic wipe after a 10-minute time-to-live (TTL). If you fail to record or download your keys before memory shredding, your assets will be permanently inaccessible.

---

### 4. Volatility, Slippage, Network Miner Fees & Reorganizations
4.1. **Market Volatility**: Cryptographic assets are subject to extreme price volatility. Intermediate conversion rates, execution prices, and final payout amounts may vary from estimates due to dynamic liquidity pool depth, rapid market price shifts, and trading slippage.  
4.2. **Network Delays & Congestion**: Transaction settlement speed is governed exclusively by decentralized peer-to-peer miners and validators across respective blockchains. The Platform Entities are not liable for delayed confirmations, transaction rejections, network congestion, mempool spikes, blockchain chain reorganizations (reorgs), or hard forks.  
4.3. **Network Miner Fees**: Outbound payouts are subject to mandatory on-chain miner/gas fees deducted directly from output amounts according to network conditions.

---

### 5. Prohibited Jurisdictions, Sanctions & Anti-Money Laundering (AML)
5.1. **Restricted Territories**: Access to and use of CoinSwag is strictly prohibited from any jurisdiction or territory subject to comprehensive sanctions enforced by the United States Office of Foreign Assets Control (OFAC), the United Nations Security Council (UNSC), the European Union (EU), the United Kingdom (HM Treasury), or other relevant authorities, including but not limited to:
- Cuba
- Iran
- Democratic People's Republic of Korea (North Korea)
- Syria
- The Crimea, Donetsk, and Luhansk regions of Ukraine
5.2. **Sanctioned Persons**: You explicitly warrant, represent, and certify that:
- You are not listed on any OFAC Specially Designated Nationals and Blocked Persons List (SDN), Consolidated Sanctions List, or equivalent international sanctions registry.
- You are not acting on behalf of, directly or indirectly, any sanctioned individual, entity, or governmental authority.
- The funds utilized in any swap or splitting transaction are not derived from, associated with, or intended for illicit, unlawful, or criminal activities.
5.3. **Prohibited Activities**: You agree not to use CoinSwag for money laundering, terrorist financing, ransomware payments, darknet illicit marketplaces, fraud, sanctions evasion, or any activities violating applicable local or international laws.

---

### 6. Tax Obligations & Regulatory Compliance
6.1. **User Tax Responsibility**: You bear sole and exclusive responsibility for determining what, if any, taxes apply to your cryptographic transactions conducted through CoinSwag.  
6.2. **Reporting & Remittance**: It is your sole responsibility to report, calculate, withhold, collect, and remit all applicable capital gains, income, sales, use, value-added (VAT), or other taxes to appropriate taxing authorities. CoinSwag provides no tax, legal, financial, or accounting guidance.

---

### 7. "AS-IS" and "AS-AVAILABLE" Disclaimer of Warranties
7.1. **No Warranties**: TO THE FULLEST EXTENT PERMISSIBLE UNDER APPLICABLE LAW, THE COINSWAG PLATFORM, SOFTWARE, SOURCE CODE, APIS, PROTOCOLS, ALGORITHMS, AND INTERFACES ARE PROVIDED ON AN **"AS IS"** AND **"AS AVAILABLE"** BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE.  
7.2. **Exclusion of Implied Terms**: THE PLATFORM ENTITIES SPECIFICALLY DISCLAIM ALL IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, QUIET ENJOYMENT, SYSTEM INTEGRATION, DATA ACCURACY, FREEDOM FROM COMPUTER VIRUSES OR CODE DEFECTS, AND NON-INFRINGEMENT.  
7.3. **Uptime & Bug-Free Operation**: THE PLATFORM ENTITIES DO NOT WARRANT THAT ACCESS TO THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, ACCURATE, COMPLETE, RELIABLE, OR FREE FROM HARDWARE OR SOFTWARE VULNERABILITIES, RPC NODE FAILURES, OR DECENTRALIZED PROTOCOL EXPLOITS.

---

### 8. Strict Limitation of Liability
8.1. **Exclusion of Damages**: TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE PLATFORM ENTITIES, DEVELOPERS, OPERATORS, CONTRIBUTORS, OR AFFILIATES BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE, OR CONSEQUENTIAL DAMAGES WHATSOEVER (INCLUDING, WITHOUT LIMITATION, DAMAGES FOR LOSS OF PROFITS, LOSS OF REVENUE, LOSS OF CRYPTOGRAPHIC ASSETS, LOSS OF PRIVATE KEYS, CORRUPTION OF DATA, BUSINESS INTERRUPTION, EQUIPMENT FAILURE, PROTOCOL FORKS, THIRD-PARTY DEX LIQUIDITY DEPLETION, OR ANY OTHER FINANCIAL LOSS) ARISING OUT OF OR IN CONNECTION WITH:
- YOUR ACCESS TO, USE OF, OR INABILITY TO USE THE PLATFORM;
- ANY BLOCKCHAIN REORGANIZATION, MEMPOOL DELAY, NODE OUTAGE, OR TRANSACTION FAILURE;
- UNAUTHORIZED ACCESS TO OR ALTERATION OF YOUR KEYS, TRANSMISSIONS, OR DATA;
- LOSS OF FUNDS RESULTING FROM INCORRECT ADDRESSES, UNRECORDED PASSPHRASES, OR FORGOTTEN SECRET TOKENS;
- ANY CONDUCT OR TRANSACTION OF ANY THIRD-PARTY LIQUIDITY PROVIDER OR RPC NODE.  
8.2. **Sole Remedy**: IF YOU ARE DISSATISFIED WITH THE PLATFORM OR ANY TRANSACTION, YOUR SOLE AND EXCLUSIVE REMEDY IS TO DISCONTINUE USING COINSWAG.

---

### 9. Indemnification
You agree to defend, indemnify, and hold harmless the Platform Entities, their contributors, maintainers, operators, and agents from and against any and all claims, liabilities, damages, losses, costs, expenses, fees (including reasonable legal fees and costs) arising out of or relating to:
1. Your use of, or activities in connection with, the Platform;
2. Your violation of these Terms;
3. Your violation of any rights of any third party or blockchain network rules;
4. Your violation of any applicable local, state, national, or international statute, regulation, or sanction.

---

### 10. Modifications to Protocol & Terms
The Platform Entities reserve the right, at their sole discretion, to modify, update, replace, suspend, or discontinue any aspect of the Platform, software, or these Terms at any time without prior individual notice. Your continued use of the Platform following the posting of any changes constitutes full and irrevocable acceptance of those modifications.

---

### 11. Severability & Entire Agreement
If any provision of these Terms is found to be unlawful, void, or for any reason unenforceable, that provision shall be deemed severable from these Terms and shall not affect the validity and enforceability of any remaining provisions. These Terms constitute the complete and exclusive understanding between you and the Platform Entities regarding the use of CoinSwag.
