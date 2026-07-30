import React from 'react';
import {
  LayoutDashboard,
  Cpu,
  SlidersHorizontal,
  Users,
  FileText,
  Terminal,
  BookOpen,
  Bot,
} from 'lucide-react';

export type TabType =
  | 'dashboard'
  | 'trading'
  | 'models'
  | 'router'
  | 'agents'
  | 'logs'
  | 'playground'
  | 'docs';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  logsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  logsCount,
}) => {
  const navItems: { id: TabType; label: string; icon: React.FC<{ className?: string }>; badge?: string | number }[] = [
    {
      id: 'dashboard',
      label: 'داشبورد اصلی',
      icon: LayoutDashboard,
    },
    {
      id: 'trading',
      label: 'سفیر MetaTrader (Agent App)',
      icon: Bot,
      badge: 'جدید',
    },
    {
      id: 'models',
      label: 'مدیریت مدل‌ها',
      icon: Cpu,
    },
    {
      id: 'router',
      label: 'تنظیمات روتر و کلیدها',
      icon: SlidersHorizontal,
    },
    {
      id: 'agents',
      label: 'مدیریت ایجنت‌ها',
      icon: Users,
    },
    {
      id: 'logs',
      label: 'گزارش‌ها و لاگ‌ها',
      icon: FileText,
      badge: logsCount > 0 ? logsCount : undefined,
    },
    {
      id: 'playground',
      label: 'تست زنده روتر (API)',
      icon: Terminal,
    },
    {
      id: 'docs',
      label: 'راهنمای اتصال و Deploy',
      icon: BookOpen,
    },
  ];

  return (
    <aside className="w-64 border-l border-gray-200 bg-white p-4 flex flex-col justify-between shrink-0 dir-rtl text-gray-700">
      <div className="space-y-5">
        <div className="px-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            منوی کنترل پنل
          </p>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-blue-600' : 'text-gray-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      isActive
                        ? 'bg-blue-200/60 text-blue-800'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Gateway Info Banner */}
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 font-medium">پروتکل خروجی:</span>
          <span className="text-blue-600 font-mono font-bold">OpenAI API</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 font-medium">مسیر Endpoint:</span>
          <span className="text-gray-700 font-mono text-[11px]">/api/v1/chat</span>
        </div>
        <div className="pt-2 border-t border-gray-200 text-[11px] text-gray-400 leading-relaxed">
          آماده دریافت درخواست مستقیم از Hermes Agent بدون تغییر متغیرهای محلی.
        </div>
      </div>
    </aside>
  );
};
