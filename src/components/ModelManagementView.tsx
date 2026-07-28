import React, { useState } from 'react';
import { Cpu, Save, CheckCircle2, Sliders, ToggleLeft, ToggleRight, Info } from 'lucide-react';
import { ModelConfig, ServerState } from '../types';

interface ModelManagementViewProps {
  state: ServerState | null;
  onSaveModels: (models: ModelConfig[]) => Promise<void>;
}

export const ModelManagementView: React.FC<ModelManagementViewProps> = ({
  state,
  onSaveModels,
}) => {
  const [models, setModels] = useState<ModelConfig[]>(state?.models || []);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state if prop changes
  React.useEffect(() => {
    if (state?.models) {
      setModels(state.models);
    }
  }, [state]);

  const handleToggleEnable = (id: string) => {
    setModels((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isEnabled: !m.isEnabled } : m))
    );
  };

  const handleSetDefault = (id: string) => {
    setModels((prev) =>
      prev.map((m) => ({ ...m, isDefault: m.id === id, isEnabled: m.id === id ? true : m.isEnabled }))
    );
  };

  const handleChangeParam = (
    id: string,
    field: keyof ModelConfig,
    value: unknown
  ) => {
    setModels((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onSaveModels(models);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save models:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-2 sm:p-6 space-y-6 dir-rtl text-gray-900">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-gray-900">مدیریت مدل‌های هوش مصنوعی</h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            فعال یا غیرفعال‌سازی مدل‌ها، تعیین مدل پیش‌فرض و تنظیم پارامترهای هر مدل.
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
              <span>{isSaving ? 'درحال ذخیره...' : 'ذخیره تغییرات مدل‌ها'}</span>
            </>
          )}
        </button>
      </div>

      {/* Model Cards List */}
      <div className="space-y-4">
        {models.map((model) => (
          <div
            key={model.id}
            className={`p-5 rounded-xl border transition-all ${
              model.isEnabled
                ? 'bg-white border-gray-200 shadow-sm'
                : 'bg-gray-50 border-gray-200 opacity-60'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => handleToggleEnable(model.id)}
                  className="text-gray-400 hover:text-blue-600 transition-colors mt-0.5"
                  title={model.isEnabled ? 'غیرفعال‌سازی مدل' : 'فعال‌سازی مدل'}
                >
                  {model.isEnabled ? (
                    <ToggleRight className="w-7 h-7 text-blue-600" />
                  ) : (
                    <ToggleLeft className="w-7 h-7 text-gray-400" />
                  )}
                </button>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-gray-900">{model.name}</h3>
                    <code className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      {model.id}
                    </code>
                    {model.isDefault && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                        مدل پیش‌فرض اصلی
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono capitalize bg-gray-100 text-gray-600">
                      {model.provider}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{model.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!model.isDefault && model.isEnabled && (
                  <button
                    onClick={() => handleSetDefault(model.id)}
                    className="px-3 py-1.5 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs border border-gray-200 transition-colors font-medium"
                  >
                    انتخاب به‌عنوان پیش‌فرض
                  </button>
                )}
              </div>
            </div>

            {/* Model Configuration Form */}
            {model.isEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    درجه حرارت (Temperature): {model.temperature}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={model.temperature}
                    onChange={(e) =>
                      handleChangeParam(model.id, 'temperature', parseFloat(e.target.value))
                    }
                    className="w-full accent-blue-600 bg-gray-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    حداکثر توکن خروجی (Max Tokens):
                  </label>
                  <input
                    type="number"
                    value={model.maxOutputTokens}
                    onChange={(e) =>
                      handleChangeParam(model.id, 'maxOutputTokens', parseInt(e.target.value) || 2048)
                    }
                    className="w-full bg-white border border-gray-200 rounded-md px-3 py-1.5 text-xs font-mono text-gray-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    اولویت در زنجیره Fallback (Rank):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={model.priorityRank}
                    onChange={(e) =>
                      handleChangeParam(model.id, 'priorityRank', parseInt(e.target.value) || 1)
                    }
                    className="w-full bg-white border border-gray-200 rounded-md px-3 py-1.5 text-xs font-mono text-gray-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex items-start gap-3 text-xs text-gray-600">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          تغییرات شما مستقیماً در روتر هوشمند اعمال شده و تمامی درخواست‌های جدید Hermes Agent از مدل‌ها و اولویت‌های تعیین‌شده استفاده خواهند کرد.
        </div>
      </div>
    </div>
  );
};
