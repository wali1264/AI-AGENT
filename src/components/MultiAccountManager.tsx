import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Wallet,
  TrendingUp,
  Cpu,
  ShieldAlert,
  Sliders,
  Check,
  Building2,
  BookOpen,
  Trash2,
} from 'lucide-react';

export interface MultiAccountConfig {
  accountId: string;
  accountNumber: number;
  broker: string;
  name: string;
  strategyType: 'SURFING' | 'INTRADAY' | 'SWING' | 'SCALPING' | 'CUSTOM';
  isEnabled: boolean;
  assignedAgentName: string;
  createdAt: string;
  lastActiveAt?: string;
  balance?: number;
  equity?: number;
  openPositionsCount?: number;
  isConnected?: boolean;
  isActive?: boolean;
  journalEntriesCount?: number;
}

interface MultiAccountManagerProps {
  activeAccountId: string;
  onAccountSelect: (accountId: string) => void;
  onAccountCreated?: () => void;
}

export const MultiAccountManager: React.FC<MultiAccountManagerProps> = ({
  activeAccountId,
  onAccountSelect,
  onAccountCreated,
}) => {
  const [accounts, setAccounts] = useState<MultiAccountConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // New Account Form state
  const [newAccNumber, setNewAccNumber] = useState('');
  const [newBroker, setNewBroker] = useState('.Markets Ltd');
  const [newName, setNewName] = useState('');
  const [newStrategy, setNewStrategy] = useState<MultiAccountConfig['strategyType']>('SURFING');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/multi-accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
    const timer = setInterval(fetchAccounts, 8000);
    return () => clearInterval(timer);
  }, []);

  const handleSelect = async (accountId: string) => {
    try {
      const res = await fetch('/api/multi-accounts/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      if (res.ok) {
        onAccountSelect(accountId);
        await fetchAccounts();
      }
    } catch (err) {
      console.error('Failed to select account:', err);
    }
  };

  const handleDeleteAccount = async (accountId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (accounts.length <= 1) {
      alert('حداقل یک حساب باید در سیستم باقی بماند.');
      return;
    }
    if (!window.confirm('آیا از حذف این حساب اطمینان دارید؟')) return;

    try {
      const res = await fetch(`/api/multi-accounts/${accountId}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        if (data.activeAccountId) {
          onAccountSelect(data.activeAccountId);
        }
        await fetchAccounts();
      }
    } catch (err) {
      console.error('Failed to delete account:', err);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const accNum = parseInt(newAccNumber);
    if (!accNum || isNaN(accNum)) {
      setErrorMsg('لطفا شماره حساب معتبر متاتریدر وارد کنید.');
      return;
    }
    const accountId = `MT5_${accNum}`;
    try {
      const res = await fetch('/api/multi-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          accountNumber: accNum,
          broker: newBroker || 'Exness Global',
          name: newName || `حساب ${accNum}`,
          strategyType: newStrategy,
        }),
      });
      if (res.ok) {
        setIsAddOpen(false);
        setNewAccNumber('');
        setNewName('');
        await fetchAccounts();
        if (onAccountCreated) onAccountCreated();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'خطا در ثبت حساب جدید.');
      }
    } catch (err: any) {
      setErrorMsg('خطا در برقراری ارتباط با سرور.');
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              مدیریت حساب‌های چندگانه (Multi-Account Engine)
              <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                {accounts.length} حساب
              </span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              مدیریت همزمان چندین حساب متاتریدر با ایجنت‌های اختصاصی و حافظه ایزوله
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAccounts}
            disabled={isLoading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="به‌روزرسانی لیست"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsAddOpen(!isAddOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            افزودن حساب MT5 جدید
          </button>
        </div>
      </div>

      {/* Add New Account Collapsible Form */}
      {isAddOpen && (
        <form onSubmit={handleAddAccount} className="bg-gray-50 border border-blue-100 rounded-lg p-4 space-y-3">
          <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-blue-600" />
            تعریف و پیکربندی حساب جدید متاتریدر
          </h4>

          {errorMsg && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                شماره حساب (Account Number) *
              </label>
              <input
                type="number"
                placeholder="شماره حساب متاتریدر ۵"
                value={newAccNumber}
                onChange={(e) => setNewAccNumber(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                نام کاربری/عنوان حساب
              </label>
              <input
                type="text"
                placeholder="مثلا طلا - اسکالپ هوشمند"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                نام بروکر (Broker)
              </label>
              <input
                type="text"
                placeholder=".Markets Ltd"
                value={newBroker}
                onChange={(e) => setNewBroker(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                نوع استراتژی (Strategy Profile)
              </label>
              <select
                value={newStrategy}
                onChange={(e) => setNewStrategy(e.target.value as any)}
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              >
                <option value="SURFING">SURFING - موج سواری تکنیکال</option>
                <option value="SCALPING">SCALPING - اسکالپ سریع</option>
                <option value="INTRADAY">INTRADAY - معاملات روزانه</option>
                <option value="SWING">SWING - نوسان‌گیری بلندمدت</option>
                <option value="CUSTOM">CUSTOM - سفارشی</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded-lg"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
            >
              ثبت و ایزوله‌سازی حساب
            </button>
          </div>
        </form>
      )}

      {/* Accounts Grid Cards */}
      {accounts.length === 0 ? (
        <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-6 text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
          <h4 className="text-xs font-bold text-amber-900">هیچ حساب متاتریدری در حال حاضر متصل نیست</h4>
          <p className="text-xs text-amber-700 max-w-md mx-auto">
            به محض اینکه ربات Expert Advisor (MQL5) روی متاتریدر ۵ روشن شود و اولین درخواست را ارسال کند، حساب شما به‌صورت خودکار و زنده شناسایی و در این بخش نمایش داده خواهد شد.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {accounts.map((acc) => {
          const isActive = acc.accountId === activeAccountId || acc.isActive;
          return (
            <div
              key={acc.accountId}
              onClick={() => handleSelect(acc.accountId)}
              className={`relative cursor-pointer rounded-xl p-4 transition-all border ${
                isActive
                  ? 'bg-blue-50/60 border-blue-500 shadow-sm ring-1 ring-blue-500'
                  : 'bg-gray-50/70 border-gray-200 hover:border-gray-300 hover:bg-gray-100/60'
              }`}
            >
              {/* Top Left Controls: Active Badge & Delete Button */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5">
                {isActive && (
                  <div className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    حساب فعال UI
                  </div>
                )}
                {accounts.length > 1 && (
                  <button
                    onClick={(e) => handleDeleteAccount(acc.accountId, e)}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="حذف این حساب"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900">{acc.name}</h4>
                  <p className="text-[11px] text-gray-500 dir-ltr text-right">
                    #{acc.accountNumber} | {acc.broker}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 my-3 pt-2 border-t border-gray-200/60 text-xs">
                <div>
                  <span className="text-[10px] text-gray-400 block">موجودی (Balance)</span>
                  <span className="font-bold text-gray-800 dir-ltr inline-block">
                    ${acc.balance !== undefined ? acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '---'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block">سرمایه (Equity)</span>
                  <span className="font-bold text-blue-700 dir-ltr inline-block">
                    ${acc.equity !== undefined ? acc.equity.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '---'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                <span className="bg-gray-200/80 text-gray-700 px-2 py-0.5 rounded font-mono text-[10px]">
                  {acc.strategyType}
                </span>
                <span className="flex items-center gap-1 text-[10px]">
                  <BookOpen className="w-3 h-3 text-blue-500" />
                  ژورنال: {acc.journalEntriesCount || 0}
                </span>
                <span
                  className={`flex items-center gap-1 text-[10px] font-semibold ${
                    acc.isConnected ? 'text-green-600' : 'text-amber-600'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${acc.isConnected ? 'bg-green-500 animate-pulse' : 'bg-amber-400'}`} />
                  {acc.isConnected ? 'پل MT5 متصل' : 'در انتظار اتصال'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};
