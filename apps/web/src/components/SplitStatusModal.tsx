import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  ShieldCheck,
  Lock,
  Clock,
  ExternalLink,
  Download,
  Key,
  Layers,
  ArrowRight,
  Play
} from 'lucide-react';

interface Props {
  order: any;
  onClose: () => void;
  onAdvanceStep?: (orderId: string) => void;
}

export const SplitStatusModal: React.FC<Props> = ({ order, onClose, onAdvanceStep }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [isDownloadingKeys, setIsDownloadingKeys] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Update countdown clock every second
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDownloadKeys = async () => {
    setIsDownloadingKeys(true);
    setDownloadError(null);
    try {
      const res = await fetch(`/api/v1/splits/${order.id}/keys?secretToken=${order.secretToken}`);
      if (!res.ok) {
        throw new Error('Failed to retrieve private key vault');
      }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coinswag-keyvault-${order.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setDownloadError(err.message || 'Key download failed');
    } finally {
      setIsDownloadingKeys(false);
    }
  };

  const formatCountdown = (targetTimestamp: number) => {
    const diff = targetTimestamp - now;
    if (diff <= 0) return 'Matured (Ready to Release)';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
  };

  const handleReleaseEarly = async (destinationId: string) => {
    try {
      await fetch(`/api/v1/splits/${order.id}/release-early`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationId,
          secretToken: order.secretToken
        })
      });
      if (onAdvanceStep) {
        onAdvanceStep(order.id);
      }
    } catch (err) {
      console.error('Error releasing early:', err);
    }
  };

  const isDepositPhase = order.status === 'AWAITING_DEPOSIT' || order.status === 'DEPOSIT_DETECTED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative my-auto">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FF6600]/20 flex items-center justify-center text-[#FF6600]">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>Split Vault Order</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {order.id}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {order.statusMessage || order.status}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Key Vault Download (if Keygen mode is active) */}
          {order.autoGenerateKeys && (
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Generated Key Vault Ready</div>
                  <div className="text-[11px] text-slate-400">
                    Download and save your private keys and seed phrases offline before closing.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadKeys}
                disabled={isDownloadingKeys}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5 self-start sm:self-auto shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isDownloadingKeys ? 'Exporting Vault...' : 'Download Keys (.json)'}</span>
              </button>
            </div>
          )}

          {downloadError && (
            <div className="text-xs font-mono text-rose-400 bg-rose-500/10 p-2 rounded-lg">
              {downloadError}
            </div>
          )}

          {/* Deposit Address Box (If waiting for deposit) */}
          {isDepositPhase && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>SEND SINGLE DEPOSIT</span>
                <span className="text-amber-400 font-bold">
                  {order.quote.amountIn} {order.quote.fromAsset.symbol}
                </span>
              </div>

              <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-3 font-mono text-xs text-white">
                <span className="truncate pr-2">{order.depositAddress}</span>
                <button
                  onClick={() => handleCopy(order.depositAddress, 'deposit')}
                  className="p-1.5 text-slate-400 hover:text-white transition shrink-0"
                >
                  {copiedField === 'deposit' ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="text-[11px] text-slate-500 font-mono flex items-center justify-between">
                <span>Confirmations: {order.depositConfirmations} / {order.requiredConfirmations}</span>
                <span>Filtered via Monero Privacy Hub</span>
              </div>
            </div>
          )}

          {/* Monero Hub & Vault Stage Status */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
            <div
              className={`p-2.5 rounded-xl border ${
                order.status !== 'AWAITING_DEPOSIT'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              <div className="font-bold">1. Ingest</div>
              <div className="text-[10px]">Deposit Confirmed</div>
            </div>

            <div
              className={`p-2.5 rounded-xl border ${
                order.status === 'CONVERTING_IN_PRIVACY_HUB' ||
                order.status === 'TIME_LOCK_HOLDING' ||
                order.status === 'PARTIALLY_RELEASED' ||
                order.status === 'COMPLETED'
                  ? 'bg-[#FF6600]/10 border-[#FF6600]/30 text-[#FF6600]'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              <div className="font-bold">2. Anonymize</div>
              <div className="text-[10px]">Monero RingCT Hub</div>
            </div>

            <div
              className={`p-2.5 rounded-xl border ${
                order.status === 'TIME_LOCK_HOLDING' ||
                order.status === 'PARTIALLY_RELEASED' ||
                order.status === 'COMPLETED'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              <div className="font-bold">3. Vault Lock</div>
              <div className="text-[10px]">Time-Release Hold</div>
            </div>
          </div>

          {/* Split Destinations Tranches */}
          <div className="space-y-2.5">
            <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
              Destination Tranches ({order.destinations.length})
            </div>

            <div className="space-y-2">
              {order.destinations.map((dest: any, idx: number) => {
                const isReleased = dest.status === 'RELEASED';
                const isLocked = dest.status === 'HOLD_TIME_LOCKED';

                return (
                  <div
                    key={dest.id}
                    className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                          {dest.assetId}
                        </span>
                        <span className="text-slate-400">{dest.percentage}% share</span>
                        <span className="text-emerald-400 font-bold">
                          ~{dest.estimatedAmountOut} {dest.assetId}
                        </span>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {isReleased ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            <Check className="w-3 h-3" />
                            <span>Released</span>
                          </span>
                        ) : isLocked ? (
                          <span className="inline-flex items-center space-x-1 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            <Clock className="w-3 h-3" />
                            <span>Locked in Vault</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">{dest.status}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 truncate">
                      <span className="truncate pr-2">{dest.address}</span>
                      <button
                        onClick={() => handleCopy(dest.address, `dest_${idx}`)}
                        className="p-1 text-slate-500 hover:text-white shrink-0"
                      >
                        {copiedField === `dest_${idx}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Timeline & Actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[11px]">
                      {isReleased ? (
                        <div className="text-slate-400 flex items-center space-x-1">
                          <span>Tx Hash:</span>
                          <span className="text-emerald-400 font-mono truncate max-w-[200px]">
                            {dest.payoutTxHash}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1.5 text-amber-300">
                          <Clock className="w-3 h-3" />
                          <span>Release in: {formatCountdown(dest.releaseAt)}</span>
                        </div>
                      )}

                      {/* Early Release Button */}
                      {!isReleased && order.status !== 'AWAITING_DEPOSIT' && (
                        <button
                          type="button"
                          onClick={() => handleReleaseEarly(dest.id)}
                          className="text-[10px] text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded transition"
                        >
                          Release Early Now
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Test / Sandbox Advance Button */}
          {onAdvanceStep && order.status !== 'COMPLETED' && (
            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => onAdvanceStep(order.id)}
                className="text-xs font-mono text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl transition flex items-center space-x-1.5"
              >
                <Play className="w-3 h-3 text-[#FF6600]" />
                <span>Simulate Next Step</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
