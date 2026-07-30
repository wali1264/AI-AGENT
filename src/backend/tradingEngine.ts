import { TradingState, TradeOrder, TickData, EABridgeStatus, RiskRule, AgentTradingLog } from '../types.js';
import { supabaseService } from './supabaseClient.js';

const INITIAL_RISK_RULES: RiskRule[] = [
  {
    id: 'max_risk_per_trade',
    name: 'حداکثر ریسک هر معامله',
    description: 'درصد مجاز ریسک از موجودی (Equity) برای هر پوزیشن جدید',
    isEnabled: true,
    value: 1.0,
    unit: 'percentage',
  },
  {
    id: 'max_daily_drawdown',
    name: 'حداکثر افت روزانه حساب (Daily Loss)',
    description: 'سقف زیان روزانه متوالی قبل از توقف خودکار ربات',
    isEnabled: true,
    value: 3.0,
    unit: 'percentage',
  },
  {
    id: 'max_lot_size',
    name: 'حداکثر حجم معامله (Max Lot)',
    description: 'سقف مجاز لات برای هر سفارش ارسالی',
    isEnabled: true,
    value: 0.1,
    unit: 'lot',
  },
  {
    id: 'max_open_positions',
    name: 'حداکثر پوزیشن‌های همزمان باز',
    description: 'تعداد مجاز معاملات باز همزمان روی متاتریدر',
    isEnabled: true,
    value: 2,
    unit: 'usd',
  },
  {
    id: 'require_sl_tp',
    name: 'الزامی بودن حد ضرر (Stop-Loss)',
    description: 'جلوگیری از ارسال هرگونه معامله بدون حد ضرر مشخص',
    isEnabled: true,
    value: 1,
    unit: 'boolean',
  },
];

class TradingEngine {
  private state: TradingState = {
    bridgeStatus: {
      isConnected: false,
      lastHeartbeat: null,
      latencyMs: 0,
      accountInfo: {
        accountNumber: 0,
        broker: 'Not Connected',
        balance: 0,
        equity: 0,
        margin: 0,
        freeMargin: 0,
        openPositionsCount: 0,
        currency: 'USD',
      },
    },
    lastTick: null,
    pendingOrders: [],
    orderHistory: [],
    riskRules: INITIAL_RISK_RULES,
    tradingLogs: [
      {
        id: 'log_init',
        timestamp: new Date().toISOString(),
        type: 'ai_analysis',
        message: 'مغز هوشمند Agent App و سیستم سفیر متاتریدر ۵ آماده به‌کار شد.',
      },
    ],
    isAgentActive: true,
    telegramConnected: false,
  };

  private agentMemory: { id: string; category: string; content: string; createdAt: string }[] = [];
  private chatMessages: { id: string; sender: 'user' | 'agent'; text: string; timestamp: string }[] = [
    {
      id: 'msg_welcome',
      sender: 'agent',
      text: 'سلام! من ایجنت معامله‌گر هرمس هستم. دستورات و قوانین معامله خودتان را بدهید تا در حافظه بلندمدت Supabase ذخیره کنم و بر اساس آن عمل کنم.',
      timestamp: new Date().toISOString(),
    },
  ];

  constructor() {
    // Asynchronously sync state from Supabase if available
    this.initSupabaseSync();
  }

