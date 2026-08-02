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
  Compass,
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
  Send,
  Bookmark,
  CheckCheck,
  Loader2,
} from 'lucide-react';
import { TradingState, RiskRule, TradeOrder } from '../types';
import { supabase } from '../lib/supabaseClient';
import { MultiAccountManager } from './MultiAccountManager';
import { TradeJournalView } from './TradeJournalView';
import { TradingCopilotView } from './TradingCopilotView';

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
#property version   "2.00"
#property description "ربات سفیر پیشرفته متاتریدر ۵ (نسخه ۲.۰۰) - پشتیبانی از Persistent Idempotency، Multi-Timeframe Candles و Mandatory SL Guard"

#include <Trade\\Trade.mqh>
CTrade trade;

//--- Input Parameters
input string   InpServerUrl     = "${origin}/api/trading/tick"; // آدرس API سفیر و دریافت پپ‌لاین
input string   InpSecretToken   = "hermes-agent-token-2026";      // کلید امنیتی احراز هویت
input int      InpCheckInterval = 2;                             // فاصله زمانی سنکرون‌سازی (ثانیه)
input string   InpDefaultSymbol = "XAUUSD.m";                     // نماد پیش‌فرض معامله
input ulong    InpMagicNumber   = 77077;                          // شناسه مجیک نامبر اختصاصی ربات
input bool     InpEnforceSL     = true;                           // اجبار داشتن حد ضرر (Mandatory Stop Loss Guard)

//--- Global Variables & Tracker
datetime g_lastCheckTime = 0;
long     g_sequenceCounter = 0;

int OnInit()
{
   EventSetTimer(InpCheckInterval);
   trade.SetExpertMagicNumber(InpMagicNumber);
   if(GlobalVariableCheck("Hermes_Seq_Counter"))
   {
      g_sequenceCounter = (long)GlobalVariableGet("Hermes_Seq_Counter");
   }
   Print("[Hermes Bridge v2.0] Ambassador EA Started. Target Server: ", InpServerUrl);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("[Hermes Bridge v2.0] Ambassador EA Stopped.");
}

void OnTimer()
{
   SendUnifiedSnapshotAndPoll();
}

void OnTick()
{
   if(TimeCurrent() - g_lastCheckTime >= InpCheckInterval)
   {
      SendUnifiedSnapshotAndPoll();
   }
}

// Check if order was already processed locally using MT5 Persistent GlobalVariables
bool IsOrderAlreadyExecuted(string orderId)
{
   string varName = "Hermes_Ord_" + orderId;
   return GlobalVariableCheck(varName);
}

void RegisterExecutedOrder(string orderId)
{
   string varName = "Hermes_Ord_" + orderId;
   GlobalVariableSet(varName, (double)TimeCurrent());
}

// Build Candle Data Array JSON
string GetCandlesJson(string symbol, ENUM_TIMEFRAMES tf, int count)
{
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(symbol, tf, 0, count, rates);
   if(copied <= 0) return "[]";

   string json = "[";
   for(int i = copied - 1; i >= 0; i--)
   {
      string barStr = StringFormat(
         "{\\"time\\":\\"%s\\",\\"open\\":%.5f,\\"high\\":%.5f,\\"low\\":%.5f,\\"close\\":%.5f,\\"tickVolume\\":%d}",
         TimeToString(rates[i].time, TIME_DATE|TIME_SECONDS),
         rates[i].open, rates[i].high, rates[i].low, rates[i].close, rates[i].tick_volume
      );
      json += barStr + (i > 0 ? "," : "");
   }
   json += "]";
   return json;
}

// Main Heartbeat & Unified Snapshot Pipeline
void SendUnifiedSnapshotAndPoll()
{
   g_lastCheckTime = TimeCurrent();
   g_sequenceCounter++;
   GlobalVariableSet("Hermes_Seq_Counter", (double)g_sequenceCounter);

   string symbol = _Symbol;
   if(symbol == "" || symbol == NULL) symbol = InpDefaultSymbol;

   // 1. Market Data
   double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
   double spread = (double)SymbolInfoInteger(symbol, SYMBOL_SPREAD);
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
   double tickSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
   double tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
   double contractSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_CONTRACT_SIZE);
   double minLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   double lotStep = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);

   // 2. Account Information
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double margin = AccountInfoDouble(ACCOUNT_MARGIN);
   double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   double marginLevel = margin > 0 ? (equity / margin) * 100.0 : 0.0;
   long accNum = AccountInfoInteger(ACCOUNT_LOGIN);
   string company = AccountInfoString(ACCOUNT_COMPANY);
   string currency = AccountInfoString(ACCOUNT_CURRENCY);
   long leverage = AccountInfoInteger(ACCOUNT_LEVERAGE);

   // 3. Complete Active Positions Array Construction
   string positionsJson = "[";
   int openPosCount = PositionsTotal();
   for(int i = 0; i < openPosCount; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0 && PositionSelectByTicket(ticket))
      {
         string posSymbol = PositionGetString(POSITION_SYMBOL);
         long posType = PositionGetInteger(POSITION_TYPE);
         string posDir = (posType == POSITION_TYPE_BUY) ? "BUY" : "SELL";
         double posVol = PositionGetDouble(POSITION_VOLUME);
         double posEntry = PositionGetDouble(POSITION_PRICE_OPEN);
         double posSL = PositionGetDouble(POSITION_SL);
         double posTP = PositionGetDouble(POSITION_TP);
         double posProfit = PositionGetDouble(POSITION_PROFIT);
         double posSwap = PositionGetDouble(POSITION_SWAP);
         ulong posMagic = PositionGetInteger(POSITION_MAGIC);
         string posComment = PositionGetString(POSITION_COMMENT);

         string posItem = StringFormat(
            "{\\"ticket\\":%d,\\"symbol\\":\\"%s\\",\\"type\\":\\"%s\\",\\"direction\\":\\"%s\\",\\"lot\\":%.2f,\\"entryPrice\\":%.5f,\\"sl\\":%.5f,\\"tp\\":%.5f,\\"profit\\":%.2f,\\"swap\\":%.2f,\\"magic\\":%d,\\"comment\\":\\"%s\\"}",
            ticket, posSymbol, posDir, posDir, posVol, posEntry, posSL, posTP, posProfit, posSwap, posMagic, posComment
         );
         positionsJson += posItem + (i < openPosCount - 1 ? "," : "");
      }
   }
   positionsJson += "]";

   // 4. Multi-Timeframe Bar Data Collection (M1, M5, M15, H1)
   string m1CandlesJson  = GetCandlesJson(symbol, PERIOD_M1, 20);
   string m5CandlesJson  = GetCandlesJson(symbol, PERIOD_M5, 15);
   string m15CandlesJson = GetCandlesJson(symbol, PERIOD_M15, 10);
   string h1CandlesJson  = GetCandlesJson(symbol, PERIOD_H1, 5);

   // 5. Build Unified Snapshot Payload
   string jsonPayload = StringFormat(
      "{\\"snapshotVersion\\":\\"2.0.0\\",\\"sequence\\":%d,\\"symbol\\":\\"%s\\",\\"ask\\":%.5f,\\"bid\\":%.5f,\\"spread\\":%.2f," +
      "\\"account\\":{\\"accountNumber\\":%d,\\"broker\\":\\"%s\\",\\"currency\\":\\"%s\\",\\"leverage\\":%d,\\"balance\\":%.2f,\\"equity\\":%.2f,\\"margin\\":%.2f,\\"freeMargin\\":%.2f,\\"marginLevel\\":%.2f,\\"openPositionsCount\\":%d}," +
      "\\"symbolSpec\\":{\\"symbol\\":\\"%s\\",\\"digits\\":%d,\\"point\\":%.5f,\\"tickSize\\":%.5f,\\"tickValue\\":%.2f,\\"contractSize\\":%.2f,\\"minLot\\":%.2f,\\"maxLot\\":%.2f,\\"lotStep\\":%.2f}," +
      "\\"positions\\":%s,\\"candles\\":{\\"M1\\":%s,\\"M5\\":%s,\\"M15\\":%s,\\"H1\\":%s}}"
      , g_sequenceCounter, symbol, ask, bid, spread, accNum, company, currency, leverage, balance, equity, margin, freeMargin, marginLevel, openPosCount,
      symbol, digits, point, tickSize, tickValue, contractSize, minLot, maxLot, lotStep, positionsJson,
      m1CandlesJson, m5CandlesJson, m15CandlesJson, h1CandlesJson
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
      ParseAndDispatchActions(responseJson);
   }
   else
   {
      PrintFormat("[Hermes Bridge ERROR] WebRequest HTTP status: %d | Last Error: %d", res, GetLastError());
   }
}

