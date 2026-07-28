import React, { useState } from 'react';
import { FileText, Trash2, Search, Eye, Filter, CheckCircle2, AlertTriangle, Clock, X } from 'lucide-react';
import { RequestLog, ServerState } from '../types';

interface LogsViewProps {
  state: ServerState | null;
  onClearLogs: () => Promise<void>;
}

export const LogsView: React.FC<LogsViewProps> = ({ state, onClearLogs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'fallback_success' | 'error'>('all');
  const [selectedLog, setSelectedLog] = useState<RequestLog | null>(null);

  const logs = state?.logs || [];

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.agentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.requestedModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actualModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userPromptSnippet.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || log.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-2 sm:p-6 space-y-6 dir-rtl text-gray-900">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-gray-900">گزارش‌ها و لاگ‌های واقعی (Request Logs)</h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            مشاهده جزئیات کامل درخواست‌های دریافتی از Hermes Agent، تاخیر شبکه، مدل استفاده‌شده و بازرسی خطاها.
          </p>
        </div>

        {logs.length > 0 && (
          <button
            onClick={onClearLogs}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs border border-red-200 transition-colors shrink-0"
          >
            <Trash2 className="w-4 h-4" />
            <span>پاکسازی گزارش‌ها</span>
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="جستجو در ایجنت، مدل یا متن پرامپت..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-md pr-9 pl-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end text-xs">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-gray-500 font-medium">فیلتر وضعیت:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as unknown as typeof statusFilter)}
            className="bg-white border border-gray-200 rounded-md px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-blue-500"
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="success">موفق (200 OK)</option>
            <option value="fallback_success">جایگزین شده (Fallback)</option>
            <option value="error">خطا (Error)</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      {filteredLogs.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-white border border-gray-200 shadow-sm space-y-2">
          <p className="text-sm font-semibold text-gray-700">هیچ لاگی بر اساس فیلترهای انتخابی یافت نشد</p>
          <p className="text-xs text-gray-400">برای مشاهده لاگ‌ها، از بخش آزمایشگاه API یک درخواست تست بفرستید.</p>
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs">
                <tr>
                  <th className="p-3.5 font-medium">زمان</th>
                  <th className="p-3.5 font-medium">ایجنت</th>
                  <th className="p-3.5 font-medium">مدل درخواستی</th>
                  <th className="p-3.5 font-medium">مدل نهایی</th>
                  <th className="p-3.5 font-medium">کلید</th>
                  <th className="p-3.5 font-medium">تاخیر</th>
                  <th className="p-3.5 font-medium">توکن‌ها</th>
                  <th className="p-3.5 font-medium">وضعیت</th>
                  <th className="p-3.5 font-medium">جزئیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-700">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-3.5 font-mono text-[11px] text-gray-500">
                      {new Date(log.timestamp).toLocaleTimeString('fa-IR')}
                    </td>
                    <td className="p-3.5 font-semibold text-gray-900">{log.agentName}</td>
                    <td className="p-3.5 font-mono text-gray-500">{log.requestedModel}</td>
                    <td className="p-3.5 font-mono text-blue-600 font-semibold">{log.actualModel}</td>
                    <td className="p-3.5 font-mono text-gray-500">#{log.keyIndex}</td>
                    <td className="p-3.5 font-mono text-amber-600">{log.latencyMs} ms</td>
                    <td className="p-3.5 font-mono text-gray-500">{log.totalTokens} tkn</td>
                    <td className="p-3.5">
                      {log.status === 'success' && (
                        <span className="px-2 py-1 rounded text-xs font-bold text-green-600 bg-green-50">
                          200 OK
                        </span>
                      )}
                      {log.status === 'fallback_success' && (
                        <span className="px-2 py-1 rounded text-xs font-bold text-yellow-600 bg-yellow-50">
                          Fallback
                        </span>
                      )}
                      {log.status === 'error' && (
                        <span className="px-2 py-1 rounded text-xs font-bold text-red-600 bg-red-50">
                          Error {log.statusCode}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                        title="مشاهده جزئیات درخواست"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 dir-rtl">
          <div className="bg-white border border-gray-200 rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-gray-900">بازرسی دقیق درخواست ({selectedLog.id})</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-gray-400 block">ایجنت:</span>
                <span className="font-semibold text-gray-800">{selectedLog.agentName}</span>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-gray-400 block">زمان:</span>
                <span className="font-mono text-gray-700">{new Date(selectedLog.timestamp).toLocaleString('fa-IR')}</span>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-gray-400 block">مدل درخواستی:</span>
                <span className="font-mono text-gray-700">{selectedLog.requestedModel}</span>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-gray-400 block">مدل نهایی استفاده‌شده:</span>
                <span className="font-mono font-bold text-blue-600">{selectedLog.actualModel}</span>
              </div>
            </div>

            {selectedLog.errorDetails && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed font-mono">
                <span className="font-bold block mb-1">خطای رخ داده:</span>
                {selectedLog.errorDetails}
              </div>
            )}

            <div className="space-y-2 text-xs">
              <span className="text-gray-600 font-semibold block">پیش‌نمایش پرامپت کاربر:</span>
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-100 text-gray-800 leading-relaxed font-mono whitespace-pre-wrap">
                {selectedLog.userPromptSnippet || '—'}
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <span className="text-gray-600 font-semibold block">پاسخ تولیدشده روتر:</span>
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-100 text-gray-800 leading-relaxed font-mono whitespace-pre-wrap">
                {selectedLog.responseSnippet || '—'}
              </div>
            </div>

            <div className="pt-2 text-left">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold"
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