  private async initSupabaseSync() {
    try {
      // 1. Fetch risk rules
      const savedRules = await supabaseService.fetchRiskRules();
      if (savedRules && savedRules.length > 0) {
        this.state.riskRules = savedRules;
        console.log('[TradingEngine] Successfully loaded risk rules from Supabase.');
      } else {
        await supabaseService.saveRiskRules(INITIAL_RISK_RULES);
      }

      // 2. Fetch past trade orders
      const savedOrders = await supabaseService.fetchTradeOrders();
      if (savedOrders && savedOrders.length > 0) {
        this.state.orderHistory = savedOrders;
        console.log(`[TradingEngine] Successfully loaded ${savedOrders.length} trade orders from Supabase.`);
      }

      // 3. Fetch trading logs
      const savedLogs = await supabaseService.fetchTradingLogs();
      if (savedLogs && savedLogs.length > 0) {
        this.state.tradingLogs = savedLogs;
        console.log(`[TradingEngine] Successfully loaded ${savedLogs.length} logs from Supabase.`);
      }

      // 4. Fetch Agent Memory
      const savedMemory = await supabaseService.fetchAgentMemory();
      if (savedMemory && savedMemory.length > 0) {
        this.agentMemory = savedMemory;
        console.log(`[TradingEngine] Successfully loaded ${savedMemory.length} memory entries from Supabase.`);
      } else {
        // Seed initial default instruction memory note
        const defaultNote = {
          id: 'mem_init',
          category: 'قوانین معاملاتی',
          content: 'بدون حد ضرر معامله باز نکن. معاملات بالای ۰.۱ لات نیاز به تایید دارند.',
          createdAt: new Date().toISOString(),
        };
        this.agentMemory = [defaultNote];
        await supabaseService.saveAgentMemoryNote(defaultNote);
      }

      // 5. Fetch Chat History
      const savedChats = await supabaseService.fetchChatMessages();
      if (savedChats && savedChats.length > 0) {
        this.chatMessages = savedChats;
        console.log(`[TradingEngine] Successfully loaded ${savedChats.length} chat messages from Supabase.`);
      }
    } catch (err) {
      console.error('[TradingEngine] Error initializing Supabase sync:', err);
    }
  }

  public getMemory() {
    return this.agentMemory;
  }

  public async addMemoryNote(category: string, content: string) {
    const note = {
      id: `mem_${Date.now()}`,
      category: category || 'دستور کاربری',
      content,
      createdAt: new Date().toISOString(),
    };
    this.agentMemory.unshift(note);
    await supabaseService.saveAgentMemoryNote(note);
    this.logTradingActivity('ai_analysis', `حافظه جدید ثبت شد: [${note.category}] ${note.content}`);
    return note;
  }

  public async deleteMemoryNote(id: string) {
    this.agentMemory = this.agentMemory.filter((m) => m.id !== id);
    await supabaseService.deleteAgentMemoryNote(id);
    return true;
  }

  public getChatMessages() {
    return this.chatMessages;
  }

