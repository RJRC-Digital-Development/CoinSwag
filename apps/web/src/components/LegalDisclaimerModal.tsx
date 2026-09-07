import React, { useState } from 'react';
import { X, ShieldAlert, AlertTriangle, FileText, CheckCircle2, Scale, ExternalLink } from 'lucide-react';

interface LegalDisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LegalDisclaimerModal: React.FC<LegalDisclaimerModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'full'>('summary');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-[#0F131D] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-200 font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-[#141A28]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>Non-Custodial Protocol Legal Notice</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">v1.2</span>
              </h2>
              <p className="text-xs text-slate-400">Risk disclosures, non-custodial terms & user agreement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-900/60 px-5 pt-2">
          <button
            onClick={() => setActiveTab('summary')}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition flex items-center space-x-2 cursor-pointer ${
              activeTab === 'summary'
                ? 'border-[#FF6600] text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Essential Risk Summary</span>
          </button>
          <button
            onClick={() => setActiveTab('full')}
            className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition flex items-center space-x-2 cursor-pointer ${
              activeTab === 'full'
                ? 'border-[#FF6600] text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Full Legal Terms of Service</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-300 leading-relaxed custom-scrollbar">
          {activeTab === 'summary' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1">
                <div className="font-bold flex items-center space-x-1.5 text-amber-300 text-sm">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Important Protocol Disclosures</span>
                </div>
                <p>
                  CoinSwag is purely non-custodial, open routing software. By using this interface, you explicitly accept all risks of cryptocurrency transactions and acknowledge that no entity possesses custody of your funds.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <h4 className="font-bold text-white text-xs flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Strictly Non-Custodial</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    CoinSwag never holds, custodies, or controls your assets. Funds are routed directly on-chain through decentralized liquidity networks and automated Monero privacy hops.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <h4 className="font-bold text-white text-xs flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Blockchain Irreversibility</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    All on-chain broadcasts are permanent and irreversible. Funds sent to an incorrect address or incompatible chain cannot be recovered or refunded.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <h4 className="font-bold text-white text-xs flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Zero-Persistence Key Responsibility</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Auto-generated private keys and vaults exist only in temporary server RAM. Once downloaded or after the 10-minute order purge, memory is zeroized. You alone are responsible for storing your keys and passphrases.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <h4 className="font-bold text-white text-xs flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Prohibited Jurisdictions</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Persons located in or subject to sanctions enforced by OFAC, the UN, the EU, or the UK (including Cuba, Iran, North Korea, Syria, and Crimea) are strictly prohibited from using this platform.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <h4 className="font-bold text-white text-xs">Limitation of Liability & "AS-IS" Warranty</h4>
                <p className="text-xs text-slate-400">
                  The CoinSwag interface and protocol are provided on an "AS-IS" and "AS-AVAILABLE" basis without warranties of any kind. Under no circumstances shall developers, operators, or contributors be held liable for trading losses, market slippage, network congestion, mempool spikes, or user configuration errors.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6 text-xs text-slate-300">
              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">1. Nature of the Protocol</h3>
                <p>
                  CoinSwag is a free, decentralized, non-custodial software routing interface. It does not provide custodial, brokerage, exchange, banking, or escrow services. Software developers, operators, and node runners do not maintain control over deposits or withdrawals and have no authority to freeze or recover transactions.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">2. Assumption of Blockchain Risks</h3>
                <p>
                  You expressly assume all risks associated with cryptographic systems, smart contracts, decentralized liquidity bridges (including THORChain), cross-chain swaps, and Monero RingCT churns. You acknowledge that cryptocurrency values are highly volatile and that transactions are subject to network miner fees, block confirmation delays, and blockchain reorganizations.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">3. Address Accuracy & Irrevocability</h3>
                <p>
                  You are solely responsible for entering correct destination addresses and tags/memos. Submitting an erroneous address, unsupported token contract, or wrong chain will result in the total, permanent loss of assets. CoinSwag has no administrative access or technical ability to reverse transactions.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">4. Keypair Generation & Data Shredding</h3>
                <p>
                  When selecting automatic key generation, keys are produced in ephemeral memory using cryptographically secure random entropy. In accordance with strict Zero-KYC principles, private keys are never stored on persistent disk storage. You must download and save your encrypted AES-256-GCM vault immediately. Once an order settles, memory is purged via 3-pass DoD zeroization.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">5. Sanctions & Compliance Certifications</h3>
                <p>
                  You represent and warrant that you are not a resident or citizen of any OFAC-sanctioned territory, nor are you an individual or entity designated on any international sanctions blacklist. You agree not to use the platform for any illegal purpose, including money laundering, financing terrorism, or illicit trade.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">6. Exclusion of Warranties & Damages</h3>
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE PLATFORM IS PROVIDED "AS IS". PLATFORM DEVELOPERS AND OPERATORS DISCLAIM ALL WARRANTIES AND SHALL NOT BE LIABLE FOR ANY CONSEQUENTIAL, INDIRECT, INCIDENTAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, CRYPTOGRAPHIC ASSETS, OR OPERATIONAL INTERRUPTIONS.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-[#141A28]">
          <span className="text-[11px] text-slate-500 font-mono">
            By interacting with CoinSwag, you agree to these terms.
          </span>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#FF6600] to-amber-500 text-slate-950 hover:brightness-110 transition shadow-md cursor-pointer"
            >
              I Understand & Accept
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
