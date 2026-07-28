import React, { useState } from 'react';
import { Lock, ShieldCheck, AlertCircle, X } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (token: string) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        onLoginSuccess(data.token);
        setPassword('');
        onClose();
      } else {
        setErrorMsg(data.message || 'رمز عبور مدیریت نادرست است.');
      }
    } catch (err) {
      setErrorMsg('خطا در برقراری ارتباط با سرور.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 dir-rtl text-gray-900">
      <div className="bg-white border border-gray-200 rounded-xl max-w-md w-full p-6 space-y-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-gray-900">ورود مدیریت به Hermes Control Panel</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed">
          برای دسترسی به تنظیمات حساس روتر و مدیریت کلیدها، لطفاً رمز عبور مدیریت (<code className="text-blue-600 font-bold">ADMIN_SECRET</code>) را وارد کنید.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              رمز عبور مدیریت:
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white border border-gray-200 rounded-md px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isLoading || !password}
              className="px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors shadow-sm disabled:opacity-50"
            >
              {isLoading ? 'درحال بررسی...' : 'ورود و احراز هویت'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
