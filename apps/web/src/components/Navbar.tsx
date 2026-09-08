import React from 'react';
import { Shield, Zap, Lock, RefreshCw, Activity } from 'lucide-react';

interface Props {
  onOpenOperatorDrawer?: () => void;
  onOpenLegalModal?: () => void;
}

export const Navbar: React.FC<Props> = ({ onOpenOperatorDrawer, onOpenLegalModal }) => {
  return (
    <nav className="w-full border-b border-slate-700/60 bg-[#0a0d14]/80 backdrop-blur-xl sticky top-0 z-40 px-4 lg:px-8 py-3.5 shadow-lg shadow-black/10">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FF6600] via-orange-400 to-amber-300 p-0.5 shadow-lg shadow-orange-500/30 flex items-center justify-center">
            <div className="w-full h-full bg-[#151922] rounded-[10px] flex items-center justify-center">
              <span className="font-extrabold text-xl text-[#FF6600]">⚡</span>
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-black tracking-[-0.05em] text-white">COIN<span className="text-[#FF6600]">SWAG</span></span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#FF6600]/10 text-[#FF6600] border border-[#FF6600]/30">
                XMR Hub
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono hidden sm:block">Automated Zero-KYC Multi-Chain Swap</p>
          </div>
        </div>

        {/* Security & Status Badges */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <Lock className="w-3.5 h-3.5" />
            <span>Strictly Zero-KYC</span>
          </div>

          {/* Legal / Non-Custodial Disclaimer Button */}
          <button
            onClick={onOpenLegalModal}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[#1A1F2C] hover:bg-slate-800 border border-amber-500/30 text-amber-400 hover:text-amber-300 text-xs font-medium transition cursor-pointer"
            title="View Non-Custodial Protocol Legal Notice & Risk Disclosures"
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Legal & Risk</span>
            <span className="sm:hidden">Legal</span>
          </button>

          {/* Interactive Remote Nodes & Fee Sweeper Button */}
          <button
            onClick={onOpenOperatorDrawer}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[#1C2230] hover:bg-[#262D3D] border border-cyan-500/30 text-cyan-400 hover:text-cyan-300 text-xs font-mono transition group cursor-pointer"
            title="Open Operator Revenue & Remote Node Health Panel"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping group-hover:scale-125 transition" />
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Nodes & Fee Sweeper</span>
            <span className="md:hidden">Operator</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
