import React, { useState, useEffect } from 'react';
import {
  Bot,
  Zap,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Sliders,
  DollarSign,
  Activity,
  Layers,
  Sparkles,
  Info,
  Check,
  ChevronRight,
  Brain,
  Crosshair,
  BarChart2,
  HelpCircle,
  Target,
} from 'lucide-react';
import {
  CopilotConfig,
  TradeOpportunity,
  MarketScannerItem,
  CopilotMode,
  TradingStyle,
} from '../types';
import { ScalpingCopilotPanel } from './ScalpingCopilotPanel';

interface TradingCopilotViewProps {
  activeAccountId: string;
  onRefreshState?: () => void;
}

export const TradingCopilotView: React.FC<TradingCopilotViewProps> = ({
  activeAccountId,
  onRefreshState,
}) => {
  const [config, setConfig] = useState<CopilotConfig | null>(null);
  const [opportunities, setOpportunities] = useState<TradeOpportunity[]>([]);
  const [scannerData, setScannerData] = useState<MarketScannerItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [executingOppId, setExecutingOppId] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('XAUUSD');
  const [selectedOppForDetail, setSelectedOppForDetail] = useState<TradeOpportunity | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Time-remaining tick counter for live active opportunities
  const [nowTime, setNowTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchCopilotData = async () => {
    setIsLoading(true);
    try {
      const [configRes, oppsRes, scannerRes] = await Promise.all([
        fetch(`/api/trading/copilot/config?accountId=${activeAccountId}`),
        fetch(`/api/trading/copilot/opportunities?accountId=${activeAccountId}`),
        fetch(`/api/trading/copilot/scanner`),
      ]);

      if (configRes.ok) {
        const cData = await configRes.json();
        setConfig(cData.config);
      }
      if (oppsRes.ok) {
        const oData = await oppsRes.json();
        setOpportunities(oData.opportunities || []);
      }
      if (scannerRes.ok) {
        const sData = await scannerRes.json();
        setScannerData(sData.scanner || []);
      }
    } catch (err) {
      console.error('Failed to load copilot data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCopilotData();
  }, [activeAccountId]);

  const handleUpdateConfig = async (updates: Partial<CopilotConfig>) => {
    try {
      const res = await fetch('/api/trading/copilot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: activeAccountId, ...updates }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setMsg({ type: 'success', text: 'تنظیمات کوپایلت با موفقیت ذخیره شد.' });
        setTimeout(() => setMsg(null), 3000);
      }
    } catch (err) {
      console.error('Failed to update config:', err);
    }
  };

  const handleGenerateOpportunity = async (symbolOverride?: string) => {
    setIsGenerating(true);
    setMsg(null);
    try {
      const res = await fetch('/api/trading/copilot/generate-opportunity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: activeAccountId,
          symbol: symbolOverride || selectedSymbol,
          style: config?.style || 'SCALPING',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setOpportunities((prev) => [data.opportunity, ...prev]);
        setMsg({ type: 'success', text: `فرصت معامله جدید برای ${data.opportunity.symbol} شناسایی شد.` });
        setTimeout(() => setMsg(null), 3000);
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'خطا در ارتباط با هوش مصنوعی برای تولید سیگنال.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExecuteOpportunity = async (oppId: string) => {
    setExecutingOppId(oppId);
    setMsg(null);
    try {
      const res = await fetch('/api/trading/copilot/execute-opportunity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: oppId, accountId: activeAccountId }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setMsg({ type: 'success', text: 'دستور معامله با موفقیت تأیید شد و به متاتریدر ارسال گردید!' });
        fetchCopilotData();
        if (onRefreshState) onRefreshState();
      } else {
        setMsg({ type: 'error', text: data.message || 'خطا در اجرای معامله.' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'خطا در برقراری ارتباط با سرور' });
    } finally {
      setExecutingOppId(null);
      setTimeout(() => setMsg(null), 4000);
    }
  };

  const handleRejectOpportunity = async (oppId: string) => {
    try {
      const res = await fetch('/api/trading/copilot/reject-opportunity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: oppId, accountId: activeAccountId }),
      });
      if (res.ok) {
        setOpportunities((prev) =>
          prev.map((o) => (o.id === oppId ? { ...o, status: 'REJECTED' } : o))
        );
        setMsg({ type: 'success', text: 'پیشنهاد معامله رد شد.' });
        setTimeout(() => setMsg(null), 2500);
      }
    } catch (err) {
      console.error('Failed to reject opportunity:', err);
    }
  };

  const activeOpportunities = opportunities.filter((o) => {
    const isNotExpired = new Date(o.expiresAt).getTime() > nowTime;
    return o.status === 'ACTIVE' && isNotExpired;
  });

  const historicalOpportunities = opportunities.filter((o) => {
    const isExpired = new Date(o.expiresAt).getTime() <= nowTime;
    return o.status !== 'ACTIVE' || isExpired;
  });

  return (
    <div className="space-y-6 dir-rtl text-gray-800">
      {/* Top Banner / Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-indigo-900/50 relative overflow-hidden">
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-indigo-600/30 border border-indigo-400/30 rounded-xl text-indigo-300 backdrop-blur-sm">
                <Brain className="w-6 h-6 text-indigo-300 animate-pulse" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                دستیار و تحلیل‌گر هوشمند (AI Trading Copilot)
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                هرمس آنلاین
              </span>
            </div>
            <p className="text-xs text-indigo-200/80 max-w-2xl leading-relaxed">
              ماژول کمکی خلبان تریدر: هوش مصنوعی بازار را به صورت زنده اسکن کرده، نقاط دقیق ورود، حد ضرر و حد سود را پیشنهاد می‌دهد. اجرای معامله تنها با یک کلیک تأیید شما صادر می‌شود.
            </p>
          </div>

          {/* Mode Selector Switcher */}
          <div className="bg-slate-800/80 p-1.5 rounded-xl border border-indigo-800/40 backdrop-blur-md flex flex-wrap sm:flex-nowrap gap-1">
            <button
              onClick={() => handleUpdateConfig({ mode: 'COPILOT_ANALYST' })}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                config?.mode === 'COPILOT_ANALYST'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Bot className="w-4 h-4 text-sky-300" />
              <span>تحلیل‌گر (Copilot)</span>
            </button>

            <button
              onClick={() => handleUpdateConfig({ mode: 'AUTO_PILOT' })}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                config?.mode === 'AUTO_PILOT'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-gray-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>خودکار (Auto Pilot)</span>
            </button>

            <button
              onClick={() => handleUpdateConfig({ mode: 'ADVISOR' })}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                config?.mode === 'ADVISOR'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <HelpCircle className="w-4 h-4 text-emerald-300" />
              <span>مشاور (Advisor)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      {msg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            msg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {msg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="text-gray-400 hover:text-gray-600">
            ×
          </button>
        </div>
      )}

      {/* Phase 1: Ultra-Compact AI Scalping Copilot Panel */}
      <ScalpingCopilotPanel
        activeAccountId={activeAccountId}
        onRefreshState={onRefreshState}
      />

      {/* Main 3-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Column 1: Config & Risk Controls (3 cols on lg) */}
        <div className="lg:col-span-3 space-y-5">
          {/* Strategy Profile Panel */}
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <h2 className="text-sm font-bold text-gray-900">پیکربندی سبک معامله</h2>
              </div>
              <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-mono">
                {activeAccountId}
              </span>
            </div>

            {/* Trading Style Buttons */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600 block">سبک معاملاتی شما:</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'SCALPING', label: 'اسکالپینگ', sub: 'M1 - M5' },
                  { id: 'DAY_TRADING', label: 'معاملات روزانه', sub: 'M15 - H1' },
                  { id: 'SWING', label: 'موج‌سواری', sub: 'H4 - D1' },
                  { id: 'CUSTOM', label: 'سفارشی', sub: 'قوانین خاص' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleUpdateConfig({ style: s.id as TradingStyle })}
                    className={`p-2.5 rounded-xl border text-right transition-all ${
                      config?.style === s.id
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-bold shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-gray-50/50'
                    }`}
                  >
                    <div className="text-xs">{s.label}</div>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">{s.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Risk Level Setting */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-600">سطح ریسک معامله:</label>
                <span className="text-xs font-bold text-indigo-600 font-mono">
                  {config?.riskPercentPerTrade || 1.0}٪ موجودی
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { level: 'LOW', pct: 0.5, label: 'کم' },
                  { level: 'MEDIUM', pct: 1.5, label: 'متوسط' },
                  { level: 'HIGH', pct: 2.5, label: 'بالا' },
                ].map((r) => (
                  <button
                    key={r.level}
                    onClick={() =>
                      handleUpdateConfig({
                        riskLevel: r.level as any,
                        riskPercentPerTrade: r.pct,
                      })
                    }
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold text-center border transition-all ${
                      config?.riskPercentPerTrade === r.pct
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {r.label} ({r.pct}٪)
                  </button>
                ))}
              </div>
            </div>

            {/* Expiration Timer Setting */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-600">مدت اعتبار پیشنهاد:</label>
                <span className="text-xs font-bold text-amber-600 font-mono">
                  {config?.expirationSeconds || 30} ثانیه
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[15, 30, 60].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => handleUpdateConfig({ expirationSeconds: sec })}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold text-center border transition-all ${
                      config?.expirationSeconds === sec
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {sec} ثانیه
                  </button>
                ))}
              </div>
            </div>

            {/* Symbol Focus Checklist */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <label className="text-xs font-semibold text-gray-600 block">نمادهای مورد تایید شما:</label>
              <div className="flex flex-wrap gap-1.5">
                {['XAUUSD', 'EURUSD', 'BTCUSD', 'GBPUSD', 'USDJPY'].map((sym) => {
                  const isPref = config?.preferredSymbols.includes(sym);
                  return (
                    <button
                      key={sym}
                      onClick={() => {
                        const current = config?.preferredSymbols || [];
                        const updated = isPref
                          ? current.filter((s) => s !== sym)
                          : [...current, sym];
                        handleUpdateConfig({ preferredSymbols: updated });
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                        isPref
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {sym}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Manual Scan Card */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50/60 rounded-2xl p-4 border border-indigo-100 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-indigo-900">
              <Crosshair className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold">درخواست تحلیل زنده فوری</h3>
            </div>
            <p className="text-[11px] text-indigo-800/80 leading-relaxed">
              نماد مورد نظر را انتخاب کرده و دکمه اسکن را بفشارید تا ایجنت هرمس جدیدترین پیشنهاد معامله را ایجاد کند:
            </p>

            <div className="space-y-2">
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="w-full text-xs bg-white border border-indigo-200 rounded-xl p-2.5 font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="XAUUSD">طلا (XAUUSD)</option>
                <option value="EURUSD">یورو / دلار (EURUSD)</option>
                <option value="BTCUSD">بیت‌کوین (BTCUSD)</option>
                <option value="GBPUSD">پوند / دلار (GBPUSD)</option>
                <option value="USDJPY">دلار / ین (USDJPY)</option>
              </select>

              <button
                onClick={() => handleGenerateOpportunity()}
                disabled={isGenerating}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>در حال تحلیل با Gemini AI...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>اسکن بازار و تولید سیگنال</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Column 2: Live Trade Opportunity Stream (6 cols on lg) */}
        <div className="lg:col-span-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-gray-900">پیشنهادهای معاملاتی فعال</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {activeOpportunities.length} مورد فعال
              </span>
            </div>

            <button
              onClick={fetchCopilotData}
              className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="به‌روزرسانی جریان پیشنهادات"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Active Opportunities Stream */}
          {activeOpportunities.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center space-y-3 shadow-sm">
              <div className="p-3 bg-gray-100 rounded-full w-12 h-12 mx-auto flex items-center justify-center text-gray-400">
                <Clock className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-gray-700">هیچ سیگنال فعالِ منقضی نشده‌ای یافت نشد.</p>
              <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
                می‌توانید روی دکمه «اسکن بازار و تولید سیگنال» کلیک کنید تا هوش مصنوعی فوراً موقعیت‌های معامله را تحلیل کند.
              </p>
              <button
                onClick={() => handleGenerateOpportunity()}
                disabled={isGenerating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors inline-flex items-center gap-2"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>دریافت سیگنال جدید</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {activeOpportunities.map((opp) => {
                const expiresTimeMs = new Date(opp.expiresAt).getTime();
                const totalDurMs = (opp.durationSeconds || 30) * 1000;
                const remainingMs = Math.max(0, expiresTimeMs - nowTime);
                const remainingSec = Math.ceil(remainingMs / 1000);
                const percentLeft = Math.min(100, Math.max(0, (remainingMs / totalDurMs) * 100));

                const isBuy = opp.direction === 'BUY';
                const isExecuting = executingOppId === opp.id;

                return (
                  <div
                    key={opp.id}
                    className="bg-white rounded-2xl border-2 border-indigo-100 shadow-md hover:shadow-lg transition-all overflow-hidden relative"
                  >
                    {/* Live Progress Bar Counter */}
                    <div className="w-full bg-gray-100 h-1.5">
                      <div
                        className={`h-full transition-all duration-1000 ${
                          remainingSec <= 5
                            ? 'bg-rose-500'
                            : remainingSec <= 10
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${percentLeft}%` }}
                      />
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Top Header Card */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm ${
                              isBuy
                                ? 'bg-emerald-600 text-white'
                                : 'bg-rose-600 text-white'
                            }`}
                          >
                            {isBuy ? (
                              <TrendingUp className="w-4 h-4" />
                            ) : (
                              <TrendingDown className="w-4 h-4" />
                            )}
                            <span>{opp.direction}</span>
                            <span className="font-mono text-xs">({opp.symbol})</span>
                          </div>

                          <div className="text-xs text-gray-500 font-semibold">
                            سبک: <span className="text-gray-900 font-bold">{opp.style}</span> ({opp.timeframe})
                          </div>
                        </div>

                        {/* Expiration Timer Badge */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg text-xs font-bold font-mono">
                            <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                            <span>{remainingSec}s اعتبار باقی‌مانده</span>
                          </div>
                        </div>
                      </div>

                      {/* Main Trade Metrics Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-gray-500 block">نقطه ورود پیشنهادی</span>
                          <span className="text-sm font-black text-gray-900 font-mono">
                            {opp.suggestedEntry}
                          </span>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[10px] text-gray-500 block">حد ضرر (Stop Loss)</span>
                          <span className="text-sm font-black text-rose-600 font-mono">
                            {opp.stopLoss}
                          </span>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[10px] text-gray-500 block">حد سود (Take Profit)</span>
                          <span className="text-sm font-black text-emerald-600 font-mono">
                            {opp.takeProfit}
                          </span>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[10px] text-gray-500 block">حجم و R:R</span>
                          <span className="text-xs font-bold text-indigo-700 font-mono">
                            {opp.lotSize} لات | {opp.riskRewardRatio}
                          </span>
                        </div>
                      </div>

                      {/* Rationale "Why?" 4-box reason grid */}
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          چرا ایجنت هرمس این پیشنهاد را داده است؟ (Why Analysis)
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-100 text-blue-950 space-y-0.5">
                            <span className="font-bold text-blue-800 block">۱. روند و گام حرکتی:</span>
                            <p className="text-gray-700 leading-tight">{opp.reasons.trend}</p>
                          </div>

                          <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100 text-indigo-950 space-y-0.5">
                            <span className="font-bold text-indigo-800 block">۲. ساختار و حمایت/مقاومت:</span>
                            <p className="text-gray-700 leading-tight">{opp.reasons.structure}</p>
                          </div>

                          <div className="p-2.5 bg-purple-50/50 rounded-xl border border-purple-100 text-purple-950 space-y-0.5">
                            <span className="font-bold text-purple-800 block">۳. تاییدیه اندیکاتورها:</span>
                            <p className="text-gray-700 leading-tight">{opp.reasons.indicators}</p>
                          </div>

                          <div className="p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-100 text-emerald-950 space-y-0.5">
                            <span className="font-bold text-emerald-800 block">۴. سنجش ریسک و اخبار:</span>
                            <p className="text-gray-700 leading-tight">{opp.reasons.risk}</p>
                          </div>
                        </div>
                      </div>

                      {/* Action Control Buttons */}
                      <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-gray-100">
                        <button
                          onClick={() => handleExecuteOpportunity(opp.id)}
                          disabled={isExecuting}
                          className={`flex-1 w-full py-3 px-4 rounded-xl font-bold text-xs text-white shadow-md flex items-center justify-center gap-2 transition-all ${
                            isBuy
                              ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99]'
                              : 'bg-rose-600 hover:bg-rose-700 active:scale-[0.99]'
                          } disabled:opacity-50`}
                        >
                          {isExecuting ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>در حال ارسال دستور به MT5...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>تأیید و اجرای معامله در متاتریدر ({opp.direction})</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleRejectOpportunity(opp.id)}
                          className="w-full sm:w-auto px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                        >
                          <XCircle className="w-4 h-4 text-gray-400" />
                          <span>رد کردن</span>
                        </button>

                        <button
                          onClick={() => setSelectedOppForDetail(opp)}
                          className="w-full sm:w-auto px-3 py-3 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1"
                          title="مشاهده گزارش کامل تحلیل"
                        >
                          <Info className="w-4 h-4" />
                          <span>جزئیات</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Historical Opportunity Log Stream */}
          {historicalOpportunities.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-800 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-gray-500" />
                  تاریخچه پیشنهادهای قبلی کوپایلت
                </h3>
                <span className="text-[10px] text-gray-400">{historicalOpportunities.length} مورد</span>
              </div>

              <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto text-xs">
                {historicalOpportunities.slice(0, 10).map((opp) => (
                  <div key={opp.id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          opp.direction === 'BUY'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {opp.direction} {opp.symbol}
                      </span>
                      <span className="font-mono text-[11px] text-gray-600">
                        ورود: {opp.suggestedEntry}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          opp.status === 'EXECUTED'
                            ? 'bg-emerald-600 text-white'
                            : opp.status === 'REJECTED'
                            ? 'bg-gray-200 text-gray-600'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {opp.status === 'EXECUTED'
                          ? 'ارسال شده به MT5'
                          : opp.status === 'REJECTED'
                          ? 'رد شده'
                          : 'منقضی شده'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Column 3: Live Market Scanner & Trader Memory (3 cols on lg) */}
        <div className="lg:col-span-3 space-y-5">
          {/* Market Scanner */}
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-gray-900">اسکنر زنده بازار (Scanner)</h2>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                Live
              </span>
            </div>

            <div className="space-y-2.5">
              {scannerData.map((s) => (
                <div
                  key={s.symbol}
                  className="p-3 rounded-xl border border-gray-100 hover:border-gray-300 hover:bg-gray-50/60 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-gray-900">{s.symbol}</div>
                      <div className="text-[10px] text-gray-400">{s.nameFa}</div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-xs text-gray-900">{s.price}</div>
                      <div
                        className={`text-[10px] font-bold font-mono ${
                          s.change24h >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {s.change24h >= 0 ? '+' : ''}
                        {s.change24h}٪
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-gray-100">
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold ${
                        s.trend === 'BULLISH'
                          ? 'bg-emerald-100 text-emerald-800'
                          : s.trend === 'BEARISH'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {s.trendFa}
                    </span>

                    <button
                      onClick={() => handleGenerateOpportunity(s.symbol)}
                      disabled={isGenerating}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                    >
                      <span>تحلیل فوری</span>
                      <ChevronRight className="w-3 h-3 dir-rtl:rotate-180" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trader Memory Widget */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-md border border-indigo-900/50 space-y-3">
            <div className="flex items-center gap-2 border-b border-indigo-800/60 pb-3">
              <Brain className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold text-white">حافظه هوشمند ایجنت (Trader Memory)</h3>
            </div>

            <p className="text-[11px] text-indigo-200/80 leading-relaxed">
              ایجنت هرمس بر اساس ترجیحات شما شخصی‌سازی شده است و همواره بررسی می‌کند که پیشنهادات با سبک معاملاتی شما انطباق داشته باشند:
            </p>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-slate-800/80 rounded-xl border border-indigo-800/40 flex items-center justify-between">
                <span className="text-gray-300">سبک برتر:</span>
                <span className="font-bold text-amber-300">{config?.style || 'SCALPING'}</span>
              </div>

              <div className="p-2.5 bg-slate-800/80 rounded-xl border border-indigo-800/40 flex items-center justify-between">
                <span className="text-gray-300">سقف ریسک هر معامله:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {config?.riskPercentPerTrade || 1.0}٪
                </span>
              </div>

              <div className="p-2.5 bg-slate-800/80 rounded-xl border border-indigo-800/40 flex items-center justify-between">
                <span className="text-gray-300">حد ضرر الزامی:</span>
                <span className="font-bold text-sky-400">فعال (اجباری)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Detail Modal Popup */}
      {selectedOppForDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 dir-rtl">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-gray-900">
                  گزارش تحلیل کامل ایجنت برای {selectedOppForDetail.symbol}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOppForDetail(null)}
                className="text-gray-400 hover:text-gray-700 font-bold text-lg"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-xs text-gray-700">
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 space-y-1">
                <span className="font-bold text-indigo-900 block">خلاصه تحلیل هوش مصنوعی:</span>
                <p className="leading-relaxed">{selectedOppForDetail.fullAnalysisText}</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-gray-900">جزئیات ۴ مرحله‌ای استدلال:</h4>
                <div className="space-y-2">
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="font-bold text-gray-800 block">روند:</span>
                    <p>{selectedOppForDetail.reasons.trend}</p>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="font-bold text-gray-800 block">ساختار بازار:</span>
                    <p>{selectedOppForDetail.reasons.structure}</p>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="font-bold text-gray-800 block">اندیکاتورها:</span>
                    <p>{selectedOppForDetail.reasons.indicators}</p>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="font-bold text-gray-800 block">ریسک و اخبار:</span>
                    <p>{selectedOppForDetail.reasons.risk}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedOppForDetail(null)}
                className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