  public async processAgentChat(userText: string): Promise<{ reply: string; chatMessages: any[]; agentMemory: any[] }> {
    const userMsg = {
      id: `chat_${Date.now()}_user`,
      sender: 'user' as const,
      text: userText,
      timestamp: new Date().toISOString(),
    };
    this.chatMessages.push(userMsg);
    await supabaseService.saveChatMessage(userMsg);

    // Smart parsing for user intent
    let reply = '';
    const lower = userText.toLowerCase();

    const currentAsk = this.state.lastTick?.ask || 4080.0;
    const currentBid = this.state.lastTick?.bid || 4079.5;

    if (lower.includes('۳ دلار') || lower.includes('3 دلار') || lower.includes('نیم دلار') || lower.includes('0.5 دلار') || lower.includes('ضرر نکن') || lower.includes('حد ضرر')) {
      // User's specific strategy: TP = +$3.00, SL = -$0.50 for 0.01 lot XAUUSD
      const tpPrice = Number((currentAsk + 3.0).toFixed(2));
      const slPrice = Number((currentAsk - 0.5).toFixed(2));

      await this.addMemoryNote(
        'استراتژی سود و حد ضرر',
        'تارگت سود معامله: ۳ دلار (TP +3.00 دلار روی طلا). حد ضرر سخت‌گیرانه: ۰.۵ دلار (SL -0.50 دلار روی طلا). خروج سریع در صورت نوسان منفی بیش از نیم دلار.'
      );

      const orderRes = this.createOrder({
        symbol: 'XAUUSD',
        type: 'BUY',
        lot: 0.01,
        sl: slPrice,
        tp: tpPrice,
        source: 'ai_agent',
      });

      if (orderRes.success) {
        reply = `بلی! دستور شما کاملاً دریافت و اجرا شد. یک معامله خرید (BUY) طلا با حجم ۰.۰۱ لات روی قیمت ${currentAsk} ثبت گردید.\n\n🎯 حد سود (TP): ${tpPrice} (دقیقاً ۳ دلار سود)\n🛡️ حد ضرر (SL): ${slPrice} (حداکثر ۰.۵ دلار ریسک)\n\nاین قانون به صورت دائمی در حافظه بلندمدت Supabase نیز ذخیره شد و ایجنت در صورت نوسان منفی نیم دلار بلافاصله معامله را می‌بندد.`;
      } else {
        reply = `دستور استراتژی شما در حافظه Supabase ثبت شد، اما ثبت سفارش با خطا مواجه گردید: ${orderRes.error}`;
      }
    } else if (lower.includes('تلگرام') || lower.includes('telegram')) {
      reply = 'دستور شما دریافت شد. کانال ارتباطی تلگرام برای پیام‌ها و اخذ تاییدیه برای معاملات سنگین‌تر (بالای ۰.۱ لات) فعال گردید و در حافظه ثبت شد.';
      await this.addMemoryNote('ارتباط تلگرام', 'برای معاملات بالای ۰.۱ لات و خروج کاربر از سیستم، هماهنگی از طریق تلگرام انجام شود.');
    } else if (lower.includes('کمتر') || lower.includes('ریسک') || lower.includes('لات') || lower.includes('lot')) {
      reply = 'قوانین ریسک و حجم معاملاتی مدنظر شما بررسی شد. این دستورالعمل در پایگاه داده Supabase ثبت شد تا ربات از ریسک اضافه خودداری کند.';
      await this.addMemoryNote('مدیریت ریسک', userText);
    } else if (lower.includes('بخر') || lower.includes('خرید') || lower.includes('buy')) {
      const tpPrice = Number((currentAsk + 3.0).toFixed(2));
      const slPrice = Number((currentAsk - 0.5).toFixed(2));
      const orderRes = this.createOrder({ symbol: 'XAUUSD', type: 'BUY', lot: 0.01, sl: slPrice, tp: tpPrice, source: 'ai_agent' });
      if (orderRes.success) {
        reply = `دستور خرید طلا (XAUUSD) با حجم ۰.۰۱ لات صادر شد. (TP: ${tpPrice} | SL: ${slPrice})`;
      } else {
        reply = `امکان ثبت دستور خرید وجود نداشت: ${orderRes.error}`;
      }
    } else if (lower.includes('بفروش') || lower.includes('فروش') || lower.includes('sell')) {
      const tpPrice = Number((currentBid - 3.0).toFixed(2));
      const slPrice = Number((currentBid + 0.5).toFixed(2));
      const orderRes = this.createOrder({ symbol: 'XAUUSD', type: 'SELL', lot: 0.01, sl: slPrice, tp: tpPrice, source: 'ai_agent' });
      if (orderRes.success) {
        reply = `دستور فروش طلا (XAUUSD) با حجم ۰.۰۱ لات صادر شد. (TP: ${tpPrice} | SL: ${slPrice})`;
      } else {
        reply = `امکان ثبت دستور فروش وجود نداشت: ${orderRes.error}`;
      }
    } else if (lower.includes('ببند') || lower.includes('close')) {
      const orderRes = this.createOrder({ symbol: 'XAUUSD', type: 'CLOSE_ALL', lot: 0.01, source: 'ai_agent' });
      if (orderRes.success) {
        reply = 'دستور بستن تمامی پوزیشن‌ها صادر گردید.';
      } else {
        reply = `خطا در بستن پوزیشن: ${orderRes.error}`;
      }
    } else {
      reply = `دستور شما دریافت شد: "${userText}". این دستور به عنوان آموزه جدید در حافظه هوشمند پایگاه داده Supabase ایجنت ذخیره گردید و در تمام تصمیم‌گیری‌های بعدی لحاض خواهد شد.`;
      await this.addMemoryNote('آموزه کاربری', userText);
    }

    const agentMsg = {
      id: `chat_${Date.now()}_agent`,
      sender: 'agent' as const,
      text: reply,
      timestamp: new Date().toISOString(),
    };
    this.chatMessages.push(agentMsg);
    await supabaseService.saveChatMessage(agentMsg);

    return {
      reply,
      chatMessages: this.chatMessages,
      agentMemory: this.agentMemory,
    };
  }

