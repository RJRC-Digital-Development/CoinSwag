import React from 'react';
import { TrendingDown, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  feeBreakdown: {
    serviceFeePercent: number;
    serviceFeeAmountInFromAsset: number;
    networkMinerFeeToAsset: number;
    networkMinerFeeUsd: number;
    totalFeeUsd: number;
    competitorComparison: {
      coinswagFeePercent: number;
      fixedFloatEquivalent: number;
      aggregatorEquivalent: number;
      estimatedSavingsUsd: number;
    };
  };
  fromSymbol: string;
  toSymbol: string;
}

export const FeeComparison: React.FC<Props> = ({ feeBreakdown, fromSymbol, toSymbol }) => {
  const { competitorComparison } = feeBreakdown;

  return (
    <div className="bg-[#121620] border border-[#262D3D] rounded-xl p-4 text-xs font-mono">
      <div className="flex items-center justify-between mb-3">
        <span className="text-slate-400 font-bold uppercase tracking-wider flex items-center space-x-1.5">
          <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
          <span>Competitive Fee Comparison</span>
        </span>
        {competitorComparison.estimatedSavingsUsd > 0 && (
          <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[11px] font-bold">
            Save ~${competitorComparison.estimatedSavingsUsd.toFixed(2)} USD
          </span>
        )}
      </div>

      <div className="space-y-2 border-b border-[#262D3D]/50 pb-3 mb-3">
        <div className="flex items-center justify-between text-slate-300">
          <span className="flex items-center space-x-1.5 text-emerald-400 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>CoinSwag (XMR Privacy Hub)</span>
          </span>
          <span className="text-emerald-400 font-bold">{(competitorComparison.coinswagFeePercent * 100).toFixed(2)}%</span>
        </div>

        <div className="flex items-center justify-between text-slate-500">
          <span>FixedFloat (Standard Float/Fixed)</span>
          <span>{(competitorComparison.fixedFloatEquivalent * 100).toFixed(2)}%</span>
        </div>

        <div className="flex items-center justify-between text-slate-500">
          <span>Privacy Aggregators (Houdini / 2-Hop)</span>
          <span>{(competitorComparison.aggregatorEquivalent * 100).toFixed(2)}%</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-slate-400 text-[11px]">
        <span>Network Miner Fee (Pass-through):</span>
        <span className="text-slate-200">
          {feeBreakdown.networkMinerFeeToAsset} {toSymbol} (~${feeBreakdown.networkMinerFeeUsd.toFixed(2)})
        </span>
      </div>
    </div>
  );
};
