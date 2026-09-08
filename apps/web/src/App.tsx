import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { SwapWidget } from './components/SwapWidget';
import { SplitSwapWidget } from './components/SplitSwapWidget';
import { SwapStatusModal } from './components/SwapStatusModal';
import { SplitStatusModal } from './components/SplitStatusModal';
import { OperatorDrawer } from './components/OperatorDrawer';
import { LegalDisclaimerModal } from './components/LegalDisclaimerModal';
import { TokenItem } from './components/TokenSelectorModal';
import { Shield, Lock, Zap, RefreshCw, Layers, Clock, Scale, ArrowDownToLine, Route } from 'lucide-react';

export const App: React.FC = () => {
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const [isOperatorOpen, setIsOperatorOpen] = useState(false);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [swapMode, setSwapMode] = useState<'single' | 'split'>('single');

  // Fetch supported tokens from API
  useEffect(() => {
    async function loadAssets() {
      try {
        const res = await fetch('/api/v1/assets');
        const data = await res.json();
        if (data.assets) {
          setTokens(data.assets);
        }
      } catch (err) {
        console.error('Failed to load assets from API', err);
      } finally {
        setIsLoadingTokens(false);
      }
    }
    loadAssets();
  }, []);

  // Listen to SSE live updates when a standard swap order is active
  useEffect(() => {
    if (!activeOrder || activeOrder.id?.startsWith('split_')) return;
    const sse = new EventSource(`/api/v1/swaps/${activeOrder.id}/stream`);

    sse.onmessage = (event) => {
      try {
        const updated = JSON.parse(event.data);
        setActiveOrder(updated);
      } catch (e) {
        console.error('Error parsing SSE event', e);
      }
    };

    return () => {
      sse.close();
    };
  }, [activeOrder?.id]);

  const handleAdvanceStep = async (orderId: string) => {
    try {
      const endpoint = orderId.startsWith('split_')
        ? `/api/v1/splits/${orderId}/advance`
        : `/api/v1/swaps/${orderId}/advance`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'x-secret-token': activeOrder?.secretToken || '' }
      });
      const data = await res.json();
      if (data.order) {
        setActiveOrder(data.order);
      }
    } catch (err) {
      console.error('Failed to advance step', err);
    }
  };

  const handleAutoComplete = async (orderId: string) => {
    try {
      await fetch(`/api/v1/swaps/${orderId}/auto-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-secret-token': activeOrder?.secretToken || '' },
        body: JSON.stringify({ stepDelayMs: 650 })
      });
    } catch (err) {
      console.error('Failed to auto complete', err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between relative overflow-hidden">
      <Navbar
        onOpenOperatorDrawer={() => setIsOperatorOpen(true)}
        onOpenLegalModal={() => setIsLegalOpen(true)}
      />

      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 sm:py-14 w-full space-y-10 relative">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#FF6600]/10 border border-[#FF6600]/30 text-[#FF6600] text-xs font-mono font-bold tracking-[0.12em] shadow-lg shadow-orange-950/30">
            <Shield className="w-3.5 h-3.5" />
            <span>MONERO-ROUTED MULTI-CHAIN SWAPS</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-[-0.045em] leading-[0.98]">
            Swap Any Coin. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6600] via-amber-400 to-emerald-400">
              Filtered Through Monero.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto font-sans leading-relaxed">
            Every transaction routes through Monero’s RingCT zero-knowledge hub to cryptographically break ledger traceability between sender and receiver.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-1 text-[11px] font-mono text-slate-400">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1.5"><Route className="h-3 w-3 text-emerald-400" /> Multi-chain routes</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1.5"><Shield className="h-3 w-3 text-amber-400" /> Non-custodial design</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1.5"><ArrowDownToLine className="h-3 w-3 text-orange-400" /> No account required</span>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex justify-center">
          <div className="bg-slate-950/80 border border-slate-700/80 p-1 rounded-2xl inline-flex space-x-1 shadow-2xl shadow-black/30">
            <button
              type="button"
              onClick={() => setSwapMode('single')}
              className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center space-x-2 cursor-pointer ${
                swapMode === 'single'
                  ? 'bg-gradient-to-r from-[#FF6600] to-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Instant Privacy Swap (0.45% / 0.75%)</span>
            </button>

            <button
              type="button"
              onClick={() => setSwapMode('split')}
              className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center space-x-2 cursor-pointer ${
                swapMode === 'split'
                  ? 'bg-gradient-to-r from-[#FF6600] to-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Address Split & Time-Lock (Up to 1 Month)</span>
            </button>
          </div>
        </div>

        {/* Swap Engine Main Widget */}
        {isLoadingTokens ? (
          <div className="flex flex-col items-center justify-center p-16 space-y-3">
            <RefreshCw className="w-8 h-8 text-[#FF6600] animate-spin" />
            <p className="text-xs font-mono text-slate-500">Connecting to CoinSwag Decentralized Hub...</p>
          </div>
        ) : swapMode === 'single' ? (
          <SwapWidget
            tokens={tokens}
            onOrderCreated={(order) => setActiveOrder(order)}
          />
        ) : (
          <SplitSwapWidget
            tokens={tokens}
            onSplitOrderCreated={(order) => setActiveOrder(order)}
          />
        )}

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-8 border-t border-[#262D3D]/60">
          <div className="p-5 rounded-2xl bg-[#121620]/85 border border-[#262D3D] space-y-2 transition duration-300 hover:-translate-y-1 hover:border-orange-500/40 hover:shadow-xl hover:shadow-orange-950/20">
            <div className="w-10 h-10 rounded-xl bg-[#FF6600]/10 text-[#FF6600] flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Monero Routing Layer</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Route eligible assets through a Monero conversion leg with ephemeral order sessions and automatic metadata cleanup.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#121620]/85 border border-[#262D3D] space-y-2 transition duration-300 hover:-translate-y-1 hover:border-amber-500/40 hover:shadow-xl hover:shadow-amber-950/20">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Time-Release Vaults</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Split output across unlimited addresses with scheduled release dates up to 30 days. Optional zero-knowledge private key generation for paper vault backups.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#121620]/85 border border-[#262D3D] space-y-2 transition duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-950/20">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Top 20+ Native Blockchains</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Native support for Bitcoin, Ethereum, Monero, Solana, USDT, USDC, BNB, Ripple, Litecoin, Avalanche, Polygon, and Dogecoin.
            </p>
          </div>
        </div>
      </main>

      {/* Active Swap Modal */}
      {activeOrder && (
        activeOrder.id?.startsWith('split_') ? (
          <SplitStatusModal
            order={activeOrder}
            onClose={() => setActiveOrder(null)}
            onAdvanceStep={handleAdvanceStep}
          />
        ) : (
          <SwapStatusModal
            order={activeOrder}
            onClose={() => setActiveOrder(null)}
            onAdvanceStep={handleAdvanceStep}
            onAutoComplete={handleAutoComplete}
          />
        )
      )}

      {/* Operator Drawer */}
      <OperatorDrawer
        isOpen={isOperatorOpen}
        onClose={() => setIsOperatorOpen(false)}
      />

      {/* Legal & Non-Custodial Protocol Modal */}
      <LegalDisclaimerModal
        isOpen={isLegalOpen}
        onClose={() => setIsLegalOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-[#262D3D] bg-[#0A0D14] py-8 px-4 text-center text-xs font-sans text-slate-500 space-y-3">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs">
          <button
            onClick={() => setIsLegalOpen(true)}
            className="text-slate-400 hover:text-amber-400 flex items-center space-x-1.5 transition cursor-pointer"
          >
            <Scale className="w-3.5 h-3.5 text-amber-400" />
            <span className="underline decoration-slate-700 underline-offset-4">Non-Custodial Protocol Notice & Terms</span>
          </button>
          <span className="text-slate-700">•</span>
          <button
            onClick={() => setIsLegalOpen(true)}
            className="text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            <span className="underline decoration-slate-700 underline-offset-4">Blockchain Risk Disclosures</span>
          </button>
          <span className="text-slate-700">•</span>
          <span className="font-mono text-[11px] text-emerald-400/80">Monero-Routed • Ephemeral Order Data</span>
        </div>
        <p className="text-[11px] text-slate-600 font-mono">
          CoinSwag is open-source algorithmic routing software. Software operators do not hold custody of funds.
        </p>
      </footer>
    </div>
  );
};