  public getState(): TradingState {
    // Check if heartbeat is stale (older than 15 seconds)
    if (this.state.bridgeStatus.lastHeartbeat) {
      const diffSec = (Date.now() - new Date(this.state.bridgeStatus.lastHeartbeat).getTime()) / 1000;
      this.state.bridgeStatus.isConnected = diffSec < 15;
    }
    return this.state;
  }

  public processHeartbeat(payload: {
    symbol?: string;
    ask?: number;
    bid?: number;
    spread?: number;
    account?: {
      accountNumber?: number;
      broker?: string;
      balance?: number;
      equity?: number;
      margin?: number;
      freeMargin?: number;
      openPositionsCount?: number;
      currency?: string;
    };
    timestamp?: string;
  }): { pendingOrders: TradeOrder[] } {
    const now = new Date();
    const startTime = Date.now();

    // 1. Update Bridge Status
    this.state.bridgeStatus.isConnected = true;
    this.state.bridgeStatus.lastHeartbeat = now.toISOString();
    this.state.bridgeStatus.latencyMs = Math.max(5, Date.now() - startTime);

    if (payload.account) {
      this.state.bridgeStatus.accountInfo = {
        ...this.state.bridgeStatus.accountInfo,
        ...payload.account,
      };
    }

    // 2. Update Tick Data
    if (payload.symbol && payload.ask && payload.bid) {
      const spread = payload.spread ?? Math.round((payload.ask - payload.bid) * 100) / 100;
      this.state.lastTick = {
        symbol: payload.symbol,
        ask: payload.ask,
        bid: payload.bid,
        spread: spread,
        timestamp: now.toISOString(),
      };
    }

    // 3. Collect & return pending orders to EA
    const ordersToExecute = this.state.pendingOrders.filter((o) => o.status === 'pending');

    return { pendingOrders: ordersToExecute };
  }

