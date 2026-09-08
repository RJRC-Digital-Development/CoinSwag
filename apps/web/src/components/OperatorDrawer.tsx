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
  Wallet, 
  Activity, 
  Lock,
  LogOut,
  Eye,
  EyeOff,
  ShieldAlert,
  Trash2
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

interface SentinelStatus {
  sentinel: string;
  status: string;
  circuitBreaker: {
    state: string;
    isHalted: boolean;
    tripReason?: string;
    trippedAt?: number;
  };
  clientStatus: {
    ip: string;
    jailed: boolean;
    remainingSeconds: number;
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const OperatorDrawer: React.FC<Props> = ({ isOpen, onClose }) => {
  const [adminKey, setAdminKey] = useState<string>(() => sessionStorage.getItem('coinswag_admin_key') || '');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(sessionStorage.getItem('coinswag_admin_key')));
  const [loginInput, setLoginInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'revenue' | 'sentinel' | 'nodes'>('revenue');
  const [feeStats, setFeeStats] = useState<FeeStats | null>(null);
  const [sentinelStatus, setSentinelStatus] = useState<SentinelStatus | null>(null);
  const [nodes, setNodes] = useState<NodeStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [selectedChainFilter, setSelectedChainFilter] = useState<string>('all');

  const fetchData = async () => {
    if (!adminKey) return;
    setIsLoading(true);
    try {
      const [feeRes, nodeRes, sentRes] = await Promise.all([
        fetch('/api/v1/fees/stats', { headers: { 'x-admin-key': adminKey } }).then(r => r.json()),
        fetch('/api/v1/nodes/status').then(r => r.json()),
        fetch('/api/v1/sentinel/status').then(r => r.json())
      ]);

      if (feeRes.stats) {
        setFeeStats(feeRes.stats);
      } else if (feeRes.code === 'ADMIN_AUTH_REQUIRED' || feeRes.code === 'ADMIN_KEY_NOT_CONFIGURED') {
        handleLogout();
        setLoginError(feeRes.error || 'Admin authentication required');
        return;
      }

      if (nodeRes.nodes) setNodes(nodeRes.nodes);
      if (sentRes.circuitBreaker) setSentinelStatus(sentRes);
    } catch (err) {
      console.error('Error fetching operator data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && isAuthenticated && adminKey) {
      fetchData();
      const interval = setInterval(fetchData, 8000);
      return () => clearInterval(interval);
    }
  }, [isOpen, isAuthenticated, adminKey]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const candidate = loginInput.trim();
    if (!candidate) return;

    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/v1/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: candidate })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        sessionStorage.setItem('coinswag_admin_key', candidate);
        setAdminKey(candidate);
        setIsAuthenticated(true);
        setLoginInput('');
      } else {
        setLoginError(data.error || 'Authentication failed: Invalid Admin API Key');
      }
    } catch (err: any) {
      setLoginError('Network error connecting to operator authentication gateway');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('coinswag_admin_key');
    setAdminKey('');
    setIsAuthenticated(false);
    setFeeStats(null);
    setSentinelStatus(null);
    setActionMessage(null);
  };

  const handleSweepNow = async () => {
    setIsSweeping(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/v1/fees/sweep-now', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey }
      });
      const data = await res.json();
      setActionMessage(data.message || 'Fee sweep initiated successfully');
      await fetchData();
    } catch (err: any) {
      setActionMessage('Sweep failed: ' + err.message);
    } finally {
      setIsSweeping(false);
    }
  };

  const handleTripCircuitBreaker = async () => {
    if (!window.confirm('⚠️ ENGAGE EMERGENCY FINANCIAL KILL SWITCH?\n\nThis will immediately halt all crypto outflows across the platform.')) {
      return;
    }
    try {
      const res = await fetch('/api/v1/sentinel/trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ reason: 'Manual operator emergency kill switch engaged' })
      });
      const data = await res.json();
      setActionMessage(data.message || 'Circuit Breaker TRIPPED: All outflows halted');
      await fetchData();
    } catch (err: any) {
      setActionMessage('Trip failed: ' + err.message);
    }
  };

  const handleResetCircuitBreaker = async () => {
    try {
      const res = await fetch('/api/v1/sentinel/reset', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey }
      });
      const data = await res.json();
      setActionMessage(data.message || 'Circuit Breaker RESET: Outflows resumed');
      await fetchData();
    } catch (err: any) {
      setActionMessage('Reset failed: ' + err.message);
    }
  };

  const handleRunJanitor = async () => {
    try {
      const res = await fetch('/api/v1/admin/janitor', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey }
      });
      const data = await res.json();
      setActionMessage(data.message || 'Zero-KYC Janitor executed successfully');
      await fetchData();
    } catch (err: any) {
      setActionMessage('Janitor failed: ' + err.message);
    }
  };

  if (!isOpen) return null;

  const chains = Array.from(new Set(nodes.map(n => n.chain)));
  const filteredNodes = selectedChainFilter === 'all'
    ? nodes
    : nodes.filter(n => n.chain === selectedChainFilter);

  const healthyNodesCount = nodes.filter(n => n.isHealthy).length;
  const isHalted = sentinelStatus?.circuitBreaker?.isHalted;

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
                {isAuthenticated && (
                  <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    Authenticated
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                External Fee Sweeper & Remote RPC Node Infrastructure
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isAuthenticated && (
              <>
                <button
                  onClick={fetchData}
                  disabled={isLoading}
                  title="Refresh Data"
                  className="p-2 rounded-lg bg-[#1C2230] hover:bg-[#252E42] text-slate-300 transition cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#FF6600]' : ''}`} />
                </button>
                <button
                  onClick={handleLogout}
                  title="Lock Console / Log Out"
                  className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition cursor-pointer flex items-center space-x-1"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-[#1C2230] hover:bg-[#252E42] text-slate-300 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Unauthenticated Login View */}
        {!isAuthenticated ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-[#FF6600] flex items-center justify-center shadow-lg shadow-orange-500/10">
              <Lock className="w-8 h-8" />
            </div>

            <div className="text-center space-y-2 max-w-md">
              <h3 className="text-xl font-bold text-white tracking-tight">Operator Authentication</h3>
              <p className="text-xs text-slate-400 font-sans leading-relaxed">
                Enter your <code className="text-[#FF6600] bg-orange-950/40 px-1.5 py-0.5 rounded font-mono">ADMIN_API_KEY</code> to unlock the operator console, live fee sweeps, and financial circuit breakers.
              </p>
            </div>

            <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase text-slate-400 block">
                  Admin API Secret Key
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    placeholder="Enter ADMIN_API_KEY..."
                    autoFocus
                    required
                    className="w-full bg-[#121620] border border-[#262D3D] focus:border-[#FF6600] rounded-xl px-4 py-3 text-sm text-white font-mono placeholder:text-slate-600 outline-none transition pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-mono flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn || !loginInput.trim()}
                className="w-full py-3 bg-gradient-to-r from-[#FF6600] to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider rounded-xl shadow-lg shadow-orange-500/20 transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isLoggingIn ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Unlock Operator Console</span>
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <p className="text-[11px] text-slate-500 font-mono">
                  🔒 Constant-Time TimingSafeEqual • Volatile Session Storage Only
                </p>
              </div>
            </form>
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="flex border-b border-[#262D3D] bg-[#0A0D14] px-5 text-xs font-mono font-bold">
              <button
                onClick={() => setActiveTab('revenue')}
                className={`py-3 px-4 border-b-2 transition flex items-center space-x-2 cursor-pointer ${
                  activeTab === 'revenue'
                    ? 'border-[#FF6600] text-[#FF6600]'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Coins className="w-4 h-4" />
                <span>Revenue & Sweeper</span>
                {feeStats && feeStats.totalFeesSweptUsd > 0 && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">
                    ${feeStats.totalFeesSweptUsd.toFixed(2)}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('sentinel')}
                className={`py-3 px-4 border-b-2 transition flex items-center space-x-2 cursor-pointer ${
                  activeTab === 'sentinel'
                    ? 'border-[#FF6600] text-[#FF6600]'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Sentinel & Security</span>
                {isHalted && (
                  <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded animate-pulse">
                    HALTED
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('nodes')}
                className={`py-3 px-4 border-b-2 transition flex items-center space-x-2 cursor-pointer ${
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
              
              {actionMessage && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-mono flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{actionMessage}</span>
                </div>
              )}

              {/* TAB 1: REVENUE */}
              {activeTab === 'revenue' && (
                <div className="space-y-5">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-[#151922] border border-[#262D3D] rounded-2xl p-4 space-y-1">
                      <span className="text-[10px] font-mono uppercase text-slate-400 block">Total Fees Swept</span>
                      <span className="text-xl font-bold font-mono text-emerald-400 block">
                        ${feeStats ? feeStats.totalFeesSweptUsd.toFixed(2) : '0.00'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Dispatched to cold storage</span>
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
                      className="px-4 py-2 bg-gradient-to-r from-[#FF6600] to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono rounded-xl shadow-lg shadow-orange-500/20 flex items-center space-x-2 transition shrink-0 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSweeping ? 'animate-spin' : ''}`} />
                      <span>{isSweeping ? 'Sweeping...' : 'Sweep Fees Now'}</span>
                    </button>
                  </div>

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
              )}

              {/* TAB 2: SENTINEL & SECURITY CONTROLS */}
              {activeTab === 'sentinel' && (
                <div className="space-y-5">
                  {/* Circuit Breaker Status Banner */}
                  <div className={`p-4 rounded-2xl border ${
                    isHalted 
                      ? 'bg-red-500/10 border-red-500/30' 
                      : 'bg-emerald-500/10 border-emerald-500/30'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          isHalted ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                            <span>Financial Circuit Breaker</span>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                              isHalted ? 'bg-red-500/30 text-red-300' : 'bg-emerald-500/30 text-emerald-300'
                            }`}>
                              {isHalted ? 'EMERGENCY HALTED' : 'ARMED & ACTIVE'}
                            </span>
                          </h3>
                          <p className="text-xs text-slate-400 font-sans mt-0.5">
                            {isHalted
                              ? `All platform outflows halted: ${sentinelStatus?.circuitBreaker?.tripReason || 'Operator Trip'}`
                              : 'Autonomous protection against large single-payout drains ($50k) and velocity spikes.'}
                          </p>
                        </div>
                      </div>

                      {isHalted ? (
                        <button
                          onClick={handleResetCircuitBreaker}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs font-mono rounded-xl transition cursor-pointer"
                        >
                          Reset Breaker
                        </button>
                      ) : (
                        <button
                          onClick={handleTripCircuitBreaker}
                          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-bold text-xs font-mono rounded-xl transition cursor-pointer"
                        >
                          Trip Kill Switch
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Zero-KYC Data Shredder */}
                  <div className="p-4 bg-[#121620] border border-[#262D3D] rounded-2xl flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                        <Trash2 className="w-4 h-4 text-amber-400" />
                        <span>Zero-KYC Janitor Memory Scrubber</span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5 font-sans">
                        Forces an immediate 3-pass DoD memory wipe on all expired swap sessions and temporary keypairs.
                      </p>
                    </div>
                    <button
                      onClick={handleRunJanitor}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs font-mono rounded-xl transition shrink-0 cursor-pointer"
                    >
                      Run Janitor Now
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: REMOTE NODES */}
              {activeTab === 'nodes' && (
                <div className="space-y-4">
                  {/* Chain Filter Bar */}
                  <div className="flex flex-wrap gap-1.5 pb-2">
                    <button
                      onClick={() => setSelectedChainFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                        selectedChainFilter === 'all'
                          ? 'bg-[#FF6600] text-slate-950 font-bold'
                          : 'bg-[#151922] border border-[#262D3D] text-slate-400 hover:text-white'
                      }`}
                    >
                      All ({nodes.length})
                    </button>
                    {chains.map(chain => (
                      <button
                        key={chain}
                        onClick={() => setSelectedChainFilter(chain)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono uppercase transition cursor-pointer ${
                          selectedChainFilter === chain
                            ? 'bg-[#FF6600] text-slate-950 font-bold'
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
          </>
        )}

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
