import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Activity,
  Code,
  Copy,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Bot,
  Zap,
  DollarSign,
  Globe,
  Sliders,
  Play,
  XCircle,
  FileCode,
  Lock,
  Database,
  UserCheck,
  UserX,
  UserPlus,
  Mail,
  Key,
  Shield,
  Layers,
} from 'lucide-react';
import { TradingState, RiskRule, TradeOrder } from '../types';
import { supabase } from '../lib/supabaseClient';

interface TradingAgentViewProps {
  adminToken?: string | null;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'trader' | 'user';
  is_approved: boolean;
  created_at: string;
}

export const TradingAgentView: React.FC<TradingAgentViewProps> = () => {
  const [tradingState, setTradingState] = useState<TradingState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const getDefaultMqlCode = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ais-dev-mq4z5cea2cgotxerixsswi-201312903929.europe-west2.run.app';
    return `//+------------------------------------------------------------------+
//|                                           Hermes_Bridge.mq5      |
//|                 Hermes Agent App - MetaTrader 5 Ambassador EA    |
//|                 https://ai.studio/build                          |
//+------------------------------------------------------------------+
#property copyright "Hermes Cloud Router Agent"
#property link      "${origin}"
#property version   "1.00"
#property description "ربات سفیر متاتریدر ۵ جهت ارتباط آنی با مغز ایجنت و روتر هرمس"

#include <Trade\\Trade.mqh>
CTrade trade;

//--- Input Parameters
input string   InpServerUrl     = "${origin}/api/trading/tick"; // آدرس API سفیر
input string   InpSecretToken   = "hermes-agent-token-2026";      // کلید امنیتی احراز هویت
input int      InpCheckInterval = 2;                             // فاصله زمانی چک کردن (ثانیه)
input string   InpDefaultSymbol = "XAUUSD";                       // نماد پیش‌فرض معامله

//--- Global Variables
datetime g_lastCheckTime = 0;

int OnInit()
{
   EventSetTimer(InpCheckInterval);
   Print("[Hermes Bridge] EA Started. Server Target: ", InpServerUrl);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("[Hermes Bridge] EA Stopped.");
}

void OnTimer()
{
   SendHeartbeatAndPollOrders();
}

void OnTick()
{
   if(TimeCurrent() - g_lastCheckTime >= InpCheckInterval)
   {
      SendHeartbeatAndPollOrders();
   }
}

void SendHeartbeatAndPollOrders()
{
   g_lastCheckTime = TimeCurrent();

   string symbol = _Symbol;
   if(symbol == "") symbol = InpDefaultSymbol;

   double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
   double spread = (double)SymbolInfoInteger(symbol, SYMBOL_SPREAD);

   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double margin = AccountInfoDouble(ACCOUNT_MARGIN);
   double freeMargin = AccountInfoDouble(ACCOUNT_FREEMARGIN);
   long accNum = AccountInfoInteger(ACCOUNT_LOGIN);
   string company = AccountInfoString(ACCOUNT_COMPANY);
   int openPosCount = PositionsTotal();

   string jsonPayload = StringFormat(
      "{\\"symbol\\":\\"%s\\",\\"ask\\":%.5f,\\"bid\\":%.5f,\\"spread\\":%.2f," +
      "\\"account\\":{\\"accountNumber\\":%d,\\"broker\\":\\"%s\\",\\"balance\\":%.2f,\\"equity\\":%.2f,\\"margin\\":%.2f,\\"freeMargin\\":%.2f,\\"openPositionsCount\\":%d}}"
      , symbol, ask, bid, spread, accNum, company, balance, equity, margin, freeMargin, openPosCount
   );

   char postData[];
   StringToCharArray(jsonPayload, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1);

   char resultData[];
   string resultHeaders;
   string headers = "Content-Type: application/json\\r\\nAuthorization: Bearer " + InpSecretToken + "\\r\\n";

   int res = WebRequest("POST", InpServerUrl, headers, 3000, postData, resultData, resultHeaders);

   if(res == 200)
   {
      string responseJson = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
      ParseAndExecuteOrders(responseJson);
   }
   else if(res == -1)
   {
      Print("[Hermes Bridge ERROR] WebRequest failed. Error Code: ", GetLastError());
   }
}

void ParseAndExecuteOrders(string jsonStr)
{
   if(StringFind(jsonStr, "\\"pendingOrders\\":") < 0) return;

   int pos = StringFind(jsonStr, "\\"id\\":\\"", 0);
   while(pos >= 0)
   {
      int startId = pos + 6;
      int endId = StringFind(jsonStr, "\\"", startId);
      string orderId = StringSubstr(jsonStr, startId, endId - startId);

      int typePos = StringFind(jsonStr, "\\"type\\":\\"", endId);
      int startType = typePos + 8;
      int endType = StringFind(jsonStr, "\\"", startType);
      string orderType = StringSubstr(jsonStr, startType, endType - startType);

      int lotPos = StringFind(jsonStr, "\\"lot\\":", endType);
      double lot = 0.01;
      if(lotPos > 0)
      {
         int endLot = StringFind(jsonStr, ",", lotPos);
         if(endLot < 0) endLot = StringFind(jsonStr, "}", lotPos);
         lot = StringToDouble(StringSubstr(jsonStr, lotPos + 6, endLot - (lotPos + 6)));
      }

      ExecuteSingleOrder(orderId, orderType, lot);
      pos = StringFind(jsonStr, "\\"id\\":\\"", endType);
   }
}

void ExecuteSingleOrder(string orderId, string typeStr, double lot)
{
   string symbol = _Symbol;
   if(symbol == "") symbol = InpDefaultSymbol;

   bool success = false;
   double price = 0;
   string errorMsg = "";

   if(typeStr == "BUY")
   {
      price = SymbolInfoDouble(symbol, SYMBOL_ASK);
      success = trade.Buy(lot, symbol, price, 0, 0, "Hermes Order " + orderId);
   }
   else if(typeStr == "SELL")
   {
      price = SymbolInfoDouble(symbol, SYMBOL_BID);
      success = trade.Sell(lot, symbol, price, 0, 0, "Hermes Order " + orderId);
   }
   else if(typeStr == "CLOSE_ALL")
   {
      for(int i = PositionsTotal() - 1; i >= 0; i--)
      {
         ulong ticket = PositionGetTicket(i);
         trade.PositionClose(ticket);
      }
      success = true;
      price = SymbolInfoDouble(symbol, SYMBOL_BID);
   }

   if(!success && typeStr != "CLOSE_ALL")
   {
      errorMsg = StringFormat("CTrade Error %d: %s", trade.ResultRetcode(), trade.ResultComment());
   }

   SendOrderResult(orderId, success ? "executed" : "failed", price, errorMsg);
}

void SendOrderResult(string orderId, string status, double price, string errorMsg)
{
   string resultUrl = StringFormat("%s/api/trading/order-result", "${origin}");
   string jsonPayload = StringFormat(
      "{\\"orderId\\":\\"%s\\",\\"status\\":\\"%s\\",\\"executionPrice\\":%.5f,\\"error\\":\\"%s\\"}",
      orderId, status, price, errorMsg
   );

   char postData[];
   StringToCharArray(jsonPayload, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1);

   char resultData[];
   string resultHeaders;
   string headers = "Content-Type: application/json\\r\\nAuthorization: Bearer " + InpSecretToken + "\\r\\n";

   WebRequest("POST", resultUrl, headers, 3000, postData, resultData, resultHeaders);
}
`;
  };

  const [mqlCode, setMqlCode] = useState<string>(getDefaultMqlCode());
  const [supabaseSql, setSupabaseSql] = useState<string>('');
  const [supabaseUrl, setSupabaseUrl] = useState<string>('https://dqhujeggbndwcavzgnhm.supabase.co');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'terminal' | 'rules' | 'supabase' | 'mql' | 'logs'>('terminal');

  // Supabase User Auth & Admin Approval State
  const [usersList, setUsersList] = useState<UserProfile[]>([
    {
      id: 'usr_admin_1',
      email: 'raadtaxi1@gmail.com',
      full_name: 'مدیر اصلی سیستم (Admin)',
      role: 'admin',
      is_approved: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'usr_trader_2',
      email: 'trader.demo@gmail.com',
      full_name: 'معامله‌گر نمونه',
      role: 'trader',
      is_approved: false,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ]);
  const [regEmail, setRegEmail] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regMessage, setRegMessage] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>({
    id: 'usr_admin_1',
    email: 'raadtaxi1@gmail.com',
    full_name: 'مدیر اصلی سیستم (Admin)',
    role: 'admin',
    is_approved: true,
    created_at: new Date().toISOString(),
  });

  // New Order Form state
  const [symbol, setSymbol] = useState('XAUUSD');
  const [orderType, setOrderType] = useState<'BUY' | 'SELL' | 'CLOSE_ALL'>('BUY');
  const [lot, setLot] = useState('0.01');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  // New Rule Form state
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleValue, setNewRuleValue] = useState('');
  const [newRuleUnit, setNewRuleUnit] = useState<RiskRule['unit']>('percentage');

  const fetchUsersFromSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        setUsersList(
          data.map((u: any) => ({
            id: u.id,
            email: u.email,
            full_name: u.full_name || u.email.split('@')[0],
            role: u.role || 'user',
            is_approved: !!u.is_approved,
            created_at: u.created_at,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to fetch users from Supabase:', err);
    }
  };

  const fetchTradingState = async () => {
    try {
      const res = await fetch('/api/trading/state');
      if (res.ok) {
        const data = await res.json();
        setTradingState(data);
      }
    } catch (err) {
      console.error('Failed to fetch trading state:', err);
    }
  };

  const fetchEaCode = async () => {
    try {
      const res = await fetch('/api/trading/ea-code');
      if (res.ok) {
        const data = await res.json();
        setMqlCode(data.code);
      }
    } catch (err) {
      console.error('Failed to fetch EA code:', err);
    }
  };

  const fetchSupabaseSql = async () => {
    try {
      const res = await fetch('/api/trading/supabase-sql');
      if (res.ok) {
        const data = await res.json();
        setSupabaseSql(data.sql);
        setSupabaseUrl(data.url);
        setSupabaseAnonKey(data.anonKey);
      }
    } catch (err) {
      console.error('Failed to fetch Supabase SQL:', err);
    }
  };

  useEffect(() => {
    fetchTradingState();
    fetchEaCode();
    fetchSupabaseSql();
    fetchUsersFromSupabase();
    const interval = setInterval(fetchTradingState, 2500); // Live poll every 2.5s
    return () => clearInterval(interval);
  }, []);

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail.trim()) return;

    const newId = `usr_${Date.now()}`;
    const newUser: UserProfile = {
      id: newId,
      email: regEmail,
      full_name: regFullName || regEmail.split('@')[0],
      role: 'user',
      is_approved: false, // Default is false pending admin approval
      created_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase.from('user_profiles').upsert({
        id: newId,
        email: regEmail,
        full_name: regFullName || regEmail.split('@')[0],
        role: 'user',
        is_approved: false,
      });
      if (error) {
        console.warn('Supabase profile registration note:', error.message);
      }
    } catch (err) {
      console.error('Registration error in Supabase:', err);
    }

    setUsersList((prev) => [newUser, ...prev.filter((u) => u.email !== regEmail)]);
    setRegMessage('ثبت‌نام با موفقیت انجام شد. حساب شما در انتظار تایید مدیر سیستم قرار گرفت.');
    setRegEmail('');
    setRegFullName('');
  };

  const handleToggleUserApproval = async (userId: string) => {
    const target = usersList.find((u) => u.id === userId);
    if (!target) return;
    const nextApproved = !target.is_approved;

    setUsersList((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_approved: nextApproved } : u))
    );

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_approved: nextApproved, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) {
        console.warn('Supabase approval toggle note:', error.message);
      }
    } catch (err) {
      console.error('Failed to toggle approval in Supabase:', err);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(supabaseSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // Handle Manual Order Submission
  const handleSendOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError(null);
    setOrderSuccess(null);

    try {
      const res = await fetch('/api/trading/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          type: orderType,
          lot: parseFloat(lot) || 0.01,
          sl: sl ? parseFloat(sl) : undefined,
          tp: tp ? parseFloat(tp) : undefined,
          source: 'user_manual',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setOrderError(data.error || 'خطا در ثبت سفارش');
      } else {
        setOrderSuccess(`سفارش ${orderType} با موفقیت در صف ارسال به MT5 قرار گرفت.`);
        fetchTradingState();
      }
    } catch (err: unknown) {
      setOrderError(err instanceof Error ? err.message : 'خطا در برقراری ارتباط با سرور');
    }
  };

  // Simulate Tick for testing when EA is offline
  const handleSimulateTick = async () => {
    try {
      const askPrice = 2650.50 + (Math.random() * 2 - 1);
      const bidPrice = askPrice - 0.30;
      await fetch('/api/trading/tick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'XAUUSD',
          ask: parseFloat(askPrice.toFixed(2)),
          bid: parseFloat(bidPrice.toFixed(2)),
          spread: 30,
          account: {
            accountNumber: 8849201,
            broker: 'Demo MT5 Broker',
            balance: 10000.00,
            equity: 10045.20,
            margin: 150.00,
            freeMargin: 9895.20,
            openPositionsCount: 1,
            currency: 'USD',
          },
        }),
      });
      fetchTradingState();
    } catch (err) {
      console.error('Error simulating tick:', err);
    }
  };

  // Toggle or Edit Risk Rule
  const handleToggleRule = async (ruleId: string) => {
    if (!tradingState) return;
    const updatedRules = tradingState.riskRules.map((r) =>
      r.id === ruleId ? { ...r, isEnabled: !r.isEnabled } : r
    );
    await saveRules(updatedRules);
  };

  const handleRuleValueChange = async (ruleId: string, newValue: string) => {
    if (!tradingState) return;
    const valNum = parseFloat(newValue);
    const updatedRules = tradingState.riskRules.map((r) =>
      r.id === ruleId ? { ...r, value: isNaN(valNum) ? newValue : valNum } : r
    );
    await saveRules(updatedRules);
  };

  const saveRules = async (rules: RiskRule[]) => {
    try {
      const res = await fetch('/api/trading/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      });
      if (res.ok) {
        fetchTradingState();
      }
    } catch (err) {
      console.error('Failed to save rules:', err);
    }
  };

  const handleAddCustomRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim() || !tradingState) return;

    const newRule: RiskRule = {
      id: `custom_${Date.now()}`,
      name: newRuleName,
      description: 'قانون سفارشی تعریف شده توسط کاربر',
      isEnabled: true,
      value: parseFloat(newRuleValue) || newRuleValue,
      unit: newRuleUnit,
    };

    const updatedRules = [...tradingState.riskRules, newRule];
    await saveRules(updatedRules);
    setNewRuleName('');
    setNewRuleValue('');
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(mqlCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const status = tradingState?.bridgeStatus;
  const tick = tradingState?.lastTick;
  const isConnected = status?.isConnected ?? false;

  return (
    <div className="space-y-6 dir-rtl text-gray-800">
      {/* Top Header & Ambassador Status Banner */}
      <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
              <Bot className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">سفیر MetaTrader 5 (Agent App)</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              اتصال ایجنت
            </span>
          </div>
          <p className="text-xs text-gray-5-00 text-gray-500 mr-9">
            مغز هوشمند تحلیل و معامله، ارتباط مستقیم با ربات Expert Advisor داخل متاتریدر بدون نیاز به لایبرری‌های سنگین
          </p>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border ${
              isConnected
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <span className="relative flex h-2.5 w-2.5">
              {isConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isConnected ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              ></span>
            </span>
            <span>
              {isConnected
                ? `سفیر متاتریدر متصل است (${status?.accountInfo?.broker || 'MT5'})`
                : 'در انتظار اتصال ربات MT5'}
            </span>
            {isConnected && status?.latencyMs && (
              <span className="text-[10px] opacity-75 font-mono">({status.latencyMs}ms)</span>
            )}
          </div>

          <button
            onClick={handleSimulateTick}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors"
            title="ارسال تیک آزمایشی جهت سنجش عملکرد سیستم"
          >
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span>تست تیک (Demo)</span>
          </button>
        </div>
      </div>

      {/* Account Metrics & Live Price Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Balance */}
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[11px] font-medium">موجودی (Balance)</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-base font-bold text-gray-900 font-mono">
            ${status?.accountInfo?.balance?.toLocaleString() ?? '0.00'}
          </p>
        </div>

        {/* Equity */}
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[11px] font-medium">ارزش حساب (Equity)</span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-base font-bold text-gray-900 font-mono">
            ${status?.accountInfo?.equity?.toLocaleString() ?? '0.00'}
          </p>
        </div>

        {/* Free Margin */}
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[11px] font-medium">مارجین آزاد</span>
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-base font-bold text-gray-900 font-mono">
            ${status?.accountInfo?.freeMargin?.toLocaleString() ?? '0.00'}
          </p>
        </div>

        {/* Open Positions */}
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[11px] font-medium">پوزیشن‌های باز</span>
            <Sliders className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-base font-bold text-gray-900 font-mono">
            {status?.accountInfo?.openPositionsCount ?? 0} پوزیشن
          </p>
        </div>

        {/* Live Symbol Ask */}
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[11px] font-medium">{tick?.symbol || 'XAUUSD'} (Ask)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-base font-bold text-emerald-600 font-mono">
            {tick?.ask ? tick.ask.toFixed(2) : '---.--'}
          </p>
        </div>

        {/* Live Symbol Bid */}
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[11px] font-medium">{tick?.symbol || 'XAUUSD'} (Bid)</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-base font-bold text-rose-600 font-mono">
            {tick?.bid ? tick.bid.toFixed(2) : '---.--'}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveSubTab('terminal')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeSubTab === 'terminal'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>ارسال سفارش و پایش زنده</span>
        </button>

        <button
          onClick={() => setActiveSubTab('rules')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeSubTab === 'rules'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>قوانین مدیریت ریسک و استراتژی</span>
        </button>

        <button
          onClick={() => setActiveSubTab('supabase')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeSubTab === 'supabase'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>پایگاه داده Supabase و احراز هویت</span>
        </button>

        <button
          onClick={() => setActiveSubTab('mql')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeSubTab === 'mql'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>کد ربات سفیر (MQL5 EA)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeSubTab === 'logs'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>حافظه و لاگ‌های ایجنت</span>
        </button>
      </div>

      {/* SUB-TAB 1: Terminal & Order Dispatcher */}
      {activeSubTab === 'terminal' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Panel */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Play className="w-4 h-4 text-blue-600" />
                <span>ارسال مستقیم سفارش به سفیر MT5</span>
              </h2>
            </div>

            {orderError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{orderError}</span>
              </div>
            )}

            {orderSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-start gap-2">
                <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{orderSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSendOrder} className="space-y-4">
              {/* Symbol & Order Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">نماد (Symbol)</label>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-500"
                    placeholder="XAUUSD"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">نوع سفارش</label>
                  <select
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="BUY">خرید (BUY)</option>
                    <option value="SELL">فروش (SELL)</option>
                    <option value="CLOSE_ALL">بستن همه پوزیشن‌ها (CLOSE ALL)</option>
                  </select>
                </div>
              </div>

              {/* Lot Size, SL, TP */}
              {orderType !== 'CLOSE_ALL' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">حجم معامله (Lot)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={lot}
                      onChange={(e) => setLot(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">حد ضرر (Stop Loss)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={sl}
                        onChange={(e) => setSl(e.target.value)}
                        placeholder="مثال: 2640.00"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">حد سود (Take Profit)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={tp}
                        onChange={(e) => setTp(e.target.value)}
                        placeholder="مثال: 2680.00"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className={`w-full py-2.5 rounded-lg text-xs font-bold text-white transition-colors flex items-center justify-center gap-2 ${
                  orderType === 'BUY'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : orderType === 'SELL'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>ارسال سفارش به صف اجرا ({orderType})</span>
              </button>
            </form>
          </div>

          {/* Pending Orders & Recent History */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-gray-900 flex items-center justify-between border-b pb-3 border-gray-100">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-600" />
                  <span>صف سفارشات در انتظار و تاریخچه اجرا</span>
                </span>
                <span className="text-xs text-gray-400 font-normal">
                  {tradingState?.pendingOrders.length || 0} در انتظار
                </span>
              </h2>

              {/* Pending Orders Table */}
              {tradingState?.pendingOrders && tradingState.pendingOrders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                        <th className="p-2.5">شناسه</th>
                        <th className="p-2.5">نماد</th>
                        <th className="p-2.5">نوع</th>
                        <th className="p-2.5">حجم</th>
                        <th className="p-2.5">SL / TP</th>
                        <th className="p-2.5">وضعیت</th>
                        <th className="p-2.5">منبع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {tradingState.pendingOrders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-gray-50 font-mono">
                          <td className="p-2.5 font-semibold text-gray-900">{ord.id}</td>
                          <td className="p-2.5 text-gray-700">{ord.symbol}</td>
                          <td className="p-2.5">
                            <span
                              className={`px-2 py-0.5 rounded font-bold ${
                                ord.type === 'BUY'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ord.type === 'SELL'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {ord.type}
                            </span>
                          </td>
                          <td className="p-2.5">{ord.lot}</td>
                          <td className="p-2.5 text-gray-500">
                            {ord.sl || '-'} / {ord.tp || '-'}
                          </td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              در صف MT5
                            </span>
                          </td>
                          <td className="p-2.5 text-gray-500 font-sans">
                            {ord.source === 'ai_agent'
                              ? '🤖 ایجنت'
                              : ord.source === 'telegram'
                              ? '📱 تلگرام'
                              : '👤 دستی'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
                  هیچ سفارشی معلقی در صف ارسال به متاتریدر وجود ندارد.
                </div>
              )}

              {/* History Table */}
              <div className="pt-3 border-t border-gray-100">
                <h3 className="text-xs font-bold text-gray-700 mb-2">معاملات اجرا شده اخیر</h3>
                {tradingState?.orderHistory && tradingState.orderHistory.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 border-b">
                          <th className="p-2">شناسه</th>
                          <th className="p-2">نوع</th>
                          <th className="p-2">قیمت اجرا</th>
                          <th className="p-2">زمان</th>
                          <th className="p-2">نتیجه</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {tradingState.orderHistory.slice(0, 5).map((ord) => (
                          <tr key={ord.id} className="font-mono text-[11px]">
                            <td className="p-2 text-gray-600">{ord.id}</td>
                            <td className="p-2 font-bold">{ord.type}</td>
                            <td className="p-2 text-emerald-700 font-semibold">
                              {ord.executionPrice ? ord.executionPrice.toFixed(2) : '-'}
                            </td>
                            <td className="p-2 text-gray-400">
                              {ord.executedAt ? new Date(ord.executedAt).toLocaleTimeString() : '-'}
                            </td>
                            <td className="p-2">
                              {ord.status === 'executed' ? (
                                <span className="text-emerald-600 font-semibold font-sans">✓ با موفقیت</span>
                              ) : (
                                <span className="text-rose-600 font-sans">{ord.error || 'خطا'}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">سابقه معامله‌ای ثبت نشده است.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: Risk Rules & Strategy */}
      {activeSubTab === 'rules' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-indigo-600" />
                  <span>مدیریت قوانین ریسک و استراتژی (قابل ویرایش توسط کاربر)</span>
                </h2>
                <p className="text-xs text-gray-500">
                  مغز هوشمند ایجنت هیچ‌گاه از این قوانین تخطی نمی‌کند. تغییرات بلافاصله اعمال می‌شوند.
                </p>
              </div>
            </div>

            {/* Rules List */}
            <div className="space-y-3">
              {tradingState?.riskRules.map((rule) => (
                <div
                  key={rule.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    rule.isEnabled
                      ? 'bg-white border-gray-200 shadow-sm'
                      : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={rule.isEnabled}
                      onChange={() => handleToggleRule(rule.id)}
                      className="mt-1 rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <div>
                      <h3 className="text-xs font-bold text-gray-900">{rule.name}</h3>
                      <p className="text-[11px] text-gray-500">{rule.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mr-7 md:mr-0">
                    <span className="text-xs text-gray-500 font-medium">مقدار قانون:</span>
                    <input
                      type="text"
                      value={rule.value}
                      onChange={(e) => handleRuleValueChange(rule.id, e.target.value)}
                      className="w-24 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-mono text-center font-bold text-gray-900 focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-gray-400 font-mono">
                      {rule.unit === 'percentage'
                        ? '%'
                        : rule.unit === 'lot'
                        ? 'Lot'
                        : rule.unit === 'boolean'
                        ? '(1=بله, 0=خیر)'
                        : 'USD'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Custom Rule Form */}
            <div className="pt-4 border-t border-gray-100">
              <h3 className="text-xs font-bold text-gray-700 mb-3">افزودن قانون سفارشی جدید</h3>
              <form onSubmit={handleAddCustomRule} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="عنوان قانون (مثلاً: عدم معامله در فاز خبر)"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-blue-500 md:col-span-2"
                  required
                />
                <input
                  type="text"
                  placeholder="مقدار قانون"
                  value={newRuleValue}
                  onChange={(e) => setNewRuleValue(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-blue-500"
                  required
                />
                <button
                  type="submit"
                  className="py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>ثبت قانون</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: Supabase Database & Auth Management */}
      {activeSubTab === 'supabase' && (
        <div className="space-y-6">
          {/* Connection Overview Card */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-3 border-gray-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-sm font-bold text-gray-900">پایگاه داده بلندمدت Supabase & Auth</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    متصل به پروژه
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  ذخیره‌سازی دائمی قوانین ریسک، سوابق معاملات، لاگ‌های هوش مصنوعی و مدیریت سطح دسترسی کاربران
                </p>
              </div>

              <button
                onClick={handleCopySql}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
              >
                {copiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedSql ? 'کوئری SQL کپی شد!' : 'کپی کامل کوئری ساخت جداول Supabase'}</span>
              </button>
            </div>

            {/* Live Connection Badges */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between">
                <span className="text-gray-500 font-sans">آدرس پروژه (Project URL):</span>
                <span className="font-bold text-gray-800">{supabaseUrl}</span>
              </div>

              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between">
                <span className="text-gray-500 font-sans">وضعیت همگام‌سازی:</span>
                <span className="flex items-center gap-1.5 text-emerald-600 font-bold font-sans">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  فعال (Live Sync Engine)
                </span>
              </div>
            </div>

            {/* Tables Overview Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg space-y-1">
                <div className="flex items-center justify-between text-indigo-700 font-bold text-xs">
                  <span>جدول risk_rules</span>
                  <Shield className="w-4 h-4" />
                </div>
                <p className="text-sm font-bold text-indigo-900 font-mono">
                  {tradingState?.riskRules.length || 0} قانون فعال
                </p>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg space-y-1">
                <div className="flex items-center justify-between text-blue-700 font-bold text-xs">
                  <span>جدول trade_orders</span>
                  <Zap className="w-4 h-4" />
                </div>
                <p className="text-sm font-bold text-blue-900 font-mono">
                  {(tradingState?.pendingOrders.length || 0) + (tradingState?.orderHistory.length || 0)} معامله
                </p>
              </div>

              <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg space-y-1">
                <div className="flex items-center justify-between text-purple-700 font-bold text-xs">
                  <span>جدول trading_logs</span>
                  <Activity className="w-4 h-4" />
                </div>
                <p className="text-sm font-bold text-purple-900 font-mono">
                  {tradingState?.tradingLogs.length || 0} رویداد
                </p>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg space-y-1">
                <div className="flex items-center justify-between text-emerald-700 font-bold text-xs">
                  <span>جدول user_profiles</span>
                  <UserCheck className="w-4 h-4" />
                </div>
                <p className="text-sm font-bold text-emerald-900 font-mono">
                  {usersList.length} کاربر ثبت‌شده
                </p>
              </div>
            </div>
          </div>

          {/* User Registration & Admin Approval Section */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-indigo-600" />
                  <span>سیستم ثبت‌نام و تایید هویت کاربران (Supabase Auth & Admin Approval)</span>
                </h3>
                <p className="text-xs text-gray-500">
                  کاربران با جیمیل ثبت‌نام می‌کنند؛ تایید ایمیل غیرفعال است و پس از ثبت‌نام، حساب تا زمان تایید دستی مدیر غیرفعال می‌ماند.
                </p>
              </div>
            </div>

            {/* Registration Simulation Form */}
            <form onSubmit={handleRegisterUser} className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
              <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-blue-600" />
                <span>ثبت‌نام کاربر جدید با جیمیل / ایمیل</span>
              </h4>

              {regMessage && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>{regMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-600 mb-1 font-medium">نام و نام خانوادگی</label>
                  <input
                    type="text"
                    placeholder="مثال: علی رضایی"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-gray-600 mb-1 font-medium">ایمیل / جیمیل (Gmail)</label>
                  <input
                    type="email"
                    placeholder="example@gmail.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Mail className="w-4 h-4" />
                    <span>ثبت‌نام و درخواست دسترسی</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Registered Users Table (Admin Control) */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-800">لیست کاربران و وضعیت تایید مدیر (is_approved):</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-gray-100 text-gray-600 border-b">
                      <th className="p-2.5">شناسه</th>
                      <th className="p-2.5">نام و نام خانوادگی</th>
                      <th className="p-2.5">ایمیل / جیمیل</th>
                      <th className="p-2.5">نقش</th>
                      <th className="p-2.5">وضعیت دسترسی</th>
                      <th className="p-2.5 text-center">عملیات مدیر</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-sans">
                    {usersList.map((usr) => (
                      <tr key={usr.id} className="hover:bg-gray-50">
                        <td className="p-2.5 font-mono text-[11px] text-gray-500">{usr.id}</td>
                        <td className="p-2.5 font-bold text-gray-900">{usr.full_name}</td>
                        <td className="p-2.5 font-mono text-gray-700">{usr.email}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                              usr.role === 'admin'
                                ? 'bg-purple-100 text-purple-800 font-bold'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {usr.role}
                          </span>
                        </td>
                        <td className="p-2.5">
                          {usr.is_approved ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ تایید شده (موجاز به تعریف قوانین)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              ⏳ در انتظار تایید مدیر
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => handleToggleUserApproval(usr.id)}
                            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                              usr.is_approved
                                ? 'bg-rose-100 hover:bg-rose-200 text-rose-800'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {usr.is_approved ? 'تعلیق دسترسی' : 'تایید دسترسی (Approve)'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SQL Query Script Box */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Code className="w-4 h-4 text-emerald-600" />
                <span>کوئری جامع ساخت پایگاه داده Supabase (مخصوص کپی در SQL Editor)</span>
              </h3>
              <span className="text-xs text-gray-400">شامل جداول، تریگرها، RLS و داده‌های اولیه</span>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              جهت ایجاد ساختار کامل جداول، به بخش <strong>SQL Editor</strong> در پنل Supabase پروژه خود بروید، تمام کدهای زیر را پیست کرده و دکمه <strong>Run</strong> را کلیک کنید.
            </p>

            <div className="relative">
              <textarea
                readOnly
                value={supabaseSql}
                rows={18}
                className="w-full font-mono text-xs bg-gray-900 text-emerald-400 p-4 rounded-xl border border-gray-800 focus:outline-none select-all leading-relaxed"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: MQL5 Expert Advisor Code & Download */}
      {activeSubTab === 'mql' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3 border-gray-100">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Code className="w-4 h-4 text-blue-600" />
                  <span>کد ربات سفیر (Hermes_Bridge.mq5)</span>
                </h2>
                <p className="text-xs text-gray-500">
                  این کد به صورت خودکار با آدرس دقیق سرور Cloud Router تنظیم شده است.
                </p>
              </div>

              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? 'کد کپی شد!' : 'کپی کامل کد MQL5'}</span>
              </button>
            </div>

            {/* Step-by-Step Installation Instructions */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-900">
              <h3 className="font-bold text-amber-950 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>راهنمای ۳ مرحله‌ای نصب سفیر در متاتریدر ۵ (MT5):</span>
              </h3>
              <ol className="list-decimal list-inside space-y-1 text-amber-800 leading-relaxed pr-2">
                <li>
                  در نرم‌افزار متاتریدر ۵، کلید <strong>F4</strong> را بزنید تا محیط <strong>MetaEditor</strong> باز شود.
                </li>
                <li>
                  یک فایل جدید از نوع <strong>Expert Advisor (template)</strong> به نام <code className="bg-amber-100 px-1 py-0.5 rounded">Hermes_Bridge</code> بسازید، تمام کدهای داخل آن را پاک کنید و کد زیر را کپی کرده و جایگزین کنید، سپس دکمه <strong>Compile</strong> (F7) را بزنید.
                </li>
                <li>
                  در متاتریدر ۵ به مسیر <strong>Tools -&gt; Options -&gt; Expert Advisors</strong> بروید، تیک <strong>Allow WebRequest for listed URL</strong> را بزنید و آدرس زیر را اضافه کنید:
                  <div className="mt-1 font-mono bg-amber-100 p-1.5 rounded border border-amber-300 text-[11px] text-amber-950 select-all">
                    {window.location.origin}/api/trading/tick
                  </div>
                </li>
              </ol>
            </div>

            {/* Code Box */}
            <div className="relative">
              <textarea
                readOnly
                value={mqlCode}
                rows={16}
                className="w-full font-mono text-xs bg-gray-900 text-emerald-400 p-4 rounded-xl border border-gray-800 focus:outline-none select-all leading-relaxed"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: Trading Agent Logs & Memory */}
      {activeSubTab === 'logs' && (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-gray-100">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600" />
              <span>حافظه رویدادها و تصمیمات ایجنت</span>
            </h2>
          </div>

          <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
            {tradingState?.tradingLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-1 font-mono"
              >
                <div className="flex items-center justify-between text-gray-400 text-[10px]">
                  <span>{new Date(log.timestamp).toLocaleString('fa-IR')}</span>
                  <span
                    className={`px-2 py-0.5 rounded font-sans font-semibold text-[10px] ${
                      log.type === 'order_dispatched'
                        ? 'bg-blue-100 text-blue-800'
                        : log.type === 'order_result'
                        ? 'bg-emerald-100 text-emerald-800'
                        : log.type === 'error'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {log.type}
                  </span>
                </div>
                <p className="text-gray-800 font-sans">{log.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
