import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Clock,
  ShieldCheck,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Lock
} from 'lucide-react';
import { TokenItem, TokenSelectorModal } from './TokenSelectorModal';

interface SplitItem {
  id: string;
  token: TokenItem;
  percentage: number;
  address: string;
  releaseDelaySeconds: number; // 0 to 2,592,000 (30 days)
  generateKeypair?: boolean;
}

interface Props {
  tokens: TokenItem[];
  onSplitOrderCreated: (order: any) => void;
}

const HOLD_TIME_PRESETS = [
  { label: 'Instant (0s)', seconds: 0 },
  { label: '1 Hour', seconds: 3600 },
  { label: '1 Day', seconds: 86400 },
  { label: '3 Days', seconds: 259200 },
  { label: '7 Days (1 Wk)', seconds: 604800 },
  { label: '14 Days (2 Wks)', seconds: 1209600 },
  { label: '30 Days (1 Month Max)', seconds: 2592000 }
];

export const SplitSwapWidget: React.FC<Props> = ({ tokens, onSplitOrderCreated }) => {
  const [fromToken, setFromToken] = useState<TokenItem | null>(null);
  const [amountIn, setAmountIn] = useState<string>('1.0');
  const [refundAddress, setRefundAddress] = useState<string>('');

  const [destinations, setDestinations] = useState<SplitItem[]>([]);

  const [quote, setQuote] = useState<any | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal selector state
  const [modalMode, setModalMode] = useState<'from' | number | null>(null); // 'from' or destination index

  // Default initialization
  useEffect(() => {
    if (tokens.length > 0 && !fromToken) {
      const btc = tokens.find(t => t.symbol === 'BTC') || tokens[0];
      const eth = tokens.find(t => t.symbol === 'ETH') || tokens[1] || tokens[0];
      const sol = tokens.find(t => t.symbol === 'SOL') || tokens[2] || tokens[0];
      setFromToken(btc);

      setDestinations([
        {
          id: '1',
          token: eth,
          percentage: 50,
          address: '',
          releaseDelaySeconds: 0
        },
        {
          id: '2',
          token: sol,
          percentage: 50,
          address: '',
          releaseDelaySeconds: 86400 // 1 day hold
        }
      ]);
    }
  }, [tokens]);

  // Determine active fee tier
  const addressCount = destinations.length;
  let activeFeePercent = 0.05;
  let activeFeeTierLabel = '5% (Up to 3 Addresses)';
  if (addressCount <= 3) {
    activeFeePercent = 0.05;
    activeFeeTierLabel = '5% (Up to 3 Addresses)';
  } else if (addressCount <= 10) {
    activeFeePercent = 0.10;
    activeFeeTierLabel = '10% (4 to 10 Addresses)';
  } else if (addressCount <= 20) {
    activeFeePercent = 0.15;
    activeFeeTierLabel = '15% (11 to 20 Addresses)';
  } else {
    activeFeePercent = 0.30;
    activeFeeTierLabel = '30% (21 to 50 Addresses)';
  }

  // Fetch live split quote from API
  useEffect(() => {
    if (!fromToken || destinations.length === 0 || !amountIn) return;
    const num = parseFloat(amountIn);
    if (isNaN(num) || num <= 0) return;

    const timer = setTimeout(async () => {
      setIsLoadingQuote(true);
      setQuoteError(null);

      try {
        const payload = {
          fromAssetId: fromToken.id,
          amountIn: num,
          autoGenerateKeys: false,
          destinations: destinations.map(d => ({
            assetId: d.token.id,
            address: d.address,
            percentage: d.percentage,
            releaseDelaySeconds: d.releaseDelaySeconds,
            generateKeypair: false
          }))
        };

        const res = await fetch('/api/v1/splits/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.error) {
          setQuoteError(data.error);
          setQuote(null);
        } else {
          setQuote(data.quote);
        }
      } catch (err) {
        setQuoteError('Failed to fetch split quote from engine');
      } finally {
        setIsLoadingQuote(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [fromToken, amountIn, destinations]);

  const handleAddDestination = () => {
    const defaultToken = tokens.find(t => t.symbol === 'XMR') || tokens[0];
    const newDest: SplitItem = {
      id: Math.random().toString(36).substring(2, 7),
      token: defaultToken,
      percentage: 10,
      address: '',
      releaseDelaySeconds: 0
    };
    setDestinations(prev => [...prev, newDest]);
  };

  const handleRemoveDestination = (idx: number) => {
    if (destinations.length <= 1) return;
    setDestinations(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSplitEvenly = () => {
    const count = destinations.length;
    if (count === 0) return;
    const equalShare = Number((100 / count).toFixed(1));
    setDestinations(prev =>
      prev.map((d, i) => ({
        ...d,
        percentage: i === count - 1 ? Number((100 - equalShare * (count - 1)).toFixed(1)) : equalShare
      }))
    );
  };

  const handleCreateOrder = async () => {
    if (!quote) return;
    if (!refundAddress.trim()) {
      setQuoteError('Please provide an emergency refund address');
      return;
    }

    for (let i = 0; i < destinations.length; i++) {
      if (!destinations[i].address.trim()) {
        setQuoteError(`Please provide a payout destination address for destination #${i + 1}`);
        return;
      }
    }

    setIsSubmitting(true);
    setQuoteError(null);

    try {
      const res = await fetch('/api/v1/splits/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: quote.id,
          refundAddress: refundAddress.trim()
        })
      });

      const data = await res.json();
      if (data.error) {
        setQuoteError(data.error);
      } else {
        onSplitOrderCreated(data.order);
      }
    } catch (err: any) {
      setQuoteError(err.message || 'Failed to initialize split order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-7 shadow-2xl backdrop-blur-xl relative overflow-hidden space-y-6">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#FF6600]/10 via-emerald-500/5 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      {/* Top Header & Dynamic Fee Tier Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FF6600]/20 flex items-center justify-center text-[#FF6600]">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              Coin Address Splitting & Time-Lock Vault
            </h2>
            <p className="text-xs text-slate-400">
              Disperse single deposit across multiple addresses & coins, held up to 1 month.
            </p>
          </div>
        </div>

        {/* Dynamic Fee Tier Pill */}
        <div className="flex items-center space-x-2 self-start sm:self-auto bg-slate-950/80 border border-amber-500/30 px-3 py-1.5 rounded-xl">
          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Fee Tier:</span>
          <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            {activeFeeTierLabel}
          </span>
        </div>
      </div>

      {/* Deposit Input (You Send) */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-2">
        <div className="flex justify-between items-center text-xs font-mono text-slate-400">
          <span>SOURCE DEPOSIT (SINGLE INPUT)</span>
          <span>Filtered through Monero Privacy Hub</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <input
            type="number"
            step="any"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            className="bg-transparent text-2xl sm:text-3xl font-mono font-bold text-white focus:outline-none w-full"
            placeholder="0.0"
          />

          <button
            type="button"
            onClick={() => setModalMode('from')}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-2 rounded-xl transition border border-slate-700/60 shrink-0"
          >
            {fromToken && (
              <span className="text-lg">
                {fromToken.symbol === 'BTC' ? '₿' : fromToken.symbol === 'ETH' ? 'Ξ' : fromToken.symbol === 'XMR' ? 'ɱ' : '🪙'}
              </span>
            )}
            <span className="font-bold text-sm">{fromToken?.symbol}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>


      {/* Destinations Section Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span>Split Payout Destinations ({destinations.length})</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleSplitEvenly}
              className="text-[11px] font-mono text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg transition"
            >
              Split Evenly
            </button>
            <button
              type="button"
              onClick={handleAddDestination}
              className="text-[11px] font-mono text-[#FF6600] hover:text-orange-300 bg-[#FF6600]/10 border border-[#FF6600]/20 px-2.5 py-1 rounded-lg transition flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add Address
            </button>
          </div>
        </div>

        {/* Destination Cards */}
        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
          {destinations.map((dest, idx) => {
            const calculatedDest = quote?.destinations?.[idx];
            return (
              <div
                key={dest.id}
                className="bg-slate-950/70 border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-3.5 space-y-3 transition"
              >
                {/* Row 1: Token, Percentage, Amount, Delete */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setModalMode(idx)}
                      className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold transition border border-slate-700/60"
                    >
                      <span>{dest.token.symbol}</span>
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>

                    <div className="flex items-center space-x-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={dest.percentage}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setDestinations(prev =>
                            prev.map((item, i) => (i === idx ? { ...item, percentage: val } : item))
                          );
                        }}
                        className="w-12 bg-transparent text-xs font-mono font-bold text-white text-right focus:outline-none"
                      />
                      <span className="text-xs font-mono text-slate-400">%</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-emerald-400">
                        {calculatedDest
                          ? `~${calculatedDest.estimatedAmountOut} ${dest.token.symbol}`
                          : 'Calculating...'}
                      </div>
                    </div>

                    {destinations.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDestination(idx)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Row 2: Address Field (or Auto-Generated Badge) */}
                <div>
                  <input
                      type="text"
                      value={dest.address}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDestinations(prev =>
                          prev.map((item, i) => (i === idx ? { ...item, address: val } : item))
                        );
                      }}
                      placeholder={`Enter ${dest.token.name} destination address...`}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-[#FF6600]"
                    />
                </div>

                {/* Row 3: Time-Release Hold Duration Selector */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-900">
                  <div className="flex items-center space-x-1.5 text-slate-400 font-mono text-[11px]">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>Time-Lock Hold:</span>
                  </div>

                  <select
                    value={dest.releaseDelaySeconds}
                    onChange={(e) => {
                      const sec = parseInt(e.target.value, 10);
                      setDestinations(prev =>
                        prev.map((item, i) => (i === idx ? { ...item, releaseDelaySeconds: sec } : item))
                      );
                    }}
                    className="bg-slate-900 border border-slate-800 text-xs font-mono text-amber-300 rounded-lg px-2 py-1 focus:outline-none focus:border-amber-500"
                  >
                    {HOLD_TIME_PRESETS.map(preset => (
                      <option key={preset.seconds} value={preset.seconds}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Refund Address */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono text-slate-400 flex items-center justify-between">
          <span>EMERGENCY REFUND ADDRESS ({fromToken?.symbol})</span>
          <span className="text-[10px] text-slate-500">In case deposit errors</span>
        </label>
        <input
          type="text"
          value={refundAddress}
          onChange={(e) => setRefundAddress(e.target.value)}
          placeholder={`Your ${fromToken?.symbol} address for safety refund...`}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-[#FF6600]"
        />
      </div>

      {/* Quote Breakdown Summary */}
      {quote && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 text-xs space-y-1.5 font-mono">
          <div className="flex justify-between text-slate-400">
            <span>Platform Service Fee:</span>
            <span className="text-amber-400 font-bold">
              {(quote.feeBreakdown.tier.feePercent * 100).toFixed(1)}% (${quote.feeBreakdown.serviceFeeUsd} USD)
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Network Miner Fees:</span>
            <span className="text-slate-300">${quote.feeBreakdown.networkMinerFeesTotalUsd} USD</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Max Time-Lock Hold:</span>
            <span className="text-amber-300">
              {quote.maxHoldDelaySeconds === 0
                ? 'Immediate Dispersal (0s)'
                : `${(quote.maxHoldDelaySeconds / 86400).toFixed(1)} Days Vault Hold`}
            </span>
          </div>
        </div>
      )}

      {/* Quote Error */}
      {quoteError && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-center space-x-2 text-rose-400 text-xs font-mono">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{quoteError}</span>
        </div>
      )}

      {/* Submit Action Button */}
      <button
        type="button"
        disabled={isSubmitting || isLoadingQuote || !quote}
        onClick={handleCreateOrder}
        className="w-full bg-gradient-to-r from-[#FF6600] via-orange-500 to-amber-500 hover:opacity-95 text-slate-950 font-bold py-3.5 px-6 rounded-2xl text-sm sm:text-base transition duration-200 shadow-lg shadow-[#FF6600]/20 flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
      >
        <Lock className="w-4 h-4" />
        <span>
          {isSubmitting
            ? 'Creating Secure Split Vault...'
            : `Initiate Address Split & Vault Lock (${(activeFeePercent * 100).toFixed(0)}% Fee)`}
        </span>
      </button>

      {/* Non-Custodial Legal Notice */}
      <p className="text-[11px] text-slate-500 text-center font-sans leading-relaxed pt-1">
        By proceeding, you acknowledge CoinSwag is an autonomous non-custodial routing protocol. Generated keys are ephemeral and stored only in your downloaded vault.
      </p>

      {/* Token Selector Modal */}
      {modalMode !== null && (
        <TokenSelectorModal
          isOpen={true}
          tokens={tokens}
          selectedToken={modalMode === 'from' ? fromToken : destinations[modalMode]?.token}
          onSelect={(token) => {
            if (modalMode === 'from') {
              setFromToken(token);
            } else {
              setDestinations(prev =>
                prev.map((d, i) => (i === modalMode ? { ...d, token } : d))
              );
            }
            setModalMode(null);
          }}
          onClose={() => setModalMode(null)}
        />
      )}
    </div>
  );
};
