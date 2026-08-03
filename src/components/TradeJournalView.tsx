import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  Clock,
  ShieldCheck,
  Zap,
  Filter,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Info,
} from 'lucide-react';
import { TradeJournalEntry } from '../types';

interface TradeJournalViewProps {
  activeAccountId: string;
}

export const TradeJournalView: React.FC<TradeJournalViewProps> = ({ activeAccountId }) => {
  const [entries, setEntries] = useState<TradeJournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(activeAccountId);
  const [filterDecision, setFilterDecision] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchJournal = async () => {
    setIsLoading(true);
    try {
      const url = selectedAccountId === 'ALL'
        ? '/api/trade-journal'
        : `/api/trade-journal?accountId=${selectedAccountId}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.journal || []);
      }
    } catch (err) {
      console.error('Failed to fetch trade journal:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setSelectedAccountId(activeAccountId);
  }, [activeAccountId]);

  useEffect(() => {
    fetchJournal();
  }, [selectedAccountId]);

  const filteredEntries = entries.filter((e) => {
    if (filterDecision !== 'ALL' && e.decision !== filterDecision) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const text = `${e.symbol} ${e.persianAnalysis || ''} ${e.englishAnalysis || ''} ${e.strategyName || ''}`.toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4 dir-rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              دفترچه یادداشت و ژورنال معاملات هوش مصنوعی (AI Trade Journal)
              <span className="text-[11px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                {filteredEntries.length} ثبت
              </span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              مستندساز خودکار استدلال‌های تکنیکال، دلایل کانفلوئنس و وضعیت اجرای سفارشات توسط AI
            </p>
          </div>
        </div>

        <button
          onClick={fetchJournal}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          به‌روزرسانی ژورنال
        </button>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">تمام حساب‌های زنده متاتریدر ۵</option>
            {activeAccountId && <option value={activeAccountId}>حساب فعال فعلی ({activeAccountId})</option>}
          </select>

          <select
            value={filterDecision}
            onChange={(e) => setFilterDecision(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">همه تصمیمات AI</option>
            <option value="BUY">سیگنال خرید (BUY)</option>
            <option value="SELL">سیگنال فروش (SELL)</option>
            <option value="HOLD">نگهداشت (HOLD)</option>
            <option value="CLOSE_ALL">بستن همه (CLOSE_ALL)</option>
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="جستجو در ژورنال..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pr-3 pl-8 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
      </div>

      {/* Journal Table/List */}
      {filteredEntries.length === 0 ? (
        <div className="text-center py-10 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 space-y-2">
          <BookOpen className="w-8 h-8 text-gray-300 mx-auto" />
          <p className="text-xs text-gray-500 font-medium">هیچ رکوردی در ژورنال معاملات یافت نشد.</p>
          <p className="text-[11px] text-gray-400">
            با پردازش سیگنال‌های جدید توسط ایجنت هرمس یا اجرای معاملات، تحلیل‌ها خودکار ثبت می‌شوند.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => {
            const isExpanded = expandedId === entry.id;
            const isBuy = entry.decision === 'BUY';
            const isSell = entry.decision === 'SELL';

            return (
              <div
                key={entry.id}
                className="border border-gray-200 hover:border-indigo-300 rounded-xl bg-white overflow-hidden transition-all shadow-2xs"
              >
                {/* Main Row summary */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-gray-50/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                        isBuy
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : isSell
                          ? 'bg-red-100 text-red-700 border border-red-200'
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}
                    >
                      {isBuy ? <TrendingUp className="w-3.5 h-3.5" /> : isSell ? <TrendingDown className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
                      {entry.decision}
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900">{entry.symbol}</span>
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                          {entry.timeframe}
                        </span>
                        <span className="text-[10px] text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-full">
                          حساب: #{entry.accountNumber || entry.accountId}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
                        {entry.persianAnalysis || 'تحلیل فنی توسط ایجنت هرمس ثبت شده است.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 text-xs shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100">
                    <div className="text-left md:text-right">
                      <span className="text-[10px] text-gray-400 block">اطمینان AI</span>
                      <span className="font-bold text-indigo-600">{entry.confidence}%</span>
                    </div>

                    <div className="text-left md:text-right">
                      <span className="text-[10px] text-gray-400 block">اسپرد / قیمت</span>
                      <span className="font-mono text-gray-700">{entry.ask ? entry.ask.toFixed(2) : '---'}</span>
                    </div>

                    <div className="text-left md:text-right">
                      <span className="text-[10px] text-gray-400 block">زمان ثبت</span>
                      <span className="text-gray-500 text-[10px] flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        {new Date(entry.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="p-1 text-gray-400 hover:text-gray-600">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div className="bg-slate-50 border-t border-gray-200 p-4 space-y-3 text-xs text-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Persian AI Analysis */}
                      <div className="bg-white p-3 rounded-lg border border-gray-200 space-y-1.5">
                        <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                          تحلیل و استدلال فنی هوش مصنوعی (Persian AI Analysis)
                        </h4>
                        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {entry.persianAnalysis || 'بدون توضیحات متنی 추가'}
                        </p>
                      </div>

                      {/* Technical Confluences & Snapshot */}
                      <div className="bg-white p-3 rounded-lg border border-gray-200 space-y-2">
                        <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                          عوامل کانفلوئنس و تاییدیه استراتژی
                        </h4>

                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div className="bg-gray-50 p-2 rounded">
                            <span className="text-gray-400 block text-[10px]">Ask / Bid</span>
                            <span className="font-bold">{entry.ask} / {entry.bid}</span>
                          </div>
                          <div className="bg-gray-50 p-2 rounded">
                            <span className="text-gray-400 block text-[10px]">Spread</span>
                            <span className="font-bold text-amber-700">{entry.spread} pts</span>
                          </div>
                          <div className="bg-gray-50 p-2 rounded">
                            <span className="text-gray-400 block text-[10px]">Lot Size</span>
                            <span className="font-bold">{entry.lot || '---'}</span>
                          </div>
                          <div className="bg-gray-50 p-2 rounded">
                            <span className="text-gray-400 block text-[10px]">Risk Score</span>
                            <span className="font-bold text-blue-600">{entry.riskScore || 85}/100</span>
                          </div>
                        </div>

                        {entry.confluenceReasons && entry.confluenceReasons.length > 0 && (
                          <div className="pt-2 border-t border-gray-100">
                            <span className="text-[10px] text-gray-400 block mb-1">دلایل همگرایی (Confluences):</span>
                            <ul className="space-y-1">
                              {entry.confluenceReasons.map((reason, idx) => (
                                <li key={idx} className="flex items-center gap-1.5 text-[11px] text-gray-700">
                                  <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                                  {reason}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Order SL / TP & Status Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-200/80 text-[11px]">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500">
                          نقطه ورود: <strong className="font-mono text-gray-900">{entry.entryPrice || '---'}</strong>
                        </span>
                        <span className="text-red-600">
                          حد ضرر (SL): <strong className="font-mono">{entry.sl || '---'}</strong>
                        </span>
                        <span className="text-green-600">
                          حد سود (TP): <strong className="font-mono">{entry.tp || '---'}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">وضعیت ثبت:</span>
                        <span className="bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded text-[10px]">
                          {entry.status}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
