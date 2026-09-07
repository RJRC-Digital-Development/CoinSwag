import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { SwapWidget } from './components/SwapWidget';
import { SwapStatusModal } from './components/SwapStatusModal';
import { OperatorDrawer } from './components/OperatorDrawer';
import { TokenItem } from './components/TokenSelectorModal';
import { Shield, Lock, Zap, RefreshCw, Cpu, Layers } from 'lucide-react';

export const App: React.FC = () => {
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const [isOperatorOpen, setIsOperatorOpen] = useState(false);


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

  // Listen to SSE live updates when an order is active
  useEffect(() => {
    if (!activeOrder) return;
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
      const res = await fetch(`/api/v1/swaps/${orderId}/advance`, { method: 'POST' });
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

      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 sm:py-12 w-full space-y-12">
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

        {/* Swap Engine Main Widget */}
        {isLoadingTokens ? (
          <div className="flex flex-col items-center justify-center p-16 space-y-3">
            <RefreshCw className="w-8 h-8 text-[#FF6600] animate-spin" />
            <p className="text-xs font-mono text-slate-500">Connecting to CoinSwag Decentralized Hub...</p>
          </div>
        ) : (
          <SwapWidget
            tokens={tokens}
            onOrderCreated={(order) => setActiveOrder(order)}
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
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Competitive Pricing</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Single hops at 0.45% and full double-hop privacy routes at 0.75% all-in. Beats industry competitors charging 1.0% to 1.8%.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-[#121620] border border-[#262D3D] space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Top 10+ Native Blockchains</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Native support for Bitcoin, Ethereum, Monero, Solana, USDT, USDC, BNB, Ripple, Litecoin, and Dogecoin with automatic mempool monitoring.
            </p>
          </div>
        </div>
      </main>

      {/* Active Swap Modal */}
      {activeOrder && (
        <SwapStatusModal
          order={activeOrder}
          onClose={() => setActiveOrder(null)}
          onAdvanceStep={handleAdvanceStep}
          onAutoComplete={handleAutoComplete}
        />
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

