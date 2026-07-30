import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Shield, Lock, Mail, User, Key, CheckCircle, AlertCircle, LogOut, RefreshCw, Layers } from 'lucide-react';

export interface UserAuthStatus {
  session: any | null;
  profile: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    is_approved: boolean;
  } | null;
  isLoading: boolean;
}

interface AuthGatewayProps {
  onAuthChange: (status: UserAuthStatus) => void;
  children: React.ReactNode;
  userStatus: UserAuthStatus;
  onLogout: () => void;
}

export const AuthGateway: React.FC<AuthGatewayProps> = ({
  onAuthChange,
  children,
  userStatus,
  onLogout,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check auth session on load and listen to auth state changes
  useEffect(() => {
    let mounted = true;

    const checkSessionAndProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.user) {
          if (mounted) {
            onAuthChange({ session: null, profile: null, isLoading: false });
          }
          return;
        }

        // Fetch profile from user_profiles table
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('email', session.user.email)
          .maybeSingle();

        if (error) {
          console.warn('Profile fetch warning:', error.message);
        }

        let userProfile = profile;

        // If no profile row exists, auto-create one
        if (!userProfile) {
          const isMasterAdmin = session.user.email?.toLowerCase() === 'raadtaxi1@gmail.com';
          const newProfile = {
            id: session.user.id,
            email: session.user.email || '',
            full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'کاربر سیستم',
            role: isMasterAdmin ? 'admin' : 'trader',
            is_approved: isMasterAdmin ? true : false,
          };

          await supabase.from('user_profiles').upsert(newProfile);
          userProfile = newProfile;
        }

        if (mounted) {
          onAuthChange({
            session,
            profile: userProfile,
            isLoading: false,
          });
        }
      } catch (err: any) {
        console.error('Auth verification error:', err);
        if (mounted) {
          onAuthChange({ session: null, profile: null, isLoading: false });
        }
      }
    };

    checkSessionAndProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        checkSessionAndProfile();
      } else if (event === 'SIGNED_OUT') {
        if (mounted) {
          onAuthChange({ session: null, profile: null, isLoading: false });
        }
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('email', session.user.email)
          .maybeSingle();

        if (profile) {
          onAuthChange({
            session,
            profile,
            isLoading: false,
          });
          if (profile.is_approved) {
            setSuccessMsg('دسترسی شما تایید شد! در حال انتقال...');
          } else {
            setErrorMsg('حساب شما هنوز توسط مدیر تایید نشده است.');
          }
        }
      }
    } catch (err: any) {
      console.error('Refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    if (!email || !password) {
      setErrorMsg('لطفاً تمامی فیلدهای الزامی را وارد نمایید.');
      setIsSubmitting(false);
      return;
    }

    try {
      if (mode === 'register') {
        if (password.length < 6) {
          setErrorMsg('رمز عبور باید حداقل ۶ کاراکتر باشد.');
          setIsSubmitting(false);
          return;
        }

        // Supabase Auth Sign Up
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim() || email.split('@')[0],
            },
          },
        });

        if (error) {
          // If user already registered or error
          if (error.message.includes('already registered')) {
            setErrorMsg('این ایمیل قبلاً در سیستم ثبت‌نام شده است. لطفاً وارد شوید.');
          } else {
            setErrorMsg(error.message);
          }
          setIsSubmitting(false);
          return;
        }

        const isMasterAdmin = email.trim().toLowerCase() === 'raadtaxi1@gmail.com';
        const userObj = data.user;

        if (userObj) {
          // Create profile record in user_profiles
          await supabase.from('user_profiles').upsert({
            id: userObj.id,
            email: email.trim(),
            full_name: fullName.trim() || email.split('@')[0],
            role: isMasterAdmin ? 'admin' : 'trader',
            is_approved: isMasterAdmin ? true : false,
          });
        }

        setSuccessMsg(
          isMasterAdmin
            ? 'ثبت‌نام مدیر اصلی با موفقیت انجام شد. در حال ورود...'
            : 'ثبت‌نام با موفقیت انجام شد. حساب شما در انتظار تایید مدیر اصلی سیستم قرار گرفت.'
        );

        // Auto sign in after sign up
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (!signInErr && signInData.session) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('email', email.trim())
            .maybeSingle();

          onAuthChange({
            session: signInData.session,
            profile: profile || {
              id: userObj?.id || 'usr_1',
              email: email.trim(),
              full_name: fullName.trim() || email.split('@')[0],
              role: isMasterAdmin ? 'admin' : 'trader',
              is_approved: isMasterAdmin ? true : false,
            },
            isLoading: false,
          });
        }
      } else {
        // Mode: Login
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          setErrorMsg('ایمیل یا رمز عبور نامعتبر است.');
          setIsSubmitting(false);
          return;
        }

        if (data.session) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('email', email.trim())
            .maybeSingle();

          onAuthChange({
            session: data.session,
            profile: profile || {
              id: data.user.id,
              email: email.trim(),
              full_name: data.user.user_metadata?.full_name || email.split('@')[0],
              role: email.trim().toLowerCase() === 'raadtaxi1@gmail.com' ? 'admin' : 'trader',
              is_approved: email.trim().toLowerCase() === 'raadtaxi1@gmail.com' ? true : false,
            },
            isLoading: false,
          });
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در ارتباط با سرور احراز هویت.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading spinner state
  if (userStatus.isLoading) {
    return (
      <div dir="rtl" className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-semibold text-gray-300">در حال بررسی نشست احراز هویت Supabase...</p>
      </div>
    );
  }

  // Not logged in -> Show Login / Register Screen
  if (!userStatus.session) {
    return (
      <div dir="rtl" className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-slate-900 flex items-center justify-center p-4 selection:bg-blue-600 selection:text-white">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-900 to-slate-800 p-6 text-white text-center space-y-2 relative">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto shadow-lg text-white font-bold text-xl">
              H
            </div>
            <h1 className="text-lg font-bold tracking-tight">Hermes Cloud Gateway</h1>
            <p className="text-xs text-gray-300">سیستم احراز هویت و کنترل پلتفرم معامله‌گر</p>
          </div>

          {/* Form Content */}
          <div className="p-6 space-y-5">
            {/* Mode Switch Tabs */}
            <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl text-xs font-bold text-gray-700">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 rounded-lg transition-all ${
                  mode === 'login' ? 'bg-white text-blue-600 shadow-sm' : 'hover:text-gray-900'
                }`}
              >
                ورود به حساب کاربری
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-2 rounded-lg transition-all ${
                  mode === 'register' ? 'bg-white text-blue-600 shadow-sm' : 'hover:text-gray-900'
                }`}
              >
                ثبت‌نام کاربر جدید
              </button>
            </div>

            {/* Error & Success Messages */}
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    نام و نام خانوادگی
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute right-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="مثال: علی رضایی"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  آدرس ایمیل / جیمیل
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute right-3 top-2.5" />
                  <input
                    type="email"
                    placeholder="example@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-600 dir-ltr text-right"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  رمز عبور
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-gray-400 absolute right-3 top-2.5" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-600 dir-ltr text-right"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>در حال پردازش...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>{mode === 'login' ? 'ورود به سامانه' : 'ثبت نام و ایجاد حساب'}</span>
                  </>
                )}
              </button>
            </form>

            <p className="text-[11px] text-gray-500 text-center leading-relaxed pt-2 border-t border-gray-100">
              توجه: پس از ثبت‌نام، حساب کاربری شما جهت دسترسی کامل به سیستم نیازمند تایید مدیر اصلی (Admin) در دیتابیس Supabase می‌باشد.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Logged in, but NOT APPROVED -> Pending Admin Approval Screen
  if (userStatus.profile && !userStatus.profile.is_approved) {
    return (
      <div dir="rtl" className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-slate-900 flex items-center justify-center p-4 selection:bg-blue-600 selection:text-white">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden text-center">
          <div className="bg-amber-500 p-6 text-white space-y-2">
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center mx-auto text-white">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-base font-bold">حساب کاربری در انتظار تایید مدیر اصلی</h2>
            <p className="text-xs text-amber-100">دروازه امنیتی Supabase Auth & Gatekeeper</p>
          </div>

          <div className="p-6 space-y-5">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-right space-y-2 text-xs">
              <div className="flex justify-between border-b pb-2 border-gray-200">
                <span className="text-gray-500">نام و نشان:</span>
                <span className="font-bold text-gray-900">{userStatus.profile.full_name}</span>
              </div>
              <div className="flex justify-between border-b pb-2 border-gray-200">
                <span className="text-gray-500">ایمیل:</span>
                <span className="font-mono font-bold text-gray-800">{userStatus.profile.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">وضعیت دسترسی:</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                  ⏳ در انتظار تایید (is_approved = false)
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed text-right">
              حساب کاربری شما با موفقیت ایجاد شده است اما به دلیل استانداردهای امنیتی، دسترسی شما به پنل کنترل تا زمانی که مدیریت سیستم (پروفایل اصلی) تاییدیه را در دیتابیس ثبت نکند غیرفعال است.
            </p>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>بررسی مجدد وضعیت دسترسی</span>
              </button>

              <button
                onClick={onLogout}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>خروج از حساب</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Logged in AND APPROVED -> Render full application!
  return <>{children}</>;
};