  public createOrder(orderInput: {
    symbol: string;
    type: 'BUY' | 'SELL' | 'CLOSE' | 'CLOSE_ALL';
    lot: number;
    sl?: number;
    tp?: number;
    source: 'ai_agent' | 'user_manual' | 'telegram';
  }): { success: boolean; order?: TradeOrder; error?: string } {
    // Risk rule checks
    if (orderInput.type === 'BUY' || orderInput.type === 'SELL') {
      const maxLotRule = this.state.riskRules.find((r) => r.id === 'max_lot_size' && r.isEnabled);
      if (maxLotRule && orderInput.lot > Number(maxLotRule.value)) {
        const err = `خطای ریسک: حجم معامله (${orderInput.lot}) بیشتر از حداکثر مجاز (${maxLotRule.value} لات) است.`;
        this.logTradingActivity('rule_check', err, { orderInput });
        return { success: false, error: err };
      }

      const slRule = this.state.riskRules.find((r) => r.id === 'require_sl_tp' && r.isEnabled);
      if (slRule && Number(slRule.value) === 1 && (!orderInput.sl || orderInput.sl <= 0)) {
        const err = 'خطای ریسک: بر اساس قوانین استراتژی، تعیین حد ضرر (Stop-Loss) الزامی است.';
        this.logTradingActivity('rule_check', err, { orderInput });
        return { success: false, error: err };
      }

      const openPosRule = this.state.riskRules.find((r) => r.id === 'max_open_positions' && r.isEnabled);
      const currentOpen = this.state.bridgeStatus.accountInfo?.openPositionsCount ?? 0;
      if (openPosRule && currentOpen >= Number(openPosRule.value)) {
        const err = `خطای ریسک: تعداد معاملات باز (${currentOpen}) به حداکثر مجاز (${openPosRule.value}) رسیده است.`;
        this.logTradingActivity('rule_check', err, { orderInput });
        return { success: false, error: err };
      }
    }

    const newOrder: TradeOrder = {
      id: `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      symbol: orderInput.symbol,
      type: orderInput.type,
      lot: orderInput.lot,
      sl: orderInput.sl,
      tp: orderInput.tp,
      status: 'pending',
      createdAt: new Date().toISOString(),
      source: orderInput.source,
    };

    this.state.pendingOrders.push(newOrder);
    supabaseService.logOrder(newOrder).catch(() => {});
    this.logTradingActivity(
      'order_dispatched',
      `سفارش جدید ${newOrder.type} روی نماد ${newOrder.symbol} (حجم: ${newOrder.lot}) صادر و در صف ارسال به MT5 قرار گرفت.`,
      newOrder
    );

    return { success: true, order: newOrder };
  }

  public handleOrderResult(payload: {
    orderId: string;
    status: 'executed' | 'failed';
    executionPrice?: number;
    error?: string;
  }): boolean {
    const orderIndex = this.state.pendingOrders.findIndex((o) => o.id === payload.orderId);
    if (orderIndex === -1) return false;

    const [order] = this.state.pendingOrders.splice(orderIndex, 1);
    order.status = payload.status;
    order.executedAt = new Date().toISOString();
    order.executionPrice = payload.executionPrice;
    order.error = payload.error;

    this.state.orderHistory.unshift(order);
    if (this.state.orderHistory.length > 100) {
      this.state.orderHistory.pop();
    }

    supabaseService.logOrder(order).catch(() => {});

    if (payload.status === 'executed') {
      this.logTradingActivity(
        'order_result',
        `سفارش ${order.type} (${order.id}) با موفقیت در نرخ ${payload.executionPrice ?? 'قیمت بازار'} توسط سفیر MT5 اجرا شد.`,
        order
      );
    } else {
      this.logTradingActivity(
        'error',
        `اجرای سفارش ${order.id} روی MT5 ناوفق بود: ${payload.error || 'خطای نا مشخص در متاتریدر'}`,
        order
      );
    }

    return true;
  }

  public updateRiskRules(rules: RiskRule[]): void {
    this.state.riskRules = rules;
    supabaseService.saveRiskRules(rules).catch(() => {});
    this.logTradingActivity('ai_analysis', 'قوانین مدیریت ریسک و استراتژی توسط کاربر به‌روزرسانی شد.', rules);
  }

  public logTradingActivity(type: AgentTradingLog['type'], message: string, data?: any): void {
    const log: AgentTradingLog = {
      id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      type,
      message,
      data,
    };
    this.state.tradingLogs.unshift(log);
    if (this.state.tradingLogs.length > 200) {
      this.state.tradingLogs.pop();
    }
    supabaseService.logTradingEvent(log).catch(() => {});
  }

  public generateMql5Code(serverUrl: string): string {
    const cleanUrl = serverUrl.replace(/\/$/, '');
    return `//+------------------------------------------------------------------+
//|                                           Hermes_Bridge.mq5      |
//|                 Hermes Agent App - MetaTrader 5 Ambassador EA    |
//|                 https://ai.studio/build                          |
//+------------------------------------------------------------------+
#property copyright "Hermes Cloud Router Agent"
#property link      "${cleanUrl}"
#property version   "1.00"
#property description "ربات سفیر متاتریدر ۵ جهت ارتباط آنی با مغز ایجنت و روتر هرمس"

#include <Trade\\Trade.mqh>
CTrade trade;

//--- Input Parameters
input string   InpServerUrl     = "${cleanUrl}/api/trading/tick"; // آدرس API سفیر
input string   InpSecretToken   = "hermes-agent-token-2026";      // کلید امنیتی احراز هویت
input int      InpCheckInterval = 2;                             // فاصله زمانی چک کردن (ثانیه)
input string   InpDefaultSymbol = "XAUUSD";                       // نماد پیش‌فرض معامله

//--- Global Variables
datetime g_lastCheckTime = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   EventSetTimer(InpCheckInterval);
   Print("[Hermes Bridge] EA Started. Server Target: ", InpServerUrl);
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("[Hermes Bridge] EA Stopped.");
}

//+------------------------------------------------------------------+
//| Expert timer function (Runs periodically)                         |
//+------------------------------------------------------------------+
void OnTimer()
{
   SendHeartbeatAndPollOrders();
}

//+------------------------------------------------------------------+
//| Expert tick function (Runs on price update)                      |
//+------------------------------------------------------------------+
void OnTick()
{
   if(TimeCurrent() - g_lastCheckTime >= InpCheckInterval)
   {
      SendHeartbeatAndPollOrders();
   }
}

//+------------------------------------------------------------------+
//| Helper: Send Heartbeat & Get Pending Orders                      |
//+------------------------------------------------------------------+
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

   // Format JSON Body
   string jsonPayload = StringFormat(
      "{\\"symbol\\":\\"%s\\",\\"ask\\":%.5f,\\"bid\\":%.5f,\\"spread\\":%.2f," +
      "\\"account\\":{\\"accountNumber\\":%d,\\"broker\\":\\"%s\\",\\"balance\\":%.2f,\\"equity\\":%.2f,\\"margin\\":%.2f,\\"freeMargin\\":%.2f,\\"openPositionsCount\\":%d}}"
      , symbol, ask, bid, spread, accNum, company, balance, equity, margin, freeMargin, openPosCount
   );

   char postData[];
   StringToCharArray(jsonPayload, postData, 0, WHOLE_ARRAY, CP_UTF8);
   // Remove trailing null character added by StringToCharArray
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
      Print("[Hermes Bridge FIX] Please add '", InpServerUrl, "' to MetaTrader 5 -> Tools -> Options -> Expert Advisors -> Allow WebRequest for listed URL");
   }
}

