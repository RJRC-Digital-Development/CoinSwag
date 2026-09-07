import React, { useState, useEffect } from 'react';
import { 
  X, 
  RefreshCw, 
  Zap, 
  Shield, 
  Server, 
  Coins, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowUpRight, 
  Wallet, 
  Activity, 
  Lock 
} from 'lucide-react';

interface NodeStatus {
  endpoint: string;
  chain: string;
  isHealthy: boolean;
  latencyMs: number;
  failureCount: number;
  lastChecked: number;
}

interface FeeStats {
  totalFeesCollectedUsd: number;
  totalFeesSweptUsd: number;
  pendingBufferUsd: number;
  sweepMode: string;
  thresholdUsd: number;
  buffers: Array<{
    assetId: string;
    chain: string;
    accumulatedAmount: number;
    accumulatedUsd: number;
  }>;
  recentSweeps: Array<{
    id: string;
    assetId: string;
    chain: string;
    amount: number;
    amountUsd: number;
    destinationWallet: string;
    txHash: string;
    sweptAt: number;
    mode: string;
  }>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const OperatorDrawer: React.FC<Props> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'revenue' | 'nodes'>('revenue');
  const [feeStats, setFeeStats] = useState<FeeStats | null>(null);
  const [nodes, setNodes] = useState<NodeStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);
  const [sweepMessage, setSweepMessage] = useState<string | null>(null);
  const [selectedChainFilter, setSelectedChainFilter] = useState<string>('all');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [feeRes, nodeRes] = await Promise.all([
        fetch('/api/v1/fees/stats').then(r => r.json()),
        fetch('/api/v1/nodes/status').then(r => r.json())
      ]);

      if (feeRes.stats) setFeeStats(feeRes.stats);
      if (nodeRes.nodes) setNodes(nodeRes.nodes);
    } catch (err) {
      console.error('Error fetching operator data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
      const interval = setInterval(fetchData, 8000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleSweepNow = async () => {
    setIsSweeping(true);
    setSweepMessage(null);
    try {
      const res = await fetch('/api/v1/fees/sweep-now', { method: 'POST' });
      const data = await res.json();
      setSweepMessage(data.message || 'Fee sweep initiated successfully');
      await fetchData();
    } catch (err: any) {
      setSweepMessage('Sweep failed: ' + err.message);
    } finally {
      setIsSweeping(false);
    }
  };

  if (!isOpen) return null;

  const chains = Array.from(new Set(nodes.map(n => n.chain)));
  const filteredNodes = selectedChainFilter === 'all'
    ? nodes
    : nodes.filter(n => n.chain === selectedChainFilter);

  const healthyNodesCount = nodes.filter(n => n.isHealthy).length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm animate-fadeIn flex justify-end">
      <div className="w-full max-w-2xl bg-[#0E131E] border-l border-[#262D3D] h-full shadow-2xl flex flex-col justify-between overflow-hidden">
        
        {/* Drawer Header */}
        <div className="p-5 border-b border-[#262D3D] bg-[#121620] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[#FF6600] flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Operator Dashboard</span>
                <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Zero-KYC Hub Live
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                External Fee Sweeper & Remote RPC Node Infrastructure
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchData}
              disabled={isLoading}
              title="Refresh Data"
              className="p-2 rounded-lg bg-[#1C2230] hover:bg-[#252E42] text-slate-300 transition"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#FF6600]' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-[#1C2230] hover:bg-[#252E42] text-slate-300 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#262D3D] bg-[#0A0D14] px-5 text-xs font-mono font-bold">
          <button
            onClick={() => setActiveTab('revenue')}
            className={`py-3 px-4 border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'revenue'
                ? 'border-[#FF6600] text-[#FF6600]'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Revenue & Fee Sweeper</span>
            {feeStats && feeStats.totalFeesSweptUsd > 0 && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">
                ${feeStats.totalFeesSweptUsd.toFixed(2)}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('nodes')}
            className={`py-3 px-4 border-b-2 transition flex items-center space-x-2 ${
              activeTab === 'nodes'
                ? 'border-[#FF6600] text-[#FF6600]'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Remote Nodes ({healthyNodesCount}/{nodes.length})</span>
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {activeTab === 'revenue' ? (
            <div className="space-y-5">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#151922] border border-[#262D3D] rounded-2xl p-4 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Total Fees Swept</span>
                  <span className="text-xl font-bold font-mono text-emerald-400 block">
                    ${feeStats ? feeStats.totalFeesSweptUsd.toFixed(2) : '0.00'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Dispatched to external cold storage</span>
                </div>

                <div className="bg-[#151922] border border-[#262D3D] rounded-2xl p-4 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Pending In Buffers</span>
                  <span className="text-xl font-bold font-mono text-amber-400 block">
                    ${feeStats ? feeStats.pendingBufferUsd.toFixed(2) : '0.00'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Auto-sweeps at ${feeStats?.thresholdUsd || 50}</span>
                </div>

                <div className="bg-[#151922] border border-[#262D3D] rounded-2xl p-4 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Sweeper Mode</span>
                  <span className="text-xl font-bold font-mono text-white block">
                    {feeStats?.sweepMode || 'REALTIME'}
                  </span>
                  <span className="text-[10px] text-[#FF6600] font-mono">External Wallet Payout</span>
                </div>
              </div>

              {/* Manual Sweep Action Banner */}
              <div className="p-4 bg-gradient-to-r from-orange-500/10 via-[#151922] to-[#151922] border border-[#FF6600]/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-white text-sm flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-[#FF6600]" />
                    <span>Instant External Fee Sweep</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-sans">
                    Flushes all accumulated platform revenue buffers directly to your designated external wallets.
                  </p>
                </div>
                <button
                  onClick={handleSweepNow}
                  disabled={isSweeping}
                  className="px-4 py-2 bg-gradient-to-r from-[#FF6600] to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white font-bold text-xs font-mono rounded-xl shadow-lg shadow-orange-500/20 flex items-center space-x-2 transition shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSweeping ? 'animate-spin' : ''}`} />
                  <span>{isSweeping ? 'Sweeping...' : 'Sweep Fees Now'}</span>
                </button>
              </div>

              {sweepMessage && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-mono flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{sweepMessage}</span>
                </div>
              )}

              {/* Configured External Wallets */}
              <div className="bg-[#121620] border border-[#262D3D] rounded-2xl p-4 space-y-3">
                <div className="flex items-center space-x-2 text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                  <Wallet className="w-3.5 h-3.5 text-[#FF6600]" />
                  <span>Configured Revenue Recipients</span>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2.5 bg-[#0B0E14] border border-[#262D3D] rounded-xl">
                    <div className="flex justify-between text-slate-400 text-[10px] uppercase">
                      <span>Monero Stealth Subaddress (FEE_RECIPIENT_XMR)</span>
                      <span className="text-[#FF6600] font-bold">RingCT Private</span>
                    </div>
                    <span className="text-slate-200 font-bold block truncate mt-0.5">
                      888tNkZrPN6JsEgekjMnABU4TBzc2Dt29EPAvkFxbANsAnJYPbb3iQ1YBRk1UXCDRSiKc9dhwMVgN5S9cQUiyoogDavup3H
                    </span>
                  </div>

                  <div className="p-2.5 bg-[#0B0E14] border border-[#262D3D] rounded-xl">
                    <div className="flex justify-between text-slate-400 text-[10px] uppercase">
                      <span>Bitcoin Cold Storage (FEE_RECIPIENT_BTC)</span>
                      <span className="text-amber-400 font-bold">Native SegWit</span>
                    </div>
                    <span className="text-slate-200 font-bold block truncate mt-0.5">
                      bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq
                    </span>
                  </div>

                  <div className="p-2.5 bg-[#0B0E14] border border-[#262D3D] rounded-xl">
                    <div className="flex justify-between text-slate-400 text-[10px] uppercase">
                      <span>Ethereum / EVM Vault (FEE_RECIPIENT_EVM)</span>
                      <span className="text-cyan-400 font-bold">ERC-20</span>
                    </div>
                    <span className="text-slate-200 font-bold block truncate mt-0.5">
                      0x71C83602187317E36C289b7A7e71Af3088CceC43
                    </span>
                  </div>

                  <div className="p-2.5 bg-[#0B0E14] border border-[#262D3D] rounded-xl">
                    <div className="flex justify-between text-slate-400 text-[10px] uppercase">
                      <span>Solana Treasury (FEE_RECIPIENT_SOL)</span>
                      <span className="text-purple-400 font-bold">SPL Vault</span>
                    </div>
                    <span className="text-slate-200 font-bold block truncate mt-0.5">
                      7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
                    </span>
                  </div>
                </div>
              </div>

              {/* Sweep Audit History */}
              <div className="bg-[#121620] border border-[#262D3D] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-200">
                  <span>Recent Fee Sweeps ({feeStats?.recentSweeps?.length || 0})</span>
                  <span className="text-[10px] text-slate-400 uppercase">Live Payout Log</span>
                </div>

                {(!feeStats?.recentSweeps || feeStats.recentSweeps.length === 0) ? (
                  <p className="text-xs text-slate-500 font-mono text-center py-4">
                    No fee sweeps recorded yet. As orders complete, fees will automatically record here.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {feeStats.recentSweeps.map(sweep => (
                      <div key={sweep.id} className="p-2.5 bg-[#0B0E14] border border-[#262D3D] rounded-xl text-xs font-mono flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-emerald-400">+{sweep.amount.toFixed(6)} {sweep.assetId}</span>
                            <span className="text-slate-400">(${sweep.amountUsd.toFixed(2)})</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block truncate max-w-xs mt-0.5">
                            Tx: {sweep.txHash}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(sweep.sweptAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Chain Filter Bar */}
              <div className="flex flex-wrap gap-1.5 pb-2">
                <button
                  onClick={() => setSelectedChainFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition ${
                    selectedChainFilter === 'all'
                      ? 'bg-[#FF6600] text-white font-bold'
                      : 'bg-[#151922] border border-[#262D3D] text-slate-400 hover:text-white'
                  }`}
                >
                  All ({nodes.length})
                </button>
                {chains.map(chain => (
                  <button
                    key={chain}
                    onClick={() => setSelectedChainFilter(chain)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono uppercase transition ${
                      selectedChainFilter === chain
                        ? 'bg-[#FF6600] text-white font-bold'
                        : 'bg-[#151922] border border-[#262D3D] text-slate-400 hover:text-white'
                    }`}
                  >
                    {chain} ({nodes.filter(n => n.chain === chain).length})
                  </button>
                ))}
              </div>

              {/* Node List */}
              <div className="space-y-2">
                {filteredNodes.map((node, i) => (
                  <div 
                    key={node.endpoint + i}
                    className="p-3 bg-[#121620] border border-[#262D3D] rounded-xl flex items-center justify-between text-xs font-mono"
                  >
                    <div className="overflow-hidden mr-3">
                      <div className="flex items-center space-x-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          node.isHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                        }`} />
                        <span className="font-bold text-white uppercase text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">
                          {node.chain}
                        </span>
                        <span className="text-slate-300 truncate text-[11px]">
                          {node.endpoint}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0 text-right">
                      <span className="text-[10px] text-slate-400">
                        {node.latencyMs}ms
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        node.isHealthy
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {node.isHealthy ? 'Healthy' : 'Failover'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-[#262D3D] bg-[#0A0D14] flex items-center justify-between text-[11px] font-mono text-slate-500">
          <div className="flex items-center space-x-2">
            <Lock className="w-3.5 h-3.5 text-[#FF6600]" />
            <span>Automatic Node Failover & Zero-KYC Janitor Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
