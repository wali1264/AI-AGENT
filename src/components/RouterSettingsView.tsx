import React, { useState } from 'react';
import { SlidersHorizontal, Key, Layers, Save, CheckCircle2, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { RouterSettings, RouterStrategy, ServerState } from '../types';

interface RouterSettingsViewProps {
  state: ServerState | null;
  onSaveSettings: (settings: RouterSettings) => Promise<void>;
  onRefresh: () => void;
}

export const RouterSettingsView: React.FC<RouterSettingsViewProps> = ({
  state,
  onSaveSettings,
  onRefresh,
}) => {
  const [settings, setSettings] = useState<RouterSettings>(
    state?.settings || {
      strategy: 'round-robin',
      maxRetries: 3,
      timeoutMs: 30000,
      cooldownMinutes: 5,
      defaultModelId: 'gemini-3.6-flash',
      fallbackChain: ['gemini-3.6-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite'],
    }
  );

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  React.useEffect(() => {
    if (state?.settings) {
      setSettings(state.settings);
    }
  }, [state]);

  const handleStrategyChange = (strategy: RouterStrategy) => {
    setSettings((prev) => ({ ...prev, strategy }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onSaveSettings(settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const keyPool = state?.keyPool || [];

  return (
    <div className="p-2 sm:p-6 space-y-6 dir-rtl text-gray-900">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-gray-900">تنظیمات روتر و مخزن کلیدها</h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            تعیین روش چرخش کلیدها (Round Robin / Failover)، زمان تاخیر و زنجیره پشتیبان برای تداوم خدمت‌رسانی به Hermes Agent.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors shadow-sm disabled:opacity-50 shrink-0"
        >
          {saveSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>ذخیره شد!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'درحال ذخیره...' : 'ذخیره تنظیمات روتر'}</span>
            </>
          )}
        </button>
      </div>

      {/* Router Strategy Selection Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600" />
          <span>استراتژی چرخش کلیدهای API (Key Pool Strategy)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Round Robin */}
          <div
            onClick={() => handleStrategyChange('round-robin')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              settings.strategy === 'round-robin'
                ? 'bg-blue-50 border-blue-500 shadow-sm'
                : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-900">Round Robin (نوبتی)</span>
              <span
                className={`w-3.5 h-3.5 rounded-full border ${
                  settings.strategy === 'round-robin'
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-gray-300'
                }`}
              ></span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              توزیع یکنواخت درخواست‌ها بین کلیدهای فعال موجود به ترتیب چرخشی. بهترین گزینه برای تقسیم بار.
            </p>
          </div>

          {/* Failover */}
          <div
            onClick={() => handleStrategyChange('failover')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              settings.strategy === 'failover'
                ? 'bg-blue-50 border-blue-500 shadow-sm'
                : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-900">Failover (پشتیبان‌گیری)</span>
              <span
                className={`w-3.5 h-3.5 rounded-full border ${
                  settings.strategy === 'failover'
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-gray-300'
                }`}
              ></span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              استفاده همیشگی از کلید اول؛ در صورت بروز خطای Rate Limit یا سهمیه، سوئیچ خودکار به کلید بعدی.
            </p>
          </div>

          {/* Priority */}
          <div
            onClick={() => handleStrategyChange('priority')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              settings.strategy === 'priority'
                ? 'bg-blue-50 border-blue-500 shadow-sm'
                : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-900">Priority (اولویت ثابت)</span>
              <span
                className={`w-3.5 h-3.5 rounded-full border ${
                  settings.strategy === 'priority'
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-gray-300'
                }`}
              ></span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              ترجیح کلید بر اساس اولویت تنظیم‌شده؛ استفاده از کلید اصلی تا زمان بروز خطا.
            </p>
          </div>
        </div>
      </div>

      {/* Router Parameters */}
      <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <span>پارامترهای فنی روتر و مهلت درخواست‌ها</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              تعداد تلاش مجدد (Max Retries):
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={settings.maxRetries}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  maxRetries: parseInt(e.target.value) || 3,
                }))
              }
              className="w-full bg-white border border-gray-200 rounded-md px-3.5 py-2 text-xs font-mono text-gray-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              مدت زمان Cooldown کلیدهای مسدودشده (دقیقه):
            </label>
            <input
              type="number"
              min="1"
              max="60"
              value={settings.cooldownMinutes}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  cooldownMinutes: parseInt(e.target.value) || 5,
                }))
              }
              className="w-full bg-white border border-gray-200 rounded-md px-3.5 py-2 text-xs font-mono text-gray-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              حداکثر زمان انتظار پاسخ شبکه (Timeout ms):
            </label>
            <input
              type="number"
              min="5000"
              max="120000"
              step="1000"
              value={settings.timeoutMs}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  timeoutMs: parseInt(e.target.value) || 30000,
                }))
              }
              className="w-full bg-white border border-gray-200 rounded-md px-3.5 py-2 text-xs font-mono text-gray-800 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Multi-Key Pool Monitor Table */}
      <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-gray-900">وضعیت کلیدهای شناسایی‌شده در محیط (Environment Key Pool)</h3>
          </div>

          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-50 hover:bg-gray-100 text-xs text-gray-700 border border-gray-200 transition-colors font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>بررسی مجدد متغیرها</span>
          </button>
        </div>

        {keyPool.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="text-sm font-semibold text-gray-700">هیچ کلید API در متغیرهای محیطی یافت نشد</p>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              برای افزودن کلید، متغیرهای <code className="text-blue-600 font-bold">GEMINI_API_KEY</code> یا <code className="text-blue-600 font-bold">GEMINI_KEY_1</code> را در Vercel یا فایل <code className="text-blue-600 font-bold">.env</code> تنظیم کنید.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-xs">
                  <th className="pb-2.5 font-medium">شماره کلید</th>
                  <th className="pb-2.5 font-medium">نام متغیر محیطی</th>
                  <th className="pb-2.5 font-medium">نمایش ایمن کلید</th>
                  <th className="pb-2.5 font-medium">ارائه‌دهنده</th>
                  <th className="pb-2.5 font-medium">پاسخ موفق</th>
                  <th className="pb-2.5 font-medium">تعداد خطا</th>
                  <th className="pb-2.5 font-medium">وضعیت سلامت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-700">
                {keyPool.map((keyItem) => (
                  <tr key={keyItem.envVarName} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 font-mono font-bold text-blue-600">
                      Key #{keyItem.keyIndex}
                    </td>
                    <td className="py-3 font-mono text-gray-800">{keyItem.envVarName}</td>
                    <td className="py-3 font-mono text-gray-500">{keyItem.maskedKey}</td>
                    <td className="py-3 capitalize text-gray-700">{keyItem.provider}</td>
                    <td className="py-3 font-mono text-green-600 font-bold">{keyItem.successCount}</td>
                    <td className="py-3 font-mono text-red-600 font-bold">{keyItem.errorCount}</td>
                    <td className="py-3">
                      {keyItem.status === 'active' && (
                        <span className="px-2 py-1 rounded text-xs font-bold text-green-600 bg-green-50">
                          فعال و آماده
                        </span>
                      )}
                      {keyItem.status === 'cooldown' && (
                        <span className="px-2 py-1 rounded text-xs font-bold text-yellow-600 bg-yellow-50">
                          استراحت موقت (Cooldown)
                        </span>
                      )}
                      {keyItem.status === 'missing' && (
                        <span className="px-2 py-1 rounded text-xs font-bold text-red-600 bg-red-50">
                          مقداردهی‌نشده
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