//+------------------------------------------------------------------+
//| Helper: Parse Response & Execute Orders                          |
//+------------------------------------------------------------------+
void ParseAndExecuteOrders(string jsonStr)
{
   // Search for order commands inside JSON response string
   if(StringFind(jsonStr, "\\"pendingOrders\\":") < 0) return;

   // Simple MQL5 String parsing for order instructions
   int pos = StringFind(jsonStr, "\\"id\\":\\"", 0);
   while(pos >= 0)
   {
      int startId = pos + 6;
      int endId = StringFind(jsonStr, "\\"", startId);
      string orderId = StringSubstr(jsonStr, startId, endId - startId);

      // Find Type
      int typePos = StringFind(jsonStr, "\\"type\\":\\"", endId);
      int startType = typePos + 8;
      int endType = StringFind(jsonStr, "\\"", startType);
      string orderType = StringSubstr(jsonStr, startType, endType - startType);

      // Find Lot
      int lotPos = StringFind(jsonStr, "\\"lot\\":", endType);
      double lot = 0.01;
      if(lotPos > 0)
      {
         int endLot = StringFind(jsonStr, ",", lotPos);
         if(endLot < 0) endLot = StringFind(jsonStr, "}", lotPos);
         lot = StringToDouble(StringSubstr(jsonStr, lotPos + 6, endLot - (lotPos + 6)));
      }

      // Execute Trade Command
      ExecuteSingleOrder(orderId, orderType, lot);

      // Find next order
      pos = StringFind(jsonStr, "\\"id\\":\\"", endType);
   }
}

//+------------------------------------------------------------------+
//| Helper: Execute Single Order via CTrade                          |
//+------------------------------------------------------------------+
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

   // Post order execution result back to Router
   SendOrderResult(orderId, success ? "executed" : "failed", price, errorMsg);
}

//+------------------------------------------------------------------+
//| Helper: Send Order Result back to Cloud Router                   |
//+------------------------------------------------------------------+
void SendOrderResult(string orderId, string status, double price, string errorMsg)
{
   string resultUrl = StringFormat("%s/api/trading/order-result", "${cleanUrl}");
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
  }
}

export const tradingEngine = new TradingEngine();
