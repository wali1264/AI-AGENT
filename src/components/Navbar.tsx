import React from 'react';
import { Cpu, ShieldCheck, ShieldAlert, Key, RefreshCw, Lock } from 'lucide-react';
import { ServerState } from '../types';

interface NavbarProps {
  state: ServerState | null;
  onRefresh: () => void;
  isLoading: boolean;
  onOpenLogin: () => void;
  isAuthenticated: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  state,
  onRefresh,
  isLoading,
  onOpenLogin,
  isAuthenticated,
}) => {
  const activeKeys = state?.stats.activeKeysCount ?? 0;
  const isHealthy = activeKeys > 0;

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur px-6 py-3.5 flex items-center justify-between text-gray-900 dir-rtl">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
          H
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-tight text-gray-900">
              Hermes Cloud Gateway
            </h1>
            <span className="px-2.5 py-0.5 text-[10px] font-mono font-semibold rounded-full bg-gray-100 text-gray-600 border border-gray-200">
              v1.0.0 Prod
            </span>
          </div>
          <p className="text-[11px] text-gray-500 font-normal mt-0.5">
            درگاه ابری و روتر هوشمند مدیریت ایجنت Hermes
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Gateway Health Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-medium">
          {isHealthy ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-emerald-700 font-semibold">سرویس فعال</span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-rose-500"></span>
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <span className="text-rose-600 font-semibold">کلید فعال یافت نشد</span>
            </>
          )}
        </div>

        {/* Key Pool Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-700">
          <Key className="w-3.5 h-3.5 text-gray-400" />
          <span>مخزن کلیدها:</span>
          <span className="font-mono font-bold text-blue-600">{activeKeys} فعال</span>
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-900 border border-gray-200 transition-colors disabled:opacity-50"
          title="به‌روزرسانی داده‌ها"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
        </button>

        {/* Auth Lock Button */}
        <button
          onClick={onOpenLogin}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            isAuthenticated
              ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
              : 'bg-gray-900 border-gray-900 text-white hover:bg-gray-800'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>{isAuthenticated ? 'احراز هویت شده' : 'ورود مدیریت'}</span>
        </button>
      </div>
    </header>
  );
};
