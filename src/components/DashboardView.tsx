import React from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Key,
  Layers,
  Zap,
  ArrowUpRight,
  Database,
} from 'lucide-react';
import { ServerState, RequestLog } from '../types';

interface DashboardViewProps {
  state: ServerState | null;
  onNavigate: (tab: 'models' | 'router' | 'logs' | 'playground') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ state, onNavigate }) => {
  if (!state) {
    return (
      <div className="p-8 text-center text-zinc-400">
        درحال بارگذاری وضعیت سیستم...
      </div>
    );
  }

  const { stats, settings, keyPool, logs } = state;
  const defaultModel = state.models.find((m) => m.id === settings.defaultModelId) || state.models[0];
  const successRate =
    stats.totalRequests > 0
      ? Math.round((stats.successfulRequests / stats.totalRequests) * 100)
      : 100;

  const recentLogs = logs.slice(0, 5);

  return (
    <div className="p-2 sm:p-6 space-y-6 dir-rtl text-gray-900">
      {/* Top Banner Overview */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-xl bg-white border border-gray-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h2 className="text-base font-bold text-gray-900">کنترل پنل Cloud Gateway برای Hermes Agent</h2>
          </div>
          <p className="text-xs text-gray-500">
            روتر هوشمند آماده مسیریابی درخواست‌ها، مدیریت سهمیه، چرخش کلیدها و Failover خودکار است.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate('playground')}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors shadow-sm"
          >
            <Zap className="w-4 h-4" />
            <span>تست زنده روتر</span>
          </button>
          <button
            onClick={() => onNavigate('router')}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium text-xs border border-gray-200 transition-colors"
          >
            <Layers className="w-4 h-4 text-gray-500" />
            <span>تنظیمات روتر</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Requests */}
        <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>کل درخواست‌های واقعی</span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900">
              {stats.totalRequests.toLocaleString('fa-IR')}
            </span>
            <span className="text-xs text-gray-400 font-sans">درخواست</span>
          </div>
          <div className="text-[11px] text-gray-400 flex items-center justify-between pt-2 border-t border-gray-100">
            <span>موفق: {stats.successfulRequests}</span>
            <span>خطا: {stats.failedRequests}</span>
          </div>
        </div>

        {/* Success Rate */}
        <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>نرخ موفقیت (Success Rate)</span>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-green-600">
              %{successRate.toLocaleString('fa-IR')}
            </span>
            <span className="text-xs text-gray-400 font-sans">پایداری</span>
          </div>
          <div className="text-[11px] text-gray-400 flex items-center justify-between pt-2 border-t border-gray-100">
            <span>بازگشت خودکار (Fallback): {stats.fallbackRequests}</span>
          </div>
        </div>

        {/* Avg Latency */}
        <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>میانگین تاخیر (Latency)</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900">
              {stats.avgLatencyMs > 0 ? stats.avgLatencyMs.toLocaleString('fa-IR') : '۰'}
            </span>
            <span className="text-xs text-gray-400 font-sans">ms</span>
          </div>
          <div className="text-[11px] text-gray-400 flex items-center justify-between pt-2 border-t border-gray-100">
            <span>زمان پاسخ‌دهی شبکه</span>
          </div>
        </div>

        {/* Active Keys */}
        <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>کلیدهای فعال مخزن</span>
            <Key className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-gray-900">
              {keyPool.filter((k) => k.status === 'active').length.toLocaleString('fa-IR')}
            </span>
            <span className="text-xs text-gray-400 font-sans">از {keyPool.length}</span>
          </div>
          <div className="text-[11px] text-gray-400 flex items-center justify-between pt-2 border-t border-gray-100">
            <span>استراتژی: {settings.strategy === 'round-robin' ? 'چرخشی' : settings.strategy === 'failover' ? 'جایگزینی' : 'اولویت'}</span>
          </div>
        </div>
      </div>

      {/* Configuration Summary Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Model Status */}
        <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-gray-900">مدل پیش‌فرض فعال</h3>
            </div>
            <button
              onClick={() => onNavigate('models')}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
            >
              <span>تغییر مدل‌ها</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">نام مدل:</span>
              <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                {defaultModel.name} ({defaultModel.id})
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">سرویس‌دهنده:</span>
              <span className="text-xs font-semibold text-gray-700 capitalize">
                {defaultModel.provider}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">حداکثر توکن خروجی:</span>
              <span className="text-xs font-mono text-gray-700">
                {defaultModel.maxOutputTokens.toLocaleString('fa-IR')} token
              </span>
            </div>

            <div className="p-3 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-500 leading-relaxed">
              {defaultModel.description}
            </div>
          </div>
        </div>

        {/* Fallback Chain Overview */}
        <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-gray-900">ترتیب اولویت جایگزینی (Fallback Chain)</h3>
            </div>
            <button
              onClick={() => onNavigate('router')}
              className="text-xs text-amber-600 hover:underline flex items-center gap-1 font-medium"
            >
              <span>تنظیم اولویت‌ها</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {settings.fallbackChain.map((modelId, index) => {
              const model = state.models.find((m) => m.id === modelId);
              return (
                <div
                  key={modelId}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-gray-200 text-gray-600 font-mono font-bold flex items-center justify-center text-[10px]">
                      {index + 1}
                    </span>
                    <span className="font-mono font-semibold text-gray-800">
                      {model?.name || modelId}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400 font-mono">
                    {modelId}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Requests Table */}
      <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-gray-900">آخرین درخواست‌های ثبت‌شده در Gateway</h3>
          </div>
          {logs.length > 0 && (
            <button
              onClick={() => onNavigate('logs')}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
            >
              <span>مشاهده تمام لاگ‌ها</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {recentLogs.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center mx-auto text-gray-400">
              <Activity className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-gray-700">هیچ درخواستی هنوز ثبت نشده است</p>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              هنگامی که Hermes Agent یا کلاینت شما اولین درخواست را به مسیر <code className="text-blue-600 font-bold">/api/v1/chat/completions</code> ارسال کند، جزئیات در این بخش نمایش داده می‌شود.
            </p>
            <button
              onClick={() => onNavigate('playground')}
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors shadow-sm"
            >
              ارسال درخواست تست
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-xs">
                  <th className="pb-3 font-medium">زمان</th>
                  <th className="pb-3 font-medium">ایجنت</th>
                  <th className="pb-3 font-medium">مدل درخواستی</th>
                  <th className="pb-3 font-medium">مدل استفاده‌شده</th>
                  <th className="pb-3 font-medium">کلید</th>
                  <th className="pb-3 font-medium">تاخیر</th>
                  <th className="pb-3 font-medium">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-700">
                {recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 font-mono text-[11px] text-gray-500">
                      {new Date(log.timestamp).toLocaleTimeString('fa-IR')}
                    </td>
                    <td className="py-3 font-medium text-gray-900">{log.agentName}</td>
                    <td className="py-3 font-mono text-gray-500">{log.requestedModel}</td>
                    <td className="py-3 font-mono text-blue-600 font-semibold">{log.actualModel}</td>
                    <td className="py-3 font-mono text-gray-500">#{log.keyIndex}</td>
                    <td className="py-3 font-mono text-amber-600">{log.latencyMs} ms</td>
                    <td className="py-3">
                      {log.status === 'success' && (
                        <span className="px-2 py-1 rounded text-xs font-bold text-green-600 bg-green-50">
                          200 OK
                        </span>
                      )}
                      {log.status === 'fallback_success' && (
                        <span className="px-2 py-1 rounded text-xs font-bold text-yellow-600 bg-yellow-50">
                          FAILOVER
                        </span>
                      )}
                      {log.status === 'error' && (
                        <span className="px-2 py-1 rounded text-xs font-bold text-red-600 bg-red-50">
                          ERROR {log.statusCode}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
