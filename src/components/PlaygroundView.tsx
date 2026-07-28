import React, { useState } from 'react';
import { Terminal, Send, Cpu, Users, Zap, Clock, Key, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { ChatCompletionResponse, ServerState } from '../types';

interface PlaygroundViewProps {
  state: ServerState | null;
  onRefreshState: () => void;
}

export const PlaygroundView: React.FC<PlaygroundViewProps> = ({
  state,
  onRefreshState,
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    state?.agents[0]?.id || 'teacher-agent'
  );
  const [selectedModelId, setSelectedModelId] = useState<string>(
    state?.settings.defaultModelId || 'gemini-3.6-flash'
  );
  const [prompt, setPrompt] = useState(
    'سلام Hermes! نحوه کارکرد سیستم Smart Fallback و چرخش کلیدها در این Cloud Gateway را برام توضیح بده.'
  );

  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<ChatCompletionResponse | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const agents = state?.agents || [];
  const models = state?.models.filter((m) => m.isEnabled) || [];
  const activeAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  const handleSendTestRequest = async () => {
    if (!prompt.trim()) return;

    setIsLoading(true);
    setResponse(null);
    setErrorDetails(null);

    try {
      const res = await fetch('/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeAgent?.apiKeyToken || ''}`,
          'X-Agent-ID': activeAgent?.id || '',
        },
        body: JSON.stringify({
          model: selectedModelId,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorDetails(data.error?.message || data.error?.details || 'خطا در ارسال درخواست به Gateway');
      } else {
        setResponse(data);
        onRefreshState();
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setErrorDetails(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-2 sm:p-6 space-y-6 dir-rtl text-gray-900">
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-gray-900">آزمایشگاه تست زنده روتر (Live API Tester)</h2>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          ارسال مستقیم درخواست تست به مسیر استاندارد <code className="text-blue-600 font-bold">/api/v1/chat/completions</code> و بازرسی عملکرد روتر.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Configuration Panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <Users className="w-4 h-4 text-blue-600" />
              <span>انتخاب ایجنت فراخواننده</span>
            </h3>

            <div className="space-y-2">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedAgentId === agent.id
                      ? 'bg-blue-50 border-blue-500 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-gray-900">
                    <span>{agent.name}</span>
                    <span className="text-[10px] font-mono text-gray-500">{agent.roleTitle}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-100">
              <label className="block text-xs font-semibold text-gray-600">
                مدل درخواستی (Requested Model):
              </label>
              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-md px-3.5 py-2 text-xs font-mono text-gray-800 focus:outline-none focus:border-blue-500"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 pt-2">
              <label className="block text-xs font-semibold text-gray-600">
                متن پرامپت (Prompt Text):
              </label>
              <textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-md p-3 text-xs text-gray-800 leading-relaxed focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleSendTestRequest}
              disabled={isLoading || !prompt.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors shadow-sm disabled:opacity-50"
            >
              {isLoading ? (
                <span>درحال مسیریابی و اجرای درخواست...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>ارسال درخواست تست به روتر</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Router Output Panel */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm min-h-[420px] flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-gray-900">پاسخ تولیدشده توسط Hermes Gateway</h3>
                </div>

                {response?.hermes_meta && (
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="px-2 py-0.5 rounded text-xs font-bold text-green-600 bg-green-50 border border-green-100">
                      Key #{response.hermes_meta.key_index}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100">
                      {response.hermes_meta.latency_ms} ms
                    </span>
                  </div>
                )}
              </div>

              {isLoading && (
                <div className="py-20 text-center space-y-3">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs text-gray-500">درحال ارسال به Gemini و پردازش در روتر...</p>
                </div>
              )}

              {errorDetails && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-red-800">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span>خطا در پاسخ‌دهی روتر:</span>
                  </div>
                  <p className="font-mono leading-relaxed">{errorDetails}</p>
                </div>
              )}

              {response && (
                <div className="space-y-4">
                  {/* Hermes Gateway Metadata Badge */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <span className="text-gray-400 block text-[10px]">مدل نهایی:</span>
                      <span className="text-blue-600 font-bold">{response.model}</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <span className="text-gray-400 block text-[10px]">تاخیر پاسخ:</span>
                      <span className="text-amber-600 font-bold">{response.hermes_meta?.latency_ms} ms</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <span className="text-gray-400 block text-[10px]">تعداد تلاش‌ها:</span>
                      <span className="text-sky-600 font-bold">{response.hermes_meta?.attempts}</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                      <span className="text-gray-400 block text-[10px]">کل توکن‌ها:</span>
                      <span className="text-gray-800 font-bold">{response.usage.total_tokens} tkn</span>
                    </div>
                  </div>

                  {/* Text Content Output */}
                  <div className="p-4 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-800 leading-relaxed font-sans whitespace-pre-wrap">
                    {response.choices[0]?.message?.content}
                  </div>
                </div>
              )}

              {!isLoading && !response && !errorDetails && (
                <div className="py-20 text-center space-y-2 text-gray-400">
                  <Terminal className="w-8 h-8 mx-auto opacity-40 text-gray-400" />
                  <p className="text-xs">پرامپت خود را بنویسید و روی دکمه ارسال کلیک کنید.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
