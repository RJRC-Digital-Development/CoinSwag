import React from 'react';
import { ArrowRight, ShieldCheck, EyeOff, Lock, Network } from 'lucide-react';

interface Props {
  fromSymbol: string;
  toSymbol: string;
  isDoubleHop: boolean;
}

export const PrivacyDiagram: React.FC<Props> = ({ fromSymbol, toSymbol, isDoubleHop }) => {
  return (
    <div className="w-full bg-[#0E131E] border border-[#262D3D] rounded-2xl p-4 sm:p-5 relative overflow-hidden">
      {/* Background ambient gradient */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#FF6600]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <EyeOff className="w-4 h-4 text-[#FF6600]" />
          <h4 className="text-sm font-bold text-white tracking-wide">Monero Privacy Hub Architecture</h4>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          Unlinkable On-Chain
        </span>
      </div>

      {isDoubleHop ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 relative">
          {/* Phase 1: Inbound Public Chain */}
          <div className="p-3 rounded-xl bg-[#151922] border border-[#262D3D] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Leg 1: Inbound</span>
              <span className="text-amber-400 font-mono">Public Ledger</span>
            </div>
            <div className="flex items-center space-x-2 my-1.5">
              <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-white">
                {fromSymbol}
              </div>
              <span className="text-sm font-semibold text-slate-200">Receive {fromSymbol}</span>
            </div>
            <p className="text-[11px] text-slate-500">Single-use deposit address generated. Mempool monitored.</p>
          </div>

          {/* Phase 2: Monero Zero-Knowledge Privacy Hub */}
          <div className="p-3 rounded-xl bg-gradient-to-b from-[#1C1A17] to-[#151922] border border-[#FF6600]/40 monero-glow flex flex-col justify-between relative">
            <div className="flex items-center justify-between text-xs text-[#FF6600] font-bold mb-1">
              <span className="flex items-center space-x-1">
                <Lock className="w-3 h-3" />
                <span>Zero-Knowledge Pivot</span>
              </span>
              <span className="font-mono text-[10px] bg-[#FF6600]/20 px-1.5 py-0.5 rounded">XMR Hub</span>
            </div>
            <div className="flex items-center space-x-2 my-1.5">
              <div className="w-7 h-7 rounded-full bg-[#FF6600] text-black flex items-center justify-center font-black text-xs">
                XMR
              </div>
              <span className="text-sm font-bold text-white">RingCT & Stealth Hop</span>
            </div>
            <p className="text-[11px] text-orange-200/70">Cryptographically severs input & output transaction graphs.</p>
          </div>

          {/* Phase 3: Outbound Public Chain */}
          <div className="p-3 rounded-xl bg-[#151922] border border-[#262D3D] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Leg 2: Outbound</span>
              <span className="text-emerald-400 font-mono">Clean Payout</span>
            </div>
            <div className="flex items-center space-x-2 my-1.5">
              <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-white">
                {toSymbol}
              </div>
              <span className="text-sm font-semibold text-slate-200">Deliver {toSymbol}</span>
            </div>
            <p className="text-[11px] text-slate-500">Delivered directly to user destination without prior trace.</p>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-[#151922] border border-[#262D3D] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-[#FF6600]/20 text-[#FF6600] flex items-center justify-center font-bold text-sm">
              XMR
            </div>
            <div>
              <p className="text-sm font-bold text-white">Single-Hop Direct Privacy Swap</p>
              <p className="text-xs text-slate-400">Directly converting between Monero and {fromSymbol === 'XMR' ? toSymbol : fromSymbol}.</p>
            </div>
          </div>
          <span className="text-xs font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
            0.45% Flat Fee
          </span>
        </div>
      )}

      {/* Zero KYC Footer Info */}
      <div className="mt-3 pt-3 border-t border-[#262D3D]/50 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono">
        <span className="flex items-center space-x-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Zero User Logs • Ephemeral Sessions</span>
        </span>
        <span className="text-slate-500">Auto-purged post settlement</span>
      </div>
    </div>
  );
};
