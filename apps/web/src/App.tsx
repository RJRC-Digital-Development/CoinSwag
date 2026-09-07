import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { SwapWidget } from './components/SwapWidget';
import { SplitSwapWidget } from './components/SplitSwapWidget';
import { SwapStatusModal } from './components/SwapStatusModal';
import { SplitStatusModal } from './components/SplitStatusModal';
import { OperatorDrawer } from './components/OperatorDrawer';
import { TokenItem } from './components/TokenSelectorModal';
import { Shield, Lock, Zap, RefreshCw, Layers, Clock } from 'lucide-react';

export const App: React.FC = () => {
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const [isOperatorOpen, setIsOperatorOpen] = useState(false);
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
      const res = await fetch(endpoint, { method: 'POST' });
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepDelayMs: 650 })
      });
    } catch (err) {
      console.error('Failed to auto complete', err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between">
      <Navbar onOpenOperatorDrawer={() => setIsOperatorOpen(true)} />

      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 sm:py-12 w-full space-y-10">
        {/* Hero Section */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#FF6600]/10 border border-[#FF6600]/30 text-[#FF6600] text-xs font-mono font-bold tracking-wide">
            <Shield className="w-3.5 h-3.5" />
            <span>THE ZERO-KYC MONERO PRIVACY HUB</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Swap Any Coin. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6600] via-amber-400 to-emerald-400">
              Filtered Through Monero.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto font-sans">
            Every transaction routes through Monero’s RingCT zero-knowledge hub to cryptographically break ledger traceability between sender and receiver.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex justify-center">
          <div className="bg-slate-900/90 border border-slate-800 p-1 rounded-2xl inline-flex space-x-1 shadow-lg">
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
          <div className="p-5 rounded-2xl bg-[#121620] border border-[#262D3D] space-y-2">
            <div className="w-10 h-10 rounded-xl bg-[#FF6600]/10 text-[#FF6600] flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Strictly Zero-KYC</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              No registration, no accounts, no KYC verification. Ephemeral order sessions and auto-purging data shredder keep your activity anonymous.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#121620] border border-[#262D3D] space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Time-Release Vaults</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Split output across unlimited addresses with scheduled release dates up to 30 days. Optional zero-knowledge private key generation for paper vault backups.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#121620] border border-[#262D3D] space-y-2">
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

      {/* Footer */}
      <footer className="border-t border-[#262D3D] bg-[#0A0D14] py-6 px-4 text-center text-xs font-mono text-slate-500">
        <p>CoinSwag Privacy Hub Engine • Automated Multi-Chain Decentralized Liquidity • No KYC Ever</p>
      </footer>
    </div>
  );
};
