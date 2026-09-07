import React, { useState } from 'react';
import { Search, X, ShieldCheck } from 'lucide-react';

export interface TokenItem {
  id: string;
  symbol: string;
  name: string;
  chain: string;
  standard: string;
  priceUsd: number;
  isPrivacyHub: boolean;
  icon: string;
  minDeposit: number;
  maxDeposit: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: TokenItem) => void;
  tokens: TokenItem[];
  title: string;
}

export const TokenSelectorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSelect,
  tokens,
  title
}) => {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filtered = tokens.filter(t => 
    t.symbol.toLowerCase().includes(search.toLowerCase()) ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.chain.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#151922] border border-[#262D3D] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-[#262D3D] flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center space-x-2">
            <span>{title}</span>
          </h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-[#262D3D] bg-[#0E131E]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by coin name, symbol, or network..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full bg-[#151922] border border-[#262D3D] rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#FF6600] transition"
            />
          </div>
        </div>

        {/* Token List */}
        <div className="overflow-y-auto flex-1 p-2 divide-y divide-[#262D3D]/40">
          {filtered.map((token) => (
            <button
              key={token.id}
              onClick={() => {
                onSelect(token);
                onClose();
              }}
              className="w-full p-3 flex items-center justify-between rounded-xl hover:bg-slate-800/60 transition group text-left"
            >
              <div className="flex items-center space-x-3">
                <div className="relative w-9 h-9 rounded-full bg-slate-800 p-1.5 flex items-center justify-center border border-slate-700">
                  <img
                    src={token.icon}
                    alt={token.symbol}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  {token.isPrivacyHub && (
                    <span className="absolute -bottom-1 -right-1 bg-[#FF6600] text-black rounded-full p-0.5" title="Monero Privacy Hub">
                      <ShieldCheck className="w-3 h-3 text-white" />
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-white group-hover:text-[#FF6600] transition">
                      {token.symbol}
                    </span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {token.chain}
                    </span>
                    {token.chain === 'lightning' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">
                        ⚡ 0-CONF
                      </span>
                    )}
                    {token.isPrivacyHub && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FF6600]/20 text-[#FF6600] border border-[#FF6600]/40">
                        HUB
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-sans">{token.name}</p>
                </div>
              </div>

              <div className="text-right font-mono">
                <span className="text-sm font-medium text-slate-200">
                  ${token.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <p className="text-[11px] text-slate-500">Min: {token.minDeposit} {token.symbol}</p>
              </div>
            </button>
          ))}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">
              No matching cryptocurrency found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
