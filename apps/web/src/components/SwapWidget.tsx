import React, { useState, useEffect } from 'react';
import { 
  ArrowUpDown, 
  ChevronDown, 
  ShieldCheck, 
  Lock, 
  RefreshCw, 
  Zap, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { TokenItem, TokenSelectorModal } from './TokenSelectorModal';
import { FeeComparison } from './FeeComparison';
import { PrivacyDiagram } from './PrivacyDiagram';

interface Props {
  tokens: TokenItem[];
  onOrderCreated: (order: any) => void;
}

export const SwapWidget: React.FC<Props> = ({ tokens, onOrderCreated }) => {
  const [fromToken, setFromToken] = useState<TokenItem | null>(null);
  const [toToken, setToToken] = useState<TokenItem | null>(null);
  const [amountIn, setAmountIn] = useState<string>('0.1');
  const [rateType, setRateType] = useState<'FLOAT' | 'FIXED'>('FLOAT');
  
  const [destinationAddress, setDestinationAddress] = useState<string>('');
  const [refundAddress, setRefundAddress] = useState<string>('');
  const [anonymizationDelay, setAnonymizationDelay] = useState<number>(0);

  const [quote, setQuote] = useState<any | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [modalType, setModalType] = useState<'from' | 'to' | null>(null);

  // Set default tokens on load (e.g. BTC -> SOL)
  useEffect(() => {
    if (tokens.length > 0 && !fromToken && !toToken) {
      const btc = tokens.find(t => t.symbol === 'BTC') || tokens[0];
      const sol = tokens.find(t => t.symbol === 'SOL') || tokens[1];
      setFromToken(btc);
      setToToken(sol);
    }
  }, [tokens]);

  // Fetch live quote when amount or tokens change
  useEffect(() => {
    if (!fromToken || !toToken || !amountIn) return;
    const num = parseFloat(amountIn);
    if (isNaN(num) || num <= 0) return;

    const timer = setTimeout(async () => {
      setIsLoadingQuote(true);
      setQuoteError(null);
      try {
        const res = await fetch('/api/v1/quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromAssetId: fromToken.id,
            toAssetId: toToken.id,
            amountIn: num,
            rateType
          })
        });
        const data = await res.json();
        if (data.error) {
          setQuoteError(data.error);
          setQuote(null);
        } else {
          setQuote(data.quote);
        }
      } catch (err: any) {
        setQuoteError('Failed to fetch real-time quote');
      } finally {
        setIsLoadingQuote(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [fromToken, toToken, amountIn, rateType]);

  const handleSwapDirection = () => {
    if (!fromToken || !toToken) return;
    const prevFrom = fromToken;
    setFromToken(toToken);
    setToToken(prevFrom);
  };

  const handleInitiateSwap = async () => {
    if (!quote) return;
    if (!destinationAddress.trim()) {
      setQuoteError('Please provide your payout destination address');
      return;
    }
    if (!refundAddress.trim()) {
      setQuoteError('Please provide an emergency refund address');
      return;
    }

    setIsSubmitting(true);
    setQuoteError(null);
    try {
      const res = await fetch('/api/v1/swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: quote.id,
          destinationAddress: destinationAddress.trim(),
          refundAddress: refundAddress.trim(),
          anonymizationDelaySeconds: anonymizationDelay
        })
      });
      const data = await res.json();
      if (data.error) {
        setQuoteError(data.error);
      } else {
        onOrderCreated(data.order);
      }
    } catch (err: any) {
      setQuoteError('Failed to create swap session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDoubleHop = fromToken?.symbol !== 'XMR' && toToken?.symbol !== 'XMR';

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {/* Swap Card Container */}
      <div className="bg-[#151922] border border-[#262D3D] rounded-3xl p-5 sm:p-7 shadow-2xl shadow-black/50 backdrop-blur-xl relative">
        {/* Card Header & Mode Switch */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-black text-white tracking-tight">Instant Swap</span>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-[#FF6600]/15 text-[#FF6600] border border-[#FF6600]/30">
              Monero Route
            </span>
          </div>

          {/* Float vs Fixed Toggle */}
          <div className="flex items-center p-0.5 bg-[#0E131E] border border-[#262D3D] rounded-xl text-xs font-mono">
            <button
              onClick={() => setRateType('FLOAT')}
              className={`px-3 py-1 rounded-lg transition ${
                rateType === 'FLOAT'
                  ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Float Rate (0.5%)
            </button>
            <button
              onClick={() => setRateType('FIXED')}
              className={`px-3 py-1 rounded-lg transition ${
                rateType === 'FIXED'
                  ? 'bg-[#FF6600]/20 text-[#FF6600] font-bold border border-[#FF6600]/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Fixed Rate
            </button>
          </div>
        </div>

        {/* Input: You Send */}
        <div className="space-y-1.5 mb-2">
          <div className="flex justify-between text-xs font-mono text-slate-400 px-1">
            <span>You Send</span>
            {fromToken && (
              <span>Min: {fromToken.minDeposit} {fromToken.symbol}</span>
            )}
          </div>
          <div className="p-3.5 bg-[#0B0E14] border border-[#262D3D] rounded-2xl flex items-center justify-between focus-within:border-[#FF6600] transition">
            <input
              type="number"
              step="any"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              placeholder="0.0"
              className="w-2/3 bg-transparent text-2xl font-bold font-mono text-white focus:outline-none placeholder-slate-600"
            />
            {fromToken && (
              <button
                onClick={() => setModalType('from')}
                className="flex items-center space-x-2 bg-[#1C2230] hover:bg-[#252E42] border border-[#262D3D] px-3 py-1.5 rounded-xl transition shrink-0"
              >
                <img src={fromToken.icon} alt={fromToken.symbol} className="w-5 h-5 object-contain" />
                <span className="font-bold text-sm text-white">{fromToken.symbol}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>
        </div>

        {/* Swap Switcher Button */}
        <div className="relative my-2 flex justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#262D3D]" />
          </div>
          <button
            onClick={handleSwapDirection}
            className="relative z-10 p-2.5 rounded-2xl bg-[#151922] border border-[#262D3D] text-slate-300 hover:text-[#FF6600] hover:border-[#FF6600]/50 hover:scale-105 transition shadow-lg"
            title="Switch Direction"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>

        {/* Output: You Receive */}
        <div className="space-y-1.5 mb-5">
          <div className="flex justify-between text-xs font-mono text-slate-400 px-1">
            <span>You Receive (Estimated)</span>
            {quote && (
              <span className="text-emerald-400 font-bold">1 {fromToken?.symbol} ≈ {quote.rate} {toToken?.symbol}</span>
            )}
          </div>
          <div className="p-3.5 bg-[#0B0E14] border border-[#262D3D] rounded-2xl flex items-center justify-between">
            <div className="font-bold font-mono text-2xl text-white overflow-hidden text-ellipsis mr-2">
              {isLoadingQuote ? (
                <span className="text-slate-600 animate-pulse text-lg">Calculating best route...</span>
              ) : quote ? (
                quote.estimatedAmountOut
              ) : (
                '0.00'
              )}
            </div>
            {toToken && (
              <button
                onClick={() => setModalType('to')}
                className="flex items-center space-x-2 bg-[#1C2230] hover:bg-[#252E42] border border-[#262D3D] px-3 py-1.5 rounded-xl transition shrink-0"
              >
                <img src={toToken.icon} alt={toToken.symbol} className="w-5 h-5 object-contain" />
                <span className="font-bold text-sm text-white">{toToken.symbol}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>
        </div>

        {/* Address Inputs */}
        <div className="space-y-3 mb-5">
          {/* Destination Address */}
          <div>
            <label className="text-xs font-mono text-slate-300 block mb-1">
              {toToken?.chain === 'lightning' 
                ? 'Your Bitcoin Lightning Destination (Invoice or Address):' 
                : `Your ${toToken?.name || 'Destination'} Payout Address:`}
            </label>
            <input
              type="text"
              placeholder={toToken?.chain === 'lightning'
                ? 'Enter BOLT11 invoice (lnbc...), LNURL, or name@domain.com'
                : `Enter recipient ${toToken?.symbol || ''} address`}
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
              className="w-full bg-[#0B0E14] border border-[#262D3D] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-[#FF6600] transition"
            />
          </div>

          {/* Refund Address */}
          <div>
            <label className="text-xs font-mono text-slate-300 block mb-1">
              {fromToken?.chain === 'lightning'
                ? 'Emergency Lightning Refund Invoice / Address:'
                : `Emergency ${fromToken?.symbol || 'Source'} Refund Address:`}
            </label>
            <input
              type="text"
              placeholder={fromToken?.chain === 'lightning'
                ? 'Enter refund BOLT11 invoice or Lightning address (name@domain)'
                : `Enter refund ${fromToken?.symbol || ''} address in case of failure`}
              value={refundAddress}
              onChange={(e) => setRefundAddress(e.target.value)}
              className="w-full bg-[#0B0E14] border border-[#262D3D] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-[#FF6600] transition"
            />
          </div>

          {/* Optional settlement scheduling */}
          <div className="pt-2 pb-1 border-t border-[#262D3D]/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-[#FF6600]" />
                <span className="text-xs font-mono font-bold text-slate-200">
                  Settlement Schedule
                </span>
              </div>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                anonymizationDelay === 0
                  ? 'bg-slate-800 text-slate-400'
                  : 'bg-[#FF6600]/20 text-[#FF6600] border border-[#FF6600]/30 animate-pulse'
              }`}>
                {anonymizationDelay === 0 ? 'Immediate' : `${Math.round(anonymizationDelay / 60)} min scheduled release`}
              </span>
            </div>

            {/* Delay Slider */}
            <input
              type="range"
              min="0"
              max="3600"
              step="300"
              value={anonymizationDelay}
              onChange={(e) => setAnonymizationDelay(parseInt(e.target.value, 10))}
              className="w-full accent-[#FF6600] h-1.5 bg-[#0B0E14] rounded-lg appearance-none cursor-pointer"
            />

            {/* Delay Presets */}
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mt-1 px-0.5">
              <button
                type="button"
                onClick={() => setAnonymizationDelay(0)}
                className={`hover:text-white transition ${anonymizationDelay === 0 ? 'text-[#FF6600] font-bold' : ''}`}
              >
                Instant
              </button>
              <button
                type="button"
                onClick={() => setAnonymizationDelay(900)}
                className={`hover:text-white transition ${anonymizationDelay === 900 ? 'text-[#FF6600] font-bold' : ''}`}
              >
                15m
              </button>
              <button
                type="button"
                onClick={() => setAnonymizationDelay(1800)}
                className={`hover:text-white transition ${anonymizationDelay === 1800 ? 'text-[#FF6600] font-bold' : ''}`}
              >
                30m
              </button>
              <button
                type="button"
                onClick={() => setAnonymizationDelay(2700)}
                className={`hover:text-white transition ${anonymizationDelay === 2700 ? 'text-[#FF6600] font-bold' : ''}`}
              >
                45m
              </button>
              <button
                type="button"
                onClick={() => setAnonymizationDelay(3600)}
                className={`hover:text-white transition ${anonymizationDelay === 3600 ? 'text-[#FF6600] font-bold' : ''}`}
              >
                60m
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mt-2 font-sans leading-relaxed">
              {anonymizationDelay > 0 ? (
                <span className="text-[#FF6600]/90">
                  <strong>Scheduled settlement:</strong> Dispatch is delayed by the selected interval.
                </span>
              ) : (
                <span>
                  <strong>Standard settlement:</strong> Dispatch begins after the required deposit confirmations.
                </span>
              )}
            </p>
          </div>
        </div>


        {/* Error Alert */}
        {quoteError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-mono flex items-center space-x-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{quoteError}</span>
          </div>
        )}

        {/* Submit Swap Button */}
        <button
          onClick={handleInitiateSwap}
          disabled={!quote || isSubmitting}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#FF6600] to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white font-extrabold text-base tracking-wide shadow-lg shadow-orange-500/25 transition transform active:scale-[0.99] flex items-center justify-center space-x-2"
        >
          {isSubmitting ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Zap className="w-5 h-5 fill-white" />
              <span>START MONERO ROUTE</span>
            </>
          )}
        </button>

        {/* Legal Disclaimer Sub-text */}
        <p className="text-[11px] text-slate-500 text-center mt-3 font-sans leading-relaxed">
          By initiating a swap, you acknowledge CoinSwag is an autonomous, non-custodial software protocol. All blockchain transactions are final and irreversible.
        </p>
      </div>

      {/* Real-time Fee Comparison Breakdown */}
      {quote && fromToken && toToken && (
        <FeeComparison
          feeBreakdown={quote.feeBreakdown}
          fromSymbol={fromToken.symbol}
          toSymbol={toToken.symbol}
        />
      )}

      {/* Monero Hub Privacy Routing Explainer */}
      {fromToken && toToken && (
        <PrivacyDiagram
          fromSymbol={fromToken.symbol}
          toSymbol={toToken.symbol}
          isDoubleHop={isDoubleHop}
        />
      )}

      {/* Token Picker Modals */}
      <TokenSelectorModal
        isOpen={modalType === 'from'}
        onClose={() => setModalType(null)}
        onSelect={(token) => setFromToken(token)}
        tokens={tokens}
        title="Select Coin to Send"
      />

      <TokenSelectorModal
        isOpen={modalType === 'to'}
        onClose={() => setModalType(null)}
        onSelect={(token) => setToToken(token)}
        tokens={tokens}
        title="Select Coin to Receive"
      />
    </div>
  );
};