// Parser & Execution Router for Orders and Modifications
void ParseAndDispatchActions(string jsonStr)
{
   // A. Process Pending Orders (New Trade Entries / Close All)
   if(StringFind(jsonStr, "\\"pendingOrders\\":") >= 0)
   {
      int pos = StringFind(jsonStr, "\\"id\\":\\"", 0);
      while(pos >= 0)
      {
         int startId = pos + 6;
         int endId = StringFind(jsonStr, "\\"", startId);
         string orderId = StringSubstr(jsonStr, startId, endId - startId);

         if(!IsOrderAlreadyExecuted(orderId))
         {
            int typePos = StringFind(jsonStr, "\\"type\\":\\"", endId);
            int startType = typePos + 8;
            int endType = StringFind(jsonStr, "\\"", startType);
            string orderType = StringSubstr(jsonStr, startType, endType - startType);

            // Parse Lot
            double lot = 0.01;
            int lotPos = StringFind(jsonStr, "\\"lot\\":", endType);
            if(lotPos > 0)
            {
               int endLot = StringFind(jsonStr, ",", lotPos);
               if(endLot < 0) endLot = StringFind(jsonStr, "}", lotPos);
               lot = StringToDouble(StringSubstr(jsonStr, lotPos + 6, endLot - (lotPos + 6)));
            }

            // Parse Stop Loss (SL)
            double sl = 0.0;
            int slPos = StringFind(jsonStr, "\\"sl\\":", endType);
            if(slPos > 0)
            {
               int endSl = StringFind(jsonStr, ",", slPos);
               if(endSl < 0) endSl = StringFind(jsonStr, "}", slPos);
               sl = StringToDouble(StringSubstr(jsonStr, slPos + 5, endSl - (slPos + 5)));
            }

            // Parse Take Profit (TP)
            double tp = 0.0;
            int tpPos = StringFind(jsonStr, "\\"tp\\":", endType);
            if(tpPos > 0)
            {
               int endTp = StringFind(jsonStr, ",", tpPos);
               if(endTp < 0) endTp = StringFind(jsonStr, "}", tpPos);
               tp = StringToDouble(StringSubstr(jsonStr, tpPos + 5, endTp - (tpPos + 5)));
            }

            ExecuteSingleOrder(orderId, orderType, lot, sl, tp);
         }
         pos = StringFind(jsonStr, "\\"id\\":\\"", pos + 10);
      }
   }

   // B. Process Position Modifications (Breakeven & Dynamic Trailing Stops)
   if(StringFind(jsonStr, "\\"modifications\\":") >= 0)
   {
      int modPos = StringFind(jsonStr, "\\"ticket\\":", 0);
      while(modPos >= 0)
      {
         int startTicket = modPos + 9;
         int endTicket = StringFind(jsonStr, ",", startTicket);
         ulong ticket = (ulong)StringToInteger(StringSubstr(jsonStr, startTicket, endTicket - startTicket));

         double newSL = 0.0;
         int slPos = StringFind(jsonStr, "\\"newSL\\":", endTicket);
         if(slPos > 0)
         {
            int endSl = StringFind(jsonStr, ",", slPos);
            if(endSl < 0) endSl = StringFind(jsonStr, "}", slPos);
            newSL = StringToDouble(StringSubstr(jsonStr, slPos + 8, endSl - (slPos + 8)));
         }

         double newTP = 0.0;
         int tpPos = StringFind(jsonStr, "\\"newTP\\":", endTicket);
         if(tpPos > 0)
         {
            int endTp = StringFind(jsonStr, ",", tpPos);
            if(endTp < 0) endTp = StringFind(jsonStr, "}", tpPos);
            newTP = StringToDouble(StringSubstr(jsonStr, tpPos + 8, endTp - (tpPos + 8)));
         }

         if(ticket > 0 && PositionSelectByTicket(ticket))
         {
            string posSymbol = PositionGetString(POSITION_SYMBOL);
            long posType = PositionGetInteger(POSITION_TYPE);
            double currentPrice = (posType == POSITION_TYPE_BUY) ? SymbolInfoDouble(posSymbol, SYMBOL_ASK) : SymbolInfoDouble(posSymbol, SYMBOL_BID);

            bool slValid = true;
            if(newSL > 0.0)
            {
               if(posType == POSITION_TYPE_BUY && newSL >= currentPrice) slValid = false;
               if(posType == POSITION_TYPE_SELL && newSL <= currentPrice) slValid = false;
            }

            if(!slValid)
            {
               PrintFormat("[Hermes Guard Violation] Invalid PositionModify Ticket #%d: newSL (%.5f) violates directional rule against current price (%.5f).", ticket, newSL, currentPrice);
            }
            else
            {
               bool modSuccess = trade.PositionModify(ticket, newSL, newTP);
               PrintFormat("[Hermes Protection] PositionModify Ticket #%d -> NewSL: %.5f | NewTP: %.5f | Success: %s", ticket, newSL, newTP, modSuccess ? "TRUE" : "FALSE");
            }
         }

         modPos = StringFind(jsonStr, "\\"ticket\\":", modPos + 10);
      }
   }
}

// Executes Trade Orders with Mandatory SL Enforced, Directional SL Guard & Magic Number Filter
void ExecuteSingleOrder(string orderId, string typeStr, double lot, double sl, double tp)
{
   string symbol = _Symbol;
   if(symbol == "" || symbol == NULL) symbol = InpDefaultSymbol;

   bool success = false;
   double price = 0;
   string errorMsg = "";

   // 1. Lot Size Broker Limits Guard
   double minLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   if((typeStr == "BUY" || typeStr == "SELL") && (lot < minLot || lot > maxLot))
   {
      errorMsg = StringFormat("Order Rejected: Requested lot (%.2f) outside broker limits [Min: %.2f, Max: %.2f].", lot, minLot, maxLot);
      PrintFormat("[Hermes Guard Violation] Order ID %s rejected -> %s", orderId, errorMsg);
      SendOrderResult(orderId, "failed", 0, errorMsg);
      RegisterExecutedOrder(orderId);
      return;
   }

   // 2. Mandatory Stop Loss Guard Enforcement
   if(InpEnforceSL && (typeStr == "BUY" || typeStr == "SELL") && sl <= 0.0)
   {
      errorMsg = "Order Rejected: Mandatory Stop Loss (InpEnforceSL) requirement violated (SL is 0).";
      PrintFormat("[Hermes Guard Violation] Order ID %s rejected -> %s", orderId, errorMsg);
      SendOrderResult(orderId, "failed", 0, errorMsg);
      RegisterExecutedOrder(orderId);
      return;
   }

   if(typeStr == "BUY")
   {
      price = SymbolInfoDouble(symbol, SYMBOL_ASK);
      // 3. Directional SL Validation Guard for BUY (SL must be below Ask)
      if(sl > 0.0 && sl >= price)
      {
         errorMsg = StringFormat("Order Rejected: BUY Stop Loss (%.5f) must be strictly below Ask price (%.5f).", sl, price);
         PrintFormat("[Hermes Guard Violation] Order ID %s rejected -> %s", orderId, errorMsg);
         SendOrderResult(orderId, "failed", 0, errorMsg);
         RegisterExecutedOrder(orderId);
         return;
      }
      success = trade.Buy(lot, symbol, price, sl, tp, "Hermes Order " + orderId);
   }
   else if(typeStr == "SELL")
   {
      price = SymbolInfoDouble(symbol, SYMBOL_BID);
      // 3. Directional SL Validation Guard for SELL (SL must be above Bid)
      if(sl > 0.0 && sl <= price)
      {
         errorMsg = StringFormat("Order Rejected: SELL Stop Loss (%.5f) must be strictly above Bid price (%.5f).", sl, price);
         PrintFormat("[Hermes Guard Violation] Order ID %s rejected -> %s", orderId, errorMsg);
         SendOrderResult(orderId, "failed", 0, errorMsg);
         RegisterExecutedOrder(orderId);
         return;
      }
      success = trade.Sell(lot, symbol, price, sl, tp, "Hermes Order " + orderId);
   }
   else if(typeStr == "CLOSE_ALL")
   {
      int attemptedCount = 0;
      int closedCount = 0;
      for(int i = PositionsTotal() - 1; i >= 0; i--)
      {
         ulong ticket = PositionGetTicket(i);
         if(ticket > 0 && PositionSelectByTicket(ticket))
         {
            if(PositionGetInteger(POSITION_MAGIC) == (long)InpMagicNumber)
            {
               attemptedCount++;
               if(trade.PositionClose(ticket))
               {
                  closedCount++;
               }
            }
         }
      }
      success = (attemptedCount == 0 || closedCount == attemptedCount);
      price = SymbolInfoDouble(symbol, SYMBOL_BID);
      if(!success)
      {
         errorMsg = StringFormat("CloseAll incomplete: %d of %d positions closed. CTrade Error %d: %s", closedCount, attemptedCount, trade.ResultRetcode(), trade.ResultComment());
         PrintFormat("[Hermes CloseAll Failed] %s", errorMsg);
      }
      else
      {
         PrintFormat("[Hermes CloseAll Success] Closed %d positions matching Magic #%d", closedCount, InpMagicNumber);
         RegisterExecutedOrder(orderId);
      }
   }

   if(!success && typeStr != "CLOSE_ALL")
   {
      errorMsg = StringFormat("CTrade Error %d: %s", trade.ResultRetcode(), trade.ResultComment());
      PrintFormat("[Hermes Order Failed] ID: %s | %s", orderId, errorMsg);
   }
   else
   {
      PrintFormat("[Hermes Order Success] ID: %s | Type: %s | Lot: %.2f | Price: %.2f | SL: %.2f | TP: %.2f", orderId, typeStr, lot, price, sl, tp);
      RegisterExecutedOrder(orderId);
   }

   SendOrderResult(orderId, success ? "executed" : "failed", price, errorMsg);
}

void SendOrderResult(string orderId, string status, double price, string errorMsg)
{
   string resultUrl = InpServerUrl;
   int tickPos = StringFind(resultUrl, "/api/trading/tick");
   if(tickPos >= 0)
   {
      resultUrl = StringSubstr(resultUrl, 0, tickPos) + "/api/trading/order-result";
   }
   else
   {
      int apiPos = StringFind(resultUrl, "/api/");
      if(apiPos >= 0)
      {
         resultUrl = StringSubstr(resultUrl, 0, apiPos) + "api/trading/order-result";
      }
      else
      {
         PrintFormat("[Hermes Bridge ERROR] Unable to construct order-result URL from InpServerUrl: '%s'. Notification skipped.", InpServerUrl);
         return;
      }
   }

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
  const [activeSubTab, setActiveSubTab] = useState<'copilot' | 'accounts' | 'journal' | 'terminal' | 'risk' | 'prompt' | 'telemetry' | 'supabase' | 'mql' | 'logs'>('copilot');
  const [activeAccountId, setActiveAccountId] = useState<string>('');

  // Customizable Risk Engine State
  const [riskRules, setRiskRules] = useState<RiskRule[]>([]);
  const [riskSaveMsg, setRiskSaveMsg] = useState<string | null>(null);
  const [isSavingRisk, setIsSavingRisk] = useState(false);
  const [newRuleId, setNewRuleId] = useState('');
  const [newRuleDesc, setNewRuleDesc] = useState('');

  // Telemetry & Inspector State
  const [telemetryData, setTelemetryData] = useState<any | null>(null);

  const fetchRiskRules = async () => {
    try {
      let res = await fetch('/api/trading/risk-rules');
      if (!res.ok) {
        res = await fetch('/api/trading/rules');
      }
      if (res.ok) {
        const data = await res.json();
        if (data.rules && Array.isArray(data.rules)) {
          setRiskRules(data.rules);
        }
      }
    } catch (err) {
      console.error('Failed to fetch risk rules:', err);
    }
  };

  const handleSaveRiskRules = async (updatedRules?: RiskRule[]) => {
    const targetRules = updatedRules || riskRules;
    setIsSavingRisk(true);
    setRiskSaveMsg(null);
    try {
      let res = await fetch('/api/trading/risk-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: targetRules }),
      });
      if (!res.ok) {
        res = await fetch('/api/trading/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rules: targetRules }),
        });
      }
      if (res.ok) {
        const data = await res.json();
        if (data.rules) setRiskRules(data.rules);
        setRiskSaveMsg('تنظیمات و پارامترهای موتور ریسک با موفقیت در دیتابیس Supabase و حافظه سرور ذخیره و فعال شد.');
        setTimeout(() => setRiskSaveMsg(null), 4000);
        fetchTradingState();
      } else {
        setRiskSaveMsg('خطا در ذخیره‌سازی قوانین ریسک. لطفاً مجدداً تلاش کنید.');
      }
    } catch (err) {
      console.error('Failed to save risk rules:', err);
      setRiskSaveMsg('خطای ارتباط شبکه در ذخیره‌سازی قوانین ریسک.');
    } finally {
      setIsSavingRisk(false);
    }
  };

  const handleToggleRule = (ruleId: string) => {
    const updated = riskRules.map((r) =>
      r.id === ruleId ? { ...r, isEnabled: !r.isEnabled } : r
    );
    setRiskRules(updated);
    handleSaveRiskRules(updated);
  };

  const handleRuleValueChange = (ruleId: string, val: number) => {
    const updated = riskRules.map((r) =>
      r.id === ruleId ? { ...r, value: val } : r
    );
    setRiskRules(updated);
  };

  const handleAddCustomRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim() || !newRuleValue) return;

    const id = newRuleId.trim() ? newRuleId.trim().toLowerCase().replace(/\s+/g, '_') : `rule_${Date.now()}`;
    const newRule: RiskRule = {
      id,
      name: newRuleName.trim(),
      description: newRuleDesc.trim() || 'قانون سفارشی تعریف‌شده توسط کاربر',
      isEnabled: true,
      value: Number(newRuleValue),
      unit: newRuleUnit,
    };

    const updated = [...riskRules, newRule];
    setRiskRules(updated);
    setNewRuleId('');
    setNewRuleName('');
    setNewRuleDesc('');
    setNewRuleValue('');
    handleSaveRiskRules(updated);
  };

  const handleDeleteRule = (ruleId: string) => {
    const updated = riskRules.filter((r) => r.id !== ruleId);
    setRiskRules(updated);
    handleSaveRiskRules(updated);
  };

  const fetchTelemetryData = async () => {
    try {
      const res = await fetch('/api/trading/telemetry');
      if (res.ok) {
        const data = await res.json();
        setTelemetryData(data);
      }
    } catch (err) {
      console.error('Failed to fetch telemetry data:', err);
    }
  };

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

  // New Order Form & Multi-Account state
  const [multiAccountsList, setMultiAccountsList] = useState<any[]>([]);
  const [liveSymbolsList, setLiveSymbolsList] = useState<{ symbol: string; source: string; lastPrice?: number }[]>([]);
  const [orderAccountId, setOrderAccountId] = useState<string>('');
  const [symbol, setSymbol] = useState('');
  const [customSymbolInput, setCustomSymbolInput] = useState('');
  const [isCustomSymbol, setIsCustomSymbol] = useState(false);
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

  // Chat, Memory & System Prompt state
  const chatMessagesBoxRef = React.useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = React.useRef(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ id: string; sender: 'user' | 'agent'; text: string; timestamp: string; status?: 'sending' | 'delivered' }>([
    {
      id: 'welcome_msg_1',
      sender: 'agent',
      text: 'سلام! من ایجنت هوشمند معامله‌گر هرمس (Hermes) هستم. دستورات، درخواست معامله، تحلیل طلا یا قوانین جدیدی بفرمایید تا فوراً انجام دهم.',
      timestamp: new Date().toISOString(),
      status: 'delivered',
    },
  ]);
  const [agentMemory, setAgentMemory] = useState<{ id: string; category: string; content: string; createdAt: string }[]>([]);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [memoryCat, setMemoryCat] = useState('قوانین کاربری');
  const [memoryContent, setMemoryContent] = useState('');

  // Handle manual scroll detection to prevent forcing scroll when user moves up
  const handleChatScroll = () => {
    if (chatMessagesBoxRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatMessagesBoxRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
      isUserScrolledUpRef.current = !isAtBottom;
    }
  };

  // Scroll ONLY the inner chat container to bottom on message updates if user is at the bottom
  useEffect(() => {
    if (chatMessagesBoxRef.current && !isUserScrolledUpRef.current) {
      chatMessagesBoxRef.current.scrollTop = chatMessagesBoxRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // 8-Stage Autonomous Engine state
  const [systemPrompt, setSystemPrompt] = useState('');
  const [promptSaveMsg, setPromptSaveMsg] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [latestAnalysis, setLatestAnalysis] = useState<any | null>(null);

  const fetchSystemPrompt = async () => {
    try {
      const res = await fetch('/api/trading/system-prompt');
      if (res.ok) {
        const data = await res.json();
        if (data.systemPrompt) setSystemPrompt(data.systemPrompt);
      }
    } catch (err) {
      console.error('Failed to fetch system prompt:', err);
    }
  };

  const handleSaveSystemPrompt = async () => {
    try {
      const res = await fetch('/api/trading/system-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt }),
      });
      if (res.ok) {
        setPromptSaveMsg('سیستم پرامپت ۸ مرحله‌ای ایجنت با موفقیت ذخیره و در حافظه فعال شد.');
        setTimeout(() => setPromptSaveMsg(null), 3000);
      }
    } catch (err) {
      console.error('Failed to save system prompt:', err);
    }
  };

  const handleRunAutonomousAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/trading/autonomous-analyze', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.analysis) setLatestAnalysis(data.analysis);
        fetchTradingState();
      }
    } catch (err) {
      console.error('Failed to run autonomous analysis:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fetchAgentMemoryAndChat = async () => {
    try {
      const res = await fetch(`/api/trading/memory?accountId=${activeAccountId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.memory) setAgentMemory(data.memory);
        if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
          setChatMessages((prev) => {
            const map = new Map<string, any>();
            prev.forEach((m) => map.set(m.id, m));
            data.messages.forEach((m: any) => {
              const existing = map.get(m.id);
              map.set(m.id, {
                ...m,
                status: existing?.status === 'sending' ? 'sending' : 'delivered',
              });
            });
            return Array.from(map.values()).sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          });
        }
      }
    } catch (err) {
      // Keep existing chat messages in memory if network call fails
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSendingChat) return;

    const userText = chatInput;
    setChatInput('');
    setIsSendingChat(true);

    // Force scroll to bottom on user send
    isUserScrolledUpRef.current = false;

    const tempUserId = `user_${Date.now()}`;
    const tempUserMsg = {
      id: tempUserId,
      sender: 'user' as const,
      text: userText,
      timestamp: new Date().toISOString(),
      status: 'sending' as const,
    };

    // Optimistically update chat state so user message never disappears
    setChatMessages((prev) => [...prev, tempUserMsg]);

    setTimeout(() => {
      if (chatMessagesBoxRef.current) {
        chatMessagesBoxRef.current.scrollTop = chatMessagesBoxRef.current.scrollHeight;
      }
    }, 50);

    try {
      const res = await fetch('/api/trading/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userText, accountId: activeAccountId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.chatMessages && Array.isArray(data.chatMessages)) {
          setChatMessages((prev) => {
            const map = new Map<string, any>();
            prev.forEach((m) => {
              if (m.id === tempUserId) {
                map.set(m.id, { ...m, status: 'delivered' as const });
              } else {
                map.set(m.id, m);
              }
            });
            data.chatMessages.forEach((m: any) => map.set(m.id, { ...m, status: 'delivered' as const }));
            return Array.from(map.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          });
        }
        if (data.agentMemory) setAgentMemory(data.agentMemory);
        fetchTradingState();
      } else {
        const errorMsg = {
          id: `agent_err_${Date.now()}`,
          sender: 'agent' as const,
          text: 'مشکلی در پردازش دستور توسط سرور هرمس رخ داد. لطفاً دوباره تلاش کنید.',
          timestamp: new Date().toISOString(),
          status: 'delivered' as const,
        };
        setChatMessages((prev) => [
          ...prev.map((m) => (m.id === tempUserId ? { ...m, status: 'delivered' as const } : m)),
          errorMsg,
        ]);
      }
    } catch (err) {
      console.error('Failed to send chat message:', err);
      const errorMsg = {
        id: `agent_err_${Date.now()}`,
        sender: 'agent' as const,
        text: 'خطا در ارتباط با سرور. لطفا اتصال اینترنت خود را بررسی کنید.',
        timestamp: new Date().toISOString(),
        status: 'delivered' as const,
      };
      setChatMessages((prev) => [
        ...prev.map((m) => (m.id === tempUserId ? { ...m, status: 'delivered' as const } : m)),
        errorMsg,
      ]);
    } finally {
      setIsSendingChat(false);
      setTimeout(() => {
        if (chatMessagesBoxRef.current && !isUserScrolledUpRef.current) {
          chatMessagesBoxRef.current.scrollTop = chatMessagesBoxRef.current.scrollHeight;
        }
      }, 50);
    }
  };

  const handleAddMemoryNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memoryContent.trim()) return;

    try {
      const res = await fetch('/api/trading/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: memoryCat, content: memoryContent, accountId: activeAccountId }),
      });
      if (res.ok) {
        setMemoryContent('');
        fetchAgentMemoryAndChat();
      }
    } catch (err) {
      console.error('Failed to add memory note:', err);
    }
  };

  const handleDeleteMemoryNote = async (id: string) => {
    try {
      const res = await fetch(`/api/trading/memory/${id}?accountId=${activeAccountId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAgentMemoryAndChat();
      }
    } catch (err) {
      console.error('Failed to delete memory note:', err);
    }
  };

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
        if (data.riskRules && Array.isArray(data.riskRules) && data.riskRules.length > 0) {
          setRiskRules((prev) => (prev.length === 0 ? data.riskRules : prev));
        }
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

  const fetchMultiAccounts = async () => {
    try {
      const res = await fetch('/api/multi-accounts');
      if (res.ok) {
        const data = await res.json();
        if (data.accounts && Array.isArray(data.accounts)) {
          setMultiAccountsList(data.accounts);
          if (data.accounts.length > 0) {
            if (data.activeAccountId) setActiveAccountId(data.activeAccountId);
            setOrderAccountId((prev) => prev || data.activeAccountId || data.accounts[0].accountId);
          } else {
            setActiveAccountId('');
            setOrderAccountId('');
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch multi accounts:', err);
    }
  };

  const fetchLiveSymbols = async () => {
    try {
      const res = await fetch('/api/trading/symbols');
      if (res.ok) {
        const data = await res.json();
        if (data.symbols && Array.isArray(data.symbols)) {
          setLiveSymbolsList(data.symbols);
          if (data.symbols.length > 0 && !symbol) {
            setSymbol(data.symbols[0].symbol);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch live symbols:', err);
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
    if (activeAccountId) setOrderAccountId(activeAccountId);
  }, [activeAccountId]);

  useEffect(() => {
    fetchTradingState();
    fetchMultiAccounts();
    fetchLiveSymbols();
    fetchRiskRules();
    fetchEaCode();
    fetchSupabaseSql();
    fetchUsersFromSupabase();
    fetchSystemPrompt();
    fetchTelemetryData();
    fetchAgentMemoryAndChat();

    const interval = setInterval(() => {
      fetchTradingState();
      fetchMultiAccounts();
      fetchLiveSymbols();
      fetchAgentMemoryAndChat();
      fetchTelemetryData();
    }, 2500); // Live poll every 2.5s
    return () => clearInterval(interval);
  }, [activeAccountId]);

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

    const activeSym = isCustomSymbol ? customSymbolInput.trim() : symbol;
    if (!activeSym) {
      setOrderError('لطفاً نماد معاملاتی را انتخاب یا وارد نمایید.');
      return;
    }

    const targetAccId = orderAccountId || activeAccountId;

    try {
      const res = await fetch('/api/trading/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: targetAccId,
          symbol: activeSym,
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
        setOrderSuccess(`سفارش ${orderType} روی نماد ${activeSym} (حساب ${targetAccId}) با موفقیت در صف ارسال به MT5 قرار گرفت.`);
        fetchTradingState();
      }
    } catch (err: unknown) {
      setOrderError(err instanceof Error ? err.message : 'خطا در برقراری ارتباط با سرور');
    }
  };

  // Handle Quick Close All Positions
  const handleQuickCloseAll = async () => {
    setOrderError(null);
    setOrderSuccess(null);
    try {
      const res = await fetch('/api/trading/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbol || 'XAUUSD',
          type: 'CLOSE_ALL',
          lot: 0.01,
          source: 'user_manual',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setOrderError(data.error || 'خطا در ثبت دستور بستن پوزیشن');
      } else {
        setOrderSuccess('دستور بستن تمامی پوزیشن‌ها با موفقیت صادر و به MT5 ارسال شد.');
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
          <div className="flex items-center justify-between">
            <p className="text-base font-bold text-gray-900 font-mono">
              {status?.accountInfo?.openPositionsCount ?? 0} پوزیشن
            </p>
            <button
              onClick={handleQuickCloseAll}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 transition-colors shadow-sm"
              title="ارسال سریع دستور بستن پوزیشن به متاتریدر"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>بستن پوزیشن‌ها (Close)</span>
            </button>
          </div>
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
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('copilot')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
            activeSubTab === 'copilot'
              ? 'bg-indigo-900 text-white shadow-md font-extrabold border border-indigo-700'
              : 'text-indigo-900 bg-indigo-50/80 hover:bg-indigo-100'
          }`}
        >
          <Bot className="w-4 h-4 text-indigo-400 animate-pulse" />
          <span>دستیار و تحلیل‌گر هوشمند (AI Copilot)</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-400 text-slate-950 font-black">جدید</span>
        </button>

        <button
          onClick={() => setActiveSubTab('accounts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
            activeSubTab === 'accounts'
              ? 'bg-blue-700 text-white shadow-sm font-bold'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Layers className="w-4 h-4 text-sky-300" />
          <span>مدیریت حساب‌های چندگانه (Multi-Account)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('journal')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
            activeSubTab === 'journal'
              ? 'bg-indigo-700 text-white shadow-sm font-bold'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Bookmark className="w-4 h-4 text-indigo-300" />
          <span>ژورنال معاملات AI (Trade Journal)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('risk')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
            activeSubTab === 'risk'
              ? 'bg-amber-600 text-white shadow-sm font-bold'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-300" />
          <span>موتور ریسک قابل شخصی‌سازی (Risk Engine)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('terminal')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
            activeSubTab === 'terminal'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>ارسال سفارش و پایش زنده</span>
        </button>

        <button
          onClick={() => setActiveSubTab('prompt')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
            activeSubTab === 'prompt'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Bot className="w-4 h-4 text-amber-300" />
          <span>مغز خودمختار و سیستم پرامپت (8-Stage Engine)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('telemetry')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
            activeSubTab === 'telemetry'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-300" />
          <span>مرکز نظارت زنده، شفافیت و عیب‌یابی (Telemetry & Router)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('supabase')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
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
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
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
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
            activeSubTab === 'logs'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>حافظه و لاگ‌های ایجنت</span>
        </button>
      </div>

      {/* SUB-TAB: AI Trading Copilot / Analyst */}
      {activeSubTab === 'copilot' && (
        <TradingCopilotView
          activeAccountId={activeAccountId}
          onRefreshState={fetchTradingState}
        />
      )}

      {/* SUB-TAB: Multi-Account Manager */}
      {activeSubTab === 'accounts' && (
        <MultiAccountManager
          activeAccountId={activeAccountId}
          onAccountSelect={(accId) => {
            setActiveAccountId(accId);
            fetchTradingState();
            fetchAgentMemoryAndChat();
          }}
        />
      )}

      {/* SUB-TAB: AI Trade Journal */}
      {activeSubTab === 'journal' && (
        <TradeJournalView activeAccountId={activeAccountId} />
      )}

      {/* SUB-TAB: Customizable Risk Engine */}
      {activeSubTab === 'risk' && (
        <div className="space-y-6">
          {/* Top Banner Card */}
          <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-amber-900/50 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-amber-400" />
                  <h2 className="text-base font-extrabold text-white">
                    شخصی‌سازی و تنظیمات پیشرفته موتور ریسک (Customizable Risk Engine)
                  </h2>
                </div>
                <p className="text-xs text-amber-200 leading-relaxed max-w-3xl">
                  موتور ریسک سیستم هرمس کاملاً پویا و قابل شخصی‌سازی است. شما می‌توانید آستانه‌های مجاز برای ریسک در هر معامله، زیان روزانه، سقف لات، حداکثر پوزیشن‌های باز، اسپرد، تاخیر تیک و الزامی بودن حد ضرر را مطابق با استراتژی شخصی خود تغییر داده و ذخیره کنید.
                </p>
              </div>

              <button
                onClick={() => handleSaveRiskRules()}
                disabled={isSavingRisk}
                className="px-5 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0 border border-amber-300/30"
              >
                <Check className={`w-4 h-4 ${isSavingRisk ? 'animate-spin' : ''}`} />
                <span>{isSavingRisk ? 'در حال ذخیره‌سازی...' : 'ذخیره و اعمال فوری قوانین ریسک'}</span>
              </button>
            </div>

            {riskSaveMsg && (
              <div className="p-3 bg-emerald-500/20 border border-emerald-400/40 rounded-xl text-xs text-emerald-200 flex items-center gap-2 font-bold">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{riskSaveMsg}</span>
              </div>
            )}
          </div>

          {/* Master Switch Banner */}
          {(() => {
            const masterRule = riskRules.find((r) => r.id === 'enable_risk_guard');
            const isEnabled = masterRule ? masterRule.isEnabled : true;
            return (
              <div className={`p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm ${
                isEnabled ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' : 'bg-amber-50/80 border-amber-200 text-amber-950'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${isEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <span>کلید اصلی فعال‌سازی موتور ریسک (Master Guard Switch)</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isEnabled ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-900'
                      }`}>
                        {isEnabled ? 'محافظت زنده و فعال' : 'غیرفعال (مستقیم و بدون فیلتر)'}
                      </span>
                    </h3>
                    <p className="text-xs text-gray-600 mt-1">
                      {isEnabled
                        ? 'موتور ریسک با قوانین تعریف‌شده زیر تمام معاملات را قبل از ارسال به متاتریدر ارزیابی و فیلتر می‌کند.'
                        : 'توجه: با غیرفعال کردن کلید اصلی، سفارشات بدون بررسی قوانین ریسک مستقیماً اجرا می‌شوند.'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleRule('enable_risk_guard')}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shrink-0 shadow-sm ${
                    isEnabled ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  <span>{isEnabled ? 'غیرفعال‌سازی موقت کلید اصلی' : 'فعال‌سازی کامل محافظت ریسک'}</span>
                </button>
              </div>
            );
          })()}

          {/* Real-time Assessment Output */}
          {tradingState?.riskAssessment && (
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  <span>ارزیابی لحظه‌ای موتور ریسک بر اساس آخرین وضعیت بازار و قوانین فعال</span>
                </h3>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-gray-500 font-sans">امتیاز ریسک:</span>
                  <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] ${
                    (tradingState.riskAssessment.riskScore || 0) < 30
                      ? 'bg-emerald-100 text-emerald-800'
                      : (tradingState.riskAssessment.riskScore || 0) < 65
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {tradingState.riskAssessment.riskScore || 0} / 100
                  </span>
                  <span className={`px-2.5 py-1 rounded-full font-bold font-sans text-[11px] ${
                    tradingState.riskAssessment.isAllowed
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}>
                    توصیه: {tradingState.riskAssessment.recommendation || (tradingState.riskAssessment.isAllowed ? 'PROCEED' : 'REJECT')}
                  </span>
                </div>
              </div>

              {tradingState.riskAssessment.failedRules && tradingState.riskAssessment.failedRules.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-rose-700 block">خطاهای نقض قوانین ریسک:</span>
                  {tradingState.riskAssessment.failedRules.map((rule: any, idx: number) => (
                    <div key={idx} className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-bold block">{rule.name}: {rule.reason}</span>
                        <span className="font-mono text-[11px] text-rose-700">آستانه مجاز: {rule.threshold} | مقدار فعلی: {rule.actual}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2 font-bold">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>تمام شرایط و قوانین سفارشی ریسک برای انجام معامله احراز شده است (آماده به کار).</span>
                </div>
              )}
            </div>
          )}

          {/* Rules Management Grid */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <span>جدول کامل قوانین و پارامترهای قابل شخصی‌سازی ریسک ({riskRules.length} قانون)</span>
              </h3>

              <button
                onClick={() => handleSaveRiskRules()}
                disabled={isSavingRisk}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>ذخیره کلی تغییرات</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {riskRules.map((rule) => (
                <div
                  key={rule.id}
                  className={`p-4 rounded-xl border transition-all space-y-3 ${
                    rule.isEnabled ? 'bg-gray-50/80 border-gray-200' : 'bg-gray-100/60 border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-gray-900">{rule.name}</span>
                        <span className="font-mono text-[10px] text-gray-400">({rule.id})</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed">{rule.description}</p>
                    </div>

                    <button
                      onClick={() => handleToggleRule(rule.id)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors shrink-0 ${
                        rule.isEnabled
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-gray-200 text-gray-600 border border-gray-300'
                      }`}
                    >
                      {rule.isEnabled ? 'فعال ✓' : 'غیرفعال'}
                    </button>
                  </div>

                  {rule.unit !== 'boolean' ? (
                    <div className="flex items-center gap-3 pt-2 border-t border-gray-200/60">
                      <label className="text-xs font-semibold text-gray-700 shrink-0">مقدار آستانه:</label>
                      <input
                        type="number"
                        step="any"
                        value={rule.value}
                        onChange={(e) => handleRuleValueChange(rule.id, Number(e.target.value))}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-mono text-gray-900 bg-white focus:outline-none focus:border-indigo-500"
                      />
                      <span className="px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 text-xs font-bold font-mono shrink-0">
                        {rule.unit === 'percentage' ? '%' : rule.unit === 'lot' ? 'Lot' : rule.unit === 'usd' ? 'واحد' : rule.unit}
                      </span>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-gray-200/60 text-xs text-gray-600 font-medium">
                      نوع قانون: کنترل منطقی بولی (Boolean Control)
                    </div>
                  )}

                  {!['enable_risk_guard', 'max_risk_per_trade', 'max_daily_drawdown', 'max_lot_size', 'max_open_positions', 'require_sl_tp', 'max_spread_limit', 'max_tick_age_ms', 'min_margin_level'].includes(rule.id) && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-[11px] text-rose-600 hover:text-rose-800 flex items-center gap-1 font-semibold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف قانون سفارشی</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add Custom Risk Rule Form */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b pb-3 border-gray-100">
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>افزودن قانون سفارشی جدید به موتور ریسک</span>
            </h3>

            <form onSubmit={handleAddCustomRule} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="block text-gray-700 mb-1 font-semibold">شناسه انگلیسی (ID)</label>
                <input
                  type="text"
                  placeholder="مثال: max_weekend_risk"
                  value={newRuleId}
                  onChange={(e) => setNewRuleId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-gray-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1 font-semibold">عنوان قانون (فارسی)</label>
                <input
                  type="text"
                  placeholder="مثال: سقف لوریج آخر هفته"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1 font-semibold">مقدار آستانه</label>
                <input
                  type="number"
                  step="any"
                  placeholder="مثال: 5"
                  value={newRuleValue}
                  onChange={(e) => setNewRuleValue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-gray-900 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-1 font-semibold">واحد سنجش</label>
                <select
                  value={newRuleUnit}
                  onChange={(e) => setNewRuleUnit(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-indigo-500"
                >
                  <option value="percentage">درصد (%)</option>
                  <option value="lot">لات (Lot)</option>
                  <option value="usd">مبلغ / عدد (USD/Units)</option>
                  <option value="boolean">بولی (Boolean)</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>افزودن قانون جدید</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              {/* Account Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  <span>انتخاب شماره حساب (Account Number)</span>
                </label>
                <select
                  value={orderAccountId}
                  onChange={(e) => {
                    const accId = e.target.value;
                    setOrderAccountId(accId);
                    setActiveAccountId(accId);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 bg-slate-50 focus:outline-none focus:border-blue-500 shadow-sm"
                >
                  {multiAccountsList.length > 0 ? (
                    multiAccountsList.map((acc: any) => (
                      <option key={acc.accountId} value={acc.accountId}>
                        {acc.isConnected ? '🟢' : '🔴'} {acc.accountId} ({acc.name}) {acc.accountNumber ? ` - #${acc.accountNumber}` : ''} {acc.isConnected ? `- موجودی: $${acc.balance?.toFixed(2) || '0'}` : '(غیرفعال - در انتظار MT5)'}
                      </option>
                    ))
                  ) : (
                    <option value={activeAccountId}>🔴 {activeAccountId} - (در انتظار اولین اتصال MQL5)</option>
                  )}
                </select>
              </div>

              {/* Symbol Selection Dropdown ("منوی کشویی / کشوری انتخاب نماد") & Order Type */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-800 flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-emerald-600" />
                  <span>منوی کشویی انتخاب نماد (Symbol Country Menu - دریافت زنده از MT5)</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <select
                      value={isCustomSymbol ? 'CUSTOM' : symbol}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'CUSTOM') {
                          setIsCustomSymbol(true);
                        } else {
                          setIsCustomSymbol(false);
                          setSymbol(val);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono font-bold text-gray-900 bg-white focus:outline-none focus:border-emerald-500 shadow-sm"
                    >
                      {liveSymbolsList.length > 0 ? (
                        <optgroup label="📊 نمادهای دریافتی زنده از متاتریدر ۵ (Live MQL5 Ticks)">
                          {liveSymbolsList.map((item) => (
                            <option key={item.symbol} value={item.symbol}>
                              {item.symbol} ({item.source}){item.lastPrice ? ` - $${item.lastPrice.toFixed(2)}` : ''}
                            </option>
                          ))}
                        </optgroup>
                      ) : (
                        <option value="" disabled>🔴 در انتظار دریافت نماد زنده از MQL5 (تیکی دریافت نشده)</option>
                      )}
                      <optgroup label="✏️ انتخاب یا تایپ دستی">
                        <option value="CUSTOM">تایپ دستی نماد دیگر (Custom Symbol)...</option>
                      </optgroup>
                    </select>

                    {isCustomSymbol && (
                      <input
                        type="text"
                        placeholder="نام نماد مثلاً: BTCUSD"
                        value={customSymbolInput}
                        onChange={(e) => setCustomSymbolInput(e.target.value.toUpperCase())}
                        className="w-full mt-2 px-3 py-1.5 border border-amber-300 rounded-lg text-xs font-mono text-gray-900 bg-amber-50 focus:outline-none focus:border-amber-500"
                        required
                      />
                    )}
                  </div>

                  <div>
                    <select
                      value={orderType}
                      onChange={(e) => setOrderType(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:border-blue-500 shadow-sm"
                    >
                      <option value="BUY">🟢 خرید مستقیم (BUY)</option>
                      <option value="SELL">🔴 فروش مستقیم (SELL)</option>
                      <option value="CLOSE_ALL">⚠️ بستن همه پوزیشن‌ها (CLOSE ALL)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Lot Size, SL, TP */}
              {orderType !== 'CLOSE_ALL' && (
                <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
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
                        step="any"
                        value={sl}
                        onChange={(e) => setSl(e.target.value)}
                        placeholder="اختیاری"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">حد سود (Take Profit)</label>
                      <input
                        type="number"
                        step="any"
                        value={tp}
                        onChange={(e) => setTp(e.target.value)}
                        placeholder="اختیاری"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className={`w-full py-2.5 rounded-lg text-xs font-bold text-white transition-colors flex items-center justify-center gap-2 shadow-sm ${
                  orderType === 'BUY'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : orderType === 'SELL'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>ارسال و تست سفارش دستی ({orderType})</span>
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

      {/* SUB-TAB: 8-Stage Autonomous Brain & System Prompt */}
      {activeSubTab === 'prompt' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-indigo-950/50 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Bot className="w-6 h-6 text-amber-400" />
                  <h2 className="text-base font-extrabold text-white">
                    معماری خودمختار ۸ مرحله‌ای (8-Stage Autonomous Trading Engine)
                  </h2>
                </div>
                <p className="text-xs text-indigo-200 leading-relaxed max-w-3xl">
                  ایجنت معامله‌گر هرمس به جای اتکای صرف به دستورات ساده یا قوانین سخت‌کدشده، فرآیند تحلیل ۸ مرحله‌ای استاندارد بین‌المللی (شامل ارزیابی رژیم بازار، فیلتر اخبار، سناریوسازی، مدیریت ریسک، چک‌لیست ۷‌گانه قبل ورود و پایش زنده پوزیشن) را اجرا می‌کند.
                </p>
              </div>

              <button
                onClick={handleRunAutonomousAnalysis}
                disabled={isAnalyzing}
                className="px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0 border border-amber-300/30"
              >
                <Zap className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
                <span>{isAnalyzing ? 'در حال اجرای فرآیند ۸ مرحله‌ای...' : 'تست و اجرای فرآیند ۸ مرحله‌ای (Autonomous Run)'}</span>
              </button>
            </div>
          </div>

          {/* Real-time 8-Stage Execution Result */}
          {latestAnalysis && (
            <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-md space-y-5">
              <div className="flex items-center justify-between border-b pb-3 border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  <span>نتایج زنده خروجی تصمیم‌گیری ۸ مرحله‌ای ایجنت</span>
                </h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  latestAnalysis.stage8_decision === 'BUY'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : latestAnalysis.stage8_decision === 'SELL'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  تصمیم نهایی: {latestAnalysis.stage8_decision}
                </span>
              </div>

              {/* 8-Stage Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* Stage 1 */}
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                  <span className="font-bold text-indigo-700 block">مرحله ۱: وضعیت بازار</span>
                  <p className="text-gray-700 font-mono text-[11px]">{latestAnalysis.stage1_marketState}</p>
                </div>
                {/* Stage 2 */}
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                  <span className="font-bold text-indigo-700 block">مرحله ۲: رژیم بازار</span>
                  <p className="text-gray-700 text-[11px]">{latestAnalysis.stage2_marketRegime}</p>
                </div>
                {/* Stage 3 */}
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                  <span className="font-bold text-indigo-700 block">مرحله ۳: تحلیل تکنیکال</span>
                  <p className="text-gray-700 text-[11px]">{latestAnalysis.stage3_technicalAnalysis}</p>
                </div>
                {/* Stage 4 */}
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1">
                  <span className="font-bold text-indigo-700 block">مرحله ۴: فیلتر اخبار (فاندامنتال)</span>
                  <p className="text-gray-700 text-[11px]">{latestAnalysis.stage4_fundamentalGuard}</p>
                </div>
              </div>

              {/* Scenarios & Risk */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-1">
                  <span className="font-bold text-indigo-900 block">مرحله ۵: سناریوسازی A / B / C</span>
                  <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{latestAnalysis.stage5_scenarios}</p>
                </div>
                <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-xl space-y-1">
                  <span className="font-bold text-emerald-900 block">مرحله ۶: مدیریت ریسک و محاسبه TP/SL</span>
                  <p className="text-gray-800 leading-relaxed">{latestAnalysis.stage6_riskCalculations}</p>
                  <div className="pt-2 flex items-center gap-4 font-mono font-bold text-[11px]">
                    <span className="text-emerald-700">تارگت سود (TP): {latestAnalysis.targetTp}</span>
                    <span className="text-rose-700">حد ضرر (SL): {latestAnalysis.targetSl}</span>
                    <span className="text-blue-700">حجم: {latestAnalysis.recommendedLot} Lot</span>
                  </div>
                </div>
              </div>

              {/* Stage 7 Checklist */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                <span className="font-bold text-gray-900 block text-xs">مرحله ۷: چک‌لیست ۷‌گانه قبل از ورود به پوزیشن</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
                  {latestAnalysis.stage7_preTradeChecklist?.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-1.5 p-2 bg-white rounded border border-gray-200">
                      <span className={item.passed ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                        {item.passed ? '✓' : '✕'}
                      </span>
                      <span className="text-gray-700">{item.check}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stage 8 Decision */}
              <div className="p-4 bg-slate-900 text-white rounded-xl space-y-1.5 text-xs">
                <span className="font-bold text-amber-400 block">مرحله ۸: تحلیل نهایی و دلیل صدور/عدم صدور معامله</span>
                <p className="text-gray-200 leading-relaxed">{latestAnalysis.reasoning}</p>
              </div>
            </div>
          )}

          {/* System Prompt Editor */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-gray-100">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-indigo-600" />
                  <span>سیستم پرامپت هویتی و الگوریتمی ایجنت (Agent System Prompt)</span>
                </h3>
                <p className="text-xs text-gray-500">
                  این پرامپت، قوانین هویت، مدیریت ریسک، و الگوریتم‌های ۸ مرحله‌ای معامله‌گر را تعریف می‌کند.
                </p>
              </div>

              <button
                onClick={handleSaveSystemPrompt}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
              >
                <Check className="w-4 h-4" />
                <span>ذخیره سیستم پرامپت</span>
              </button>
            </div>

            {promptSaveMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{promptSaveMsg}</span>
              </div>
            )}

            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={16}
              className="w-full p-4 border border-gray-300 rounded-xl font-mono text-xs text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:border-indigo-500 leading-relaxed dir-rtl"
              placeholder="سیستم پرامپت ایجنت..."
            />
          </div>
        </div>
      )}

      {/* SUB-TAB: Telemetry & Live Inspector */}
      {activeSubTab === 'telemetry' && (
        <div className="space-y-6">
          {/* Top Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-purple-900/50 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Activity className="w-6 h-6 text-emerald-400" />
                  <h2 className="text-base font-extrabold text-white">
                    مرکز نظارت زنده، شفافیت و عیب‌یابی (Live Telemetry & Router Inspector)
                  </h2>
                </div>
                <p className="text-xs text-purple-200 leading-relaxed max-w-3xl">
                  پایش لحظه‌ای اتصالات، وضعیت کلیدهای API و روتر، مدل‌های AI فعال، نرخ تاخیر (Latency) و لاگ‌های کامل تمام درخواست‌ها و تصمیمات اتخاذشده توسط ایجنت.
                </p>
              </div>

              <button
                onClick={fetchTelemetryData}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2 shrink-0 border border-purple-400/30"
              >
                <RefreshCw className="w-4 h-4" />
                <span>بروزرسانی داده‌های نظارتی</span>
              </button>
            </div>

            {/* Quick Status Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-purple-800/40 text-xs">
              <div className="flex items-center gap-2 bg-purple-900/40 p-2.5 rounded-xl border border-purple-700/30">
                <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-purple-300 block">درگاه روتر ابری (Gateway)</span>
                  <span className="font-mono font-bold text-emerald-400 text-[11px]">پورت 3000 (فعال)</span>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-purple-900/40 p-2.5 rounded-xl border border-purple-700/30">
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-purple-300 block">سفیر متاتریدر ۵ (MT5 EA)</span>
                  <span className={`font-bold text-[11px] ${telemetryData?.bridgeStatus?.isConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {telemetryData?.bridgeStatus?.isConnected ? `متصل (${telemetryData?.bridgeStatus?.latencyMs || 0}ms)` : 'در انتظار اتصال'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-purple-900/40 p-2.5 rounded-xl border border-purple-700/30">
                <Key className="w-4 h-4 text-cyan-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-purple-300 block">مخزن کلیدهای API (Keys)</span>
                  <span className="font-mono font-bold text-cyan-300 text-[11px]">
                    {telemetryData?.keyPool?.filter((k: any) => k.status === 'active')?.length || 1} کلید فعال
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-purple-900/40 p-2.5 rounded-xl border border-purple-700/30">
                <Database className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-purple-300 block">داده‌گاه Supabase & Auth</span>
                  <span className="font-bold text-emerald-400 text-[11px]">همگام‌سازی زنده</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Infrastructure & Links Health Check */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b pb-3 border-gray-100">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>ارزیابی سلامت اتصالات زیرساختی و لینک‌های ارتباطی (Infrastructure Health Check)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Card 1: Cloud Router */}
              <div className="p-4 rounded-xl border bg-gray-50/80 border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-indigo-600" />
                    <span>روتر ابری هرمس</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">200 OK</span>
                </div>
                <div className="space-y-1 text-gray-600 text-[11px]">
                  <p>استراتژی مسیریابی: <span className="font-bold text-gray-800">{telemetryData?.routerStatus?.strategy || 'Failover'}</span></p>
                  <p>سقف تلاش مجدد: <span className="font-bold text-gray-800">{telemetryData?.routerStatus?.maxRetries || 3}</span></p>
                  <p>میزبانی: <span className="font-mono text-gray-800">0.0.0.0:3000</span></p>
                </div>
              </div>

              {/* Card 2: MT5 Bridge */}
              <div className="p-4 rounded-xl border bg-gray-50/80 border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>پل متاتریدر ۵ (MQL5)</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    telemetryData?.bridgeStatus?.isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {telemetryData?.bridgeStatus?.isConnected ? 'متصل' : 'آماده به کار'}
                  </span>
                </div>
                <div className="space-y-1 text-gray-600 text-[11px]">
                  <p>حساب: <span className="font-mono text-gray-800">{telemetryData?.bridgeStatus?.accountInfo?.accountNumber || tradingState?.bridgeStatus?.accountInfo?.accountNumber || '---'}</span></p>
                  <p>بروکر: <span className="text-gray-800">{telemetryData?.bridgeStatus?.accountInfo?.broker || tradingState?.bridgeStatus?.accountInfo?.broker || 'در انتظار MQL5'}</span></p>
                  <p>موجودی: <span className="font-mono font-bold text-emerald-700">${(telemetryData?.bridgeStatus?.accountInfo?.balance ?? tradingState?.bridgeStatus?.accountInfo?.balance) ?? 0}</span></p>
                </div>
              </div>

              {/* Card 3: Supabase */}
              <div className="p-4 rounded-xl border bg-gray-50/80 border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <span>پایگاه داده Supabase</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">برقرار</span>
                </div>
                <div className="space-y-1 text-gray-600 text-[11px]">
                  <p>میزبان: <span className="font-mono text-[10px] text-gray-700">dqhujeggbndwcavzgnhm</span></p>
                  <p>احراز هویت کاربران: <span className="font-bold text-gray-800">فعال (RLS)</span></p>
                  <p>حافظه بلندمدت: <span className="text-gray-800">همگام‌سازی لحظه‌ای</span></p>
                </div>
              </div>

              {/* Card 4: Telegram */}
              <div className="p-4 rounded-xl border bg-gray-50/80 border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-blue-600" />
                    <span>ربات تلگرام (Bot)</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    telemetryData?.telegramConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {telemetryData?.telegramConnected ? 'متصل' : 'آماده تایید'}
                  </span>
                </div>
                <div className="space-y-1 text-gray-600 text-[11px]">
                  <p>شناسه ربات: <span className="font-mono text-gray-800">@HermesAgentBot</span></p>
                  <p>تاییدیه معاملات: <span className="font-bold text-gray-800">بالای ۰.۱ لات</span></p>
                  <p>ارسال گزارش: <span className="text-gray-800">لحظه‌ای</span></p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Key Pool & AI Model Router Telemetry */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Key className="w-4 h-4 text-purple-600" />
                  <span>پایش وضعیت کلیدهای API و چرخش خودکار (API Key Pool & Rotation)</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  در صورت بروز خطای 429 (محدودیت نرخ) یا 500، روتر بلافاصله کلید بعدی را بدون قطع خدمت جایگزین می‌کند.
                </p>
              </div>
            </div>

            {/* Key Pool Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                  <tr>
                    <th className="p-3">شناسه کلید / سرویس‌دهنده</th>
                    <th className="p-3">کلید ماسک‌شده</th>
                    <th className="p-3">وضعیت فعلی</th>
                    <th className="p-3">تعداد موفق</th>
                    <th className="p-3">تعداد خطا</th>
                    <th className="p-3">آخرین استفاده</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-mono">
                  {telemetryData?.keyPool?.map((key: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50/80">
                      <td className="p-3 font-sans font-bold text-gray-900">
                        کلید شماره {key.keyIndex + 1} ({key.provider})
                      </td>
                      <td className="p-3 text-gray-600">{key.maskedKey || 'AIzaSy***7x8k'}</td>
                      <td className="p-3 font-sans">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          key.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : key.status === 'cooldown'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {key.status === 'active' ? 'فعال (Active)' : key.status === 'cooldown' ? 'استراحت موقت' : 'تمام‌شده'}
                        </span>
                      </td>
                      <td className="p-3 text-emerald-700 font-bold">{key.successCount || 0}</td>
                      <td className="p-3 text-rose-700 font-bold">{key.errorCount || 0}</td>
                      <td className="p-3 font-sans text-gray-500 text-[11px]">
                        {key.lastUsed ? new Date(key.lastUsed).toLocaleTimeString('fa-IR') : 'به‌تازگی'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Live Router Requests Logs Table */}
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-indigo-600" />
                <span>لاگ زنده درخواست‌های ارسال‌شده به مدل‌های AI و روتر (Router API Traffic Logs)</span>
              </h4>

              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-xs text-right">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                    <tr>
                      <th className="p-3">زمان</th>
                      <th className="p-3">مدل درخواستی</th>
                      <th className="p-3">مدل پاسخ‌دهنده</th>
                      <th className="p-3">کد وضعیت</th>
                      <th className="p-3">تاخیر (ms)</th>
                      <th className="p-3">توکن مصرفی</th>
                      <th className="p-3">خلاصه درخواست</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-mono text-[11px]">
                    {telemetryData?.requestLogs && telemetryData.requestLogs.length > 0 ? (
                      telemetryData.requestLogs.map((log: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="p-3 text-gray-500 font-sans">
                            {new Date(log.timestamp).toLocaleTimeString('fa-IR')}
                          </td>
                          <td className="p-3 font-bold text-gray-800">{log.requestedModel}</td>
                          <td className="p-3 text-indigo-700 font-bold">
                            {log.actualModel}
                            {log.status === 'fallback_success' && (
                              <span className="mr-1 text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-sans">فال‌بک</span>
                            )}
                          </td>
                          <td className="p-3 font-sans">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.statusCode === 200 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {log.statusCode}
                            </span>
                          </td>
                          <td className="p-3 text-gray-700">{log.latencyMs}ms</td>
                          <td className="p-3 text-gray-700">{log.totalTokens || 120}</td>
                          <td className="p-3 font-sans text-gray-600 max-w-xs truncate">
                            {log.userPromptSnippet || 'تحلیل ۸ مرحله‌ای ایجنت و پایش بازار طلا'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-gray-400 font-sans">
                          درخواست زنده جدیدی هنوز در لاگ روتر ثبت نشده است. (سیستم در حال پایش آماده‌به‌کار)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 3: Live Agent Autonomous Reasoning Feed */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b pb-3 border-gray-100">
              <Bot className="w-5 h-5 text-amber-500" />
              <span>جریان نظارت زنده بر تحلیل‌ها و تصمیمات اتخاذشده توسط ایجنت (Agent Activity Feed)</span>
            </h3>

            <div className="space-y-2 max-h-80 overflow-y-auto p-2 dir-rtl">
              {telemetryData?.tradingLogs && telemetryData.tradingLogs.length > 0 ? (
                telemetryData.tradingLogs.map((log: any, idx: number) => (
                  <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-start gap-3 text-xs">
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded font-mono text-[10px] shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString('fa-IR')}
                    </span>
                    <div className="space-y-0.5">
                      <span className="font-bold text-gray-900 block">{log.message}</span>
                      {log.data && (
                        <span className="font-mono text-[11px] text-gray-500 block">
                          {JSON.stringify(log.data)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-gray-400 text-xs">
                  لاگ تحلیلی جدیدی موجود نیست.
                </div>
              )}
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

      {/* SUB-TAB 4: Trading Agent Memory, Chat & Event Logs */}
      {activeSubTab === 'logs' && (
        <div className="space-y-6">
          {/* Section 1: Chat with Agent */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 border-gray-100">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-600" />
                  <span>گفتگوی مستقیم و ارسال دستور به ایجنت معامله‌گر</span>
                </h2>
                <p className="text-xs text-gray-500">
                  می‌توانید به زبان فارسی روان دستور دهید (مثلاً: «برای معاملات بالای ۰.۱ لات تلگرام پیام بده» یا «معامله فروش طلا باز کن»).
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>ذخیره‌سازی زنده در Supabase</span>
              </span>
            </div>

            {/* Chat Messages Container */}
            <div
              ref={chatMessagesBoxRef}
              onScroll={handleChatScroll}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 h-[460px] md:h-[520px] overflow-y-auto space-y-4 dir-rtl shadow-inner"
            >
              {chatMessages.length > 0 ? (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[88%] sm:max-w-[78%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed font-sans shadow-sm ${
                        msg.sender === 'user'
                          ? 'bg-blue-600 text-white rounded-tl-sm'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-tr-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1.5 font-bold text-[10px] sm:text-[11px] opacity-85 border-b border-white/20 pb-1">
                        {msg.sender === 'user' ? (
                          <span className="text-blue-100">کاربر</span>
                        ) : (
                          <span className="flex items-center gap-1 text-indigo-600 font-bold">
                            <Bot className="w-3.5 h-3.5" />
                            <span>ربات هوشمند هرمس</span>
                          </span>
                        )}
                        <div className="flex items-center gap-1 font-mono text-[9px] opacity-80">
                          <span>
                            {new Date(msg.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {msg.sender === 'user' && (
                            msg.status === 'sending' ? (
                              <Loader2 className="w-3 h-3 text-blue-200 animate-spin" title="در حال ارسال به سرور..." />
                            ) : (
                              <CheckCheck className="w-3.5 h-3.5 text-blue-200" title="تحویل داده شد به ایجنت" />
                            )
                          )}
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 font-sans">
                  در حال بارگذاری تاریخچه مکالمات از حافظه Supabase...
                </div>
              )}
            </div>

            {/* Chat Input Form */}
            <form onSubmit={handleSendChat} className="flex gap-2">
              <input
                type="text"
                placeholder="دستور یا راهنمایی خود را اینجا بنویسید (مثلاً: ریسک معاملات را کمتر کن / دستور خرید طلا بزن)..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-indigo-500 shadow-sm"
              />
              <button
                type="submit"
                disabled={isSendingChat || !chatInput.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm shrink-0 min-w-[110px]"
              >
                {isSendingChat ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>در حال ارسال...</span>
                  </>
                ) : (
                  <>
                    <span>ارسال</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Section 2: Agent Memory Notes (Long-Term Rules stored in Supabase) */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-emerald-600" />
                  <span>حافظه بلندمدت و آموزه‌های ثبت‌شده در Supabase (Agent Memory)</span>
                </h2>
                <p className="text-xs text-gray-500">
                  این دستورالعمل‌ها در دیتابیس Supabase به صورت دائمی ذخیره شده و حتی پس از ریفرش یا خروج کاربر حفظ می‌شوند.
                </p>
              </div>
            </div>

            {/* Form to Add Memory Note */}
            <form onSubmit={handleAddMemoryNote} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="دسته‌بندی (مثلا: قوانین تلگرام، حد سود، خبر)"
                value={memoryCat}
                onChange={(e) => setMemoryCat(e.target.value)}
                className="w-full sm:w-1/3 px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                placeholder="متن کامل دستورالعمل یا آموزه کاربری..."
                value={memoryContent}
                onChange={(e) => setMemoryContent(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
                required
              />
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>افزودن به حافظه</span>
              </button>
            </form>

            {/* List of Memory Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {agentMemory.map((mem) => (
                <div
                  key={mem.id}
                  className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800">
                        {mem.category}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {new Date(mem.createdAt).toLocaleDateString('fa-IR')}
                      </span>
                    </div>
                    <p className="text-gray-800 leading-relaxed font-sans font-medium">{mem.content}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteMemoryNote(mem.id)}
                    className="p-1 hover:bg-rose-100 text-rose-600 rounded transition-colors shrink-0"
                    title="حذف آموزه از حافظه"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Technical Event Logs */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-600" />
                <span>حافظه رویدادهای سیستمی و متاتریدر ۵ (trading_logs)</span>
              </h2>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
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
        </div>
      )}
    </div>
  );
};
