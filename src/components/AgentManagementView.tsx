import React, { useState } from 'react';
import { Users, Plus, Save, Trash2, Key, Copy, CheckCircle2, Shield, FileText } from 'lucide-react';
import { AgentProfile, ServerState } from '../types';

interface AgentManagementViewProps {
  state: ServerState | null;
  onSaveAgents: (agents: AgentProfile[]) => Promise<void>;
}

export const AgentManagementView: React.FC<AgentManagementViewProps> = ({
  state,
  onSaveAgents,
}) => {
  const [agents, setAgents] = useState<AgentProfile[]>(state?.agents || []);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  React.useEffect(() => {
    if (state?.agents) {
      setAgents(state.agents);
    }
  }, [state]);

  const handleCopyToken = (token: string, agentId: string) => {
    navigator.clipboard.writeText(token);
    setCopiedTokenId(agentId);
    setTimeout(() => setCopiedTokenId(null), 2500);
  };

  const handleAddAgent = () => {
    const newId = `custom-agent-${Date.now().toString(36)}`;
    const newAgent: AgentProfile = {
      id: newId,
      name: 'ایجنت جدید Hermes',
      roleTitle: 'نقش تخصصی ایجنت',
      description: 'توضیحات کوتاه درباره حیطه فعالیت این ایجنت',
      systemPrompt: 'شما یک دستیار هوشمند و متخصص هستید.',
      apiKeyToken: `hermes-tk-${Math.random().toString(36).slice(2, 8)}`,
      isEnabled: true,
      createdAt: new Date().toISOString(),
      requestCount: 0,
    };
    setAgents((prev) => [...prev, newAgent]);
  };

  const handleUpdateAgent = (id: string, field: keyof AgentProfile, value: unknown) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
  };

  const handleDeleteAgent = (id: string) => {
    if (confirm('آیا از حذف این ایجنت اطمینان دارید؟')) {
      setAgents((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onSaveAgents(agents);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save agents:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-2 sm:p-6 space-y-6 dir-rtl text-gray-900">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-gray-900">مدیریت ایجنت‌ها (Agent Profiles)</h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            تعریف ایجنت‌های تخصصی (Teacher, Trading, Content, Research) همراه با توکن اختصاصی و دستورالعمل سیستم (System Prompt Overlay).
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleAddAgent}
            className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold text-xs border border-gray-200 transition-colors"
          >
            <Plus className="w-4 h-4 text-blue-600" />
            <span>افزودن ایجنت جدید</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors shadow-sm disabled:opacity-50"
          >
            {saveSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>ذخیره شد!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'درحال ذخیره...' : 'ذخیره ایجنت‌ها'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Agents List */}
      <div className="grid grid-cols-1 gap-6">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <input
                    type="text"
                    value={agent.name}
                    onChange={(e) => handleUpdateAgent(agent.id, 'name', e.target.value)}
                    className="bg-transparent text-sm font-bold text-gray-900 border-b border-transparent focus:border-blue-500 focus:outline-none px-1"
                  />
                  <input
                    type="text"
                    value={agent.roleTitle}
                    onChange={(e) => handleUpdateAgent(agent.id, 'roleTitle', e.target.value)}
                    className="block text-xs text-gray-500 border-b border-transparent focus:border-blue-500 focus:outline-none px-1 mt-0.5"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-left text-xs text-gray-400 font-mono">
                  درخواست‌ها: <span className="text-blue-600 font-bold">{agent.requestCount}</span>
                </div>
                <button
                  onClick={() => handleDeleteAgent(agent.id)}
                  className="p-2 rounded-md bg-gray-50 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-200 transition-colors"
                  title="حذف ایجنت"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Token & System Prompt */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center justify-between">
                  <span>توکن احراز هویت اختصاصی (Bearer Token):</span>
                  <button
                    onClick={() => handleCopyToken(agent.apiKeyToken, agent.id)}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-mono"
                  >
                    {copiedTokenId === agent.id ? (
                      <span className="text-blue-700 font-semibold">کپی شد!</span>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>کپی توکن</span>
                      </>
                    )}
                  </button>
                </label>
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={agent.apiKeyToken}
                    onChange={(e) => handleUpdateAgent(agent.id, 'apiKeyToken', e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-md px-3.5 py-2 text-xs font-mono text-blue-700 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-gray-400" />
                  <span>تزریق پرامپت سیستمی (System Prompt Overlay):</span>
                </label>
                <textarea
                  rows={3}
                  value={agent.systemPrompt}
                  onChange={(e) => handleUpdateAgent(agent.id, 'systemPrompt', e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-md p-3 text-xs text-gray-800 leading-relaxed focus:outline-none focus:border-blue-500"
                  placeholder="دستورالعمل سیستمی که به درخواست‌های این ایجنت اضافه می‌شود..."
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
