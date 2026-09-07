import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Copy, 
  Check, 
  Clock, 
  Shield, 
  ExternalLink, 
  Lock, 
  Play, 
  Sparkles, 
  X,
  AlertTriangle,
  QrCode
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  order: any;
  onClose: () => void;
  onAdvanceStep: (orderId: string) => Promise<void>;
  onAutoComplete: (orderId: string) => Promise<void>;
}


export const SwapStatusModal: React.FC<Props> = ({
  order,
  onClose,
  onAdvanceStep,
  onAutoComplete
}) => {
  const [copied, setCopied] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(order.depositAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stages = [
    { key: 'AWAITING_DEPOSIT', label: 'Deposit Awaiting' },
    { key: 'DEPOSIT_DETECTED', label: 'Mempool Detected' },
    { key: 'DEPOSIT_CONFIRMED', label: 'Confirmed on Chain' },
    { key: 'HOP1_CONVERTING_TO_XMR', label: 'Hop 1: Swap -> Monero' },
    { key: 'XMR_RECEIVED_IN_HUB', label: 'Monero Hub Shield' },
    { key: 'HOP2_CONVERTING_TO_TARGET', label: 'Hop 2: Monero -> Target' },
    { key: 'PAYOUT_BROADCASTING', label: 'Broadcasting Payout' },
    { key: 'COMPLETED', label: 'Swap Completed' }
  ];

  const getStageIndex = (status: string) => {
    if (status === 'XMR_ANONYMIZING') return 4;
    const idx = stages.findIndex(s => s.key === status);
    return idx === -1 ? 0 : idx;
  };

  const currentIdx = getStageIndex(order.status);
  const isComplete = order.status === 'COMPLETED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#151922] border border-[#262D3D] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#262D3D] flex items-center justify-between bg-[#0E131E]">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold text-white">Swap Session</span>
              <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                {order.id}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Swapping {order.quote.amountIn} {order.quote.fromAsset.symbol} → {order.quote.estimatedAmountOut} {order.quote.toAsset.symbol}
            </p>
          </div>

          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Status Tracker Bar */}
          <div className="bg-[#0E131E] border border-[#262D3D] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                Pipeline Progression
              </span>
              <span className={`text-xs font-mono px-2 py-0.5 rounded-full font-bold ${
                isComplete 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-orange-500/20 text-orange-400 border border-orange-500/30 animate-pulse'
              }`}>
                {order.status.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Step Progress Line */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 pt-1">
              {stages.map((stage, idx) => {
                const isPassed = idx < currentIdx;
                const isCurrent = idx === currentIdx;
                const isHub = stage.key.includes('XMR');

                return (
                  <div key={stage.key} className="flex flex-col items-center text-center">
                    <div className={`w-full h-1.5 rounded-full mb-1.5 transition-all ${
                      isPassed 
                        ? 'bg-emerald-500' 
                        : isCurrent 
                          ? (isHub ? 'bg-[#FF6600] animate-pulse' : 'bg-amber-400 animate-pulse') 
                          : 'bg-slate-800'
                    }`} />
                    <span className={`text-[10px] font-mono leading-tight ${
                      isCurrent 
                        ? (isHub ? 'text-[#FF6600] font-bold' : 'text-amber-400 font-bold') 
                        : isPassed 
                          ? 'text-emerald-400' 
                          : 'text-slate-600'
                    }`}>
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-slate-300 font-mono mt-4 pt-3 border-t border-[#262D3D]/50 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping" />
              <span>{order.statusMessage}</span>
            </p>
          </div>

          {/* Deposit Address Box (If awaiting deposit or in progress) */}
          {!isComplete && (
            <div className="bg-[#121620] border border-[#262D3D] rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center space-x-1.5 text-amber-400 font-bold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Send Exact Amount To Single-Use Address</span>
                </span>
                <span>Confirmations: {order.depositConfirmations}/{order.requiredConfirmations}</span>
              </div>

              <div className="p-4 bg-[#0B0E14] border border-[#262D3D] rounded-xl flex flex-col sm:flex-row items-center gap-4">
                {/* SVG QR Code */}
                <div className="bg-white p-2.5 rounded-xl shadow-md flex flex-col items-center shrink-0">
                  <QRCodeSVG
                    value={order.depositAddress}
                    size={110}
                    level="M"
                    includeMargin={false}
                  />
                  <div className="flex items-center space-x-1 mt-1 text-[9px] font-mono font-bold text-slate-800 uppercase tracking-wider">
                    <QrCode className="w-2.5 h-2.5" />
                    <span>Scan Wallet</span>
                  </div>
                </div>

                {/* Deposit Address Details */}
                <div className="flex-1 min-w-0 space-y-2 w-full text-left">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 block uppercase">
                      {order.quote.fromAsset.name} Deposit Address
                    </span>
                    <span className="font-mono text-xs sm:text-sm text-slate-200 break-all select-all font-bold block mt-0.5">
                      {order.depositAddress}
                    </span>
                    {order.depositExtraId && (
                      <span className="text-xs text-amber-400 block mt-1 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        Destination Tag / Memo: <strong>{order.depositExtraId}</strong>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      onClick={copyAddress}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono flex items-center space-x-1.5 transition"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied to Clipboard' : 'Copy Address'}</span>
                    </button>
                    {order.anonymizationDelaySeconds > 0 && (
                      <span className="text-[11px] font-mono text-[#FF6600] bg-[#FF6600]/10 px-2 py-1 rounded border border-[#FF6600]/30 flex items-center space-x-1">
                        <Lock className="w-3 h-3" />
                        <span>+{Math.round(order.anonymizationDelaySeconds / 60)}m Delay Active</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-[#0B0E14] border border-[#262D3D]">
                  <span className="text-slate-500 text-[10px] uppercase block">Deposit Amount</span>
                  <span className="text-white font-bold text-sm">
                    {order.quote.amountIn} {order.quote.fromAsset.symbol}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#0B0E14] border border-[#262D3D]">
                  <span className="text-slate-500 text-[10px] uppercase block">You Will Receive</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    {order.actualPayoutAmount || order.quote.estimatedAmountOut} {order.quote.toAsset.symbol}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Completion Celebration & Tx Proof */}
          {isComplete && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-lg font-bold text-white">Swap Fully Settled!</h4>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                Funds have been successfully delivered to your destination wallet without any on-chain linkability.
              </p>

              {order.payoutTxHash && (
                <div className="p-3 bg-[#0B0E14] border border-emerald-500/30 rounded-xl max-w-lg mx-auto text-left font-mono">
                  <span className="text-[10px] uppercase text-slate-500 block">Outbound Transaction Hash</span>
                  <span className="text-xs text-emerald-400 break-all select-all font-bold block mt-0.5">
                    {order.payoutTxHash}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Privacy & Zero-KYC Details */}
          <div className="p-3.5 bg-[#0E131E] border border-[#262D3D] rounded-xl text-xs font-mono space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center space-x-1.5">
                <Shield className="w-3.5 h-3.5 text-[#FF6600]" />
                <span>Monero Hub Routing Protocol</span>
              </span>
              <span className="text-[#FF6600] font-bold">RingCT & Stealth Hop Verified</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Destination Address:</span>
              <span className="text-slate-300 truncate max-w-[200px] sm:max-w-xs">{order.destinationAddress}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Emergency Refund Address:</span>
              <span className="text-slate-300 truncate max-w-[200px] sm:max-w-xs">{order.refundAddress}</span>
            </div>
          </div>

          {/* Interactive Simulation / Test Control Panel */}
          <div className="p-4 bg-gradient-to-r from-slate-900 to-[#151922] border border-indigo-500/30 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-indigo-400 font-bold flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sandbox / Test Simulation Controls</span>
              </span>
              <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">
                Developer Live Test
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Test every step of the blockchain deposit, Monero hub privacy shuffle, and payout broadcast right now without real funds:
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                disabled={isComplete}
                onClick={() => onAdvanceStep(order.id)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-mono font-medium flex items-center space-x-1.5 transition"
              >
                <Play className="w-3 h-3" />
                <span>Simulate Next Step ({order.status})</span>
              </button>

              <button
                disabled={isComplete || isSimulating}
                onClick={async () => {
                  setIsSimulating(true);
                  await onAutoComplete(order.id);
                  setIsSimulating(false);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg text-xs font-mono font-medium flex items-center space-x-1.5 transition border border-slate-700"
              >
                <span>Auto-Execute Full Swap Pipeline</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
