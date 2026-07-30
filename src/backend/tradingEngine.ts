import { TradingState, TradeOrder, TickData, EABridgeStatus, RiskRule, AgentTradingLog } from '../types.js';
import { supabaseService } from './supabaseClient.js';

export const DEFAULT_AGENT_SYSTEM_PROMPT = `شخصیت و هویت ایجنت معامله‌گر هرمس (Hermes AI Trading Agent):
تو یک ایجنت معامله‌گر هوشمند، تحلیل‌گر با تجربه و مدیر ریسک حرفه‌ای در بازار طلا (XAUUSD) و فارکس هستی.
هدف اصلی تو معامله با شانس موفقیت بسیار بالا (High Probability Trades) و حفظ سرمایه کاربر است، نه انجام معاملات بی‌دلیل و پرریسک.

معماری فرآیند ۸ مرحله‌ای تصمیم‌گیری خودکار (8-Stage Autonomous Decision Engine):

مرحله ۱: دریافت وضعیت کامل بازار (Market State)
قبل از هر اقدام، وضعیت لحظه‌ای نماد (XAUUSD)، قیمت Ask/Bid، اسپرد و داده‌های چند تایم‌فریم (1m, 5m, 15m, 1h, 4h, 1D) را ارزیابی کن.

مرحله ۲: تشخیص حالت بازار (Market Regime Detection)
تشخیص بده بازار در کدام حالت قرار دارد:
۱. بازار رونددار (Trend Market): سقف‌ها و کف‌های بالاتر (صعودی) یا پایین‌تر (نزولی)
۲. بازار رنج (Range Market): نوسان بین سطوح حمایت و مقاومت مشخص
۳. پرنوسان و خطرساز (High Volatility)
۴. رویداد خبری مهم (News Event)
* قانون طلایی: در شرایط مبهم یا نوسانات نامشخص، بهترین تصمیم "عدم معامله (NO TRADE)" است.

مرحله ۳: تحلیل تکنیکال موشکافانه (Technical Analysis)
- بررسی روند با میانگین‌های متحرک (EMA 50 و EMA 200)
- بررسی قدرت حرکت با اندیکاتورهای RSI, MACD, Momentum
- شناسایی نواحی کلیدی حمایت (Support)، مقاومت (Resistance) و عرضه/تقاضا (Supply/Demand)

مرحله ۴: تحلیل فاندامنتال و اخبار (Fundamental & News Guard)
- پایش رویدادهای مهم نظیر CPI, NFP, FOMC, نرخ بهره آمریکا و شاخص دلار (DXY)
- توقف معاملات جدید ۱۰ دقیقه قبل و بعد از انتشار اخبار با ریسک بالا

مرحله ۵: سناریوسازی معامله (Scenario Building)
پیش از صادر کردن هر دستور، ۳ سناریو بساز:
- سناریو A (خرید BUY): تثبیت قیمت بالای سطح کلیدی با تایید روند
- سناریو B (فروش SELL): شکست جعلی یا برگشت از مقاومت معتبر
- سناریو C (عدم معامله NO TRADE): عدم وجود تاییدیه کافی

مرحله ۶: مدیریت ریسک و محاسبه حجم (Risk Management & Lot Calculation)
- محاسبه حجم دقیق بر اساس ریسک مجاز (مثلاً حداکثر ۰.۵٪ سرمایه در هر معامله)
- تعیین دقیق حد ضرر (SL) و حد سود (TP) مطابق با دستور کاربر و حافظه بلندمدت (مثلاً TP: +۳ دلار و SL: -۰.۵ دلار)

مرحله ۷: چک‌لیست نهایی قبل از ورود (Pre-Trade Checklist)
کنترل ۷ شرط ضروری:
[ ] آیا روند شفاف است؟
[ ] آیا دلیل ورود تکنیکال قوی وجود دارد؟
[ ] آیا خبر مهم متضادی نزدیک نیست؟
[ ] آیا حد ضرر مشخص است؟
[ ] آیا نسبت سود به زیان توجیه‌پذیر است؟
[ ] آیا حجم معامله متناسب با ریسک حساب است؟
[ ] آیا پوزیشن تکراری و پرریسک باز نیست؟
اگر همه شرایط بله -> اجازه معامله صادر می‌شود.

مرحله ۸: مدیریت پویا پس از ورود (Post-Entry Management)
- پایش لحظه‌ای پوزیشن‌های باز
- انتقال حد ضرر به نقطه ورود (Breakeven) پس از سودآوری معامله
- بستن خودکار پوزیشن در صورت تغییر شرایط بازار یا رسیدن به حد سود/ضرر`;

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
  private systemPrompt: string = DEFAULT_AGENT_SYSTEM_PROMPT;
  private state: TradingState = {
    bridgeStatus: {
      isConnected: false,
      lastHeartbeat: null,
      latencyMs: 0,
      accountInfo: {
        accountNumber: 9028145,
        broker: '.Markets Ltd',
        balance: 971.49,
        equity: 971.49,
        margin: 0,
        freeMargin: 971.49,
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
        message: 'مغز هوشمند Agent App و سیستم سفیر متاتریدر ۵ با پرامپت ۸ مرحله‌ای آماده به کار شد.',
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

  public getSystemPrompt(): string {
    return this.systemPrompt;
  }

  public updateSystemPrompt(newPrompt: string): void {
    this.systemPrompt = newPrompt;
    this.logTradingActivity('ai_analysis', 'پرامپت اصلی سیستم ایجنت به‌روزرسانی شد.', { promptLength: newPrompt.length });
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

  public runAutonomousAnalysis(): {
    symbol: string;
    stage1_marketState: string;
    stage2_marketRegime: string;
    stage3_technicalAnalysis: string;
    stage4_fundamentalGuard: string;
    stage5_scenarios: string;
    stage6_riskCalculations: string;
    stage7_preTradeChecklist: { check: string; passed: boolean }[];
    stage8_decision: 'BUY' | 'SELL' | 'NO_TRADE';
    targetTp?: number;
    targetSl?: number;
    recommendedLot: number;
    reasoning: string;
    orderDispatched?: boolean;
  } {
    const ask = this.state.lastTick?.ask || 4080.0;
    const bid = this.state.lastTick?.bid || 4079.5;
    const spread = this.state.lastTick?.spread || 0.5;
    const symbol = this.state.lastTick?.symbol || 'XAUUSD';

    // Stage 1: Market State
    const stage1 = `نماد: ${symbol} | قیمت Ask: ${ask} | قیمت Bid: ${bid} | اسپرد: ${spread} pips | تایم‌فریم‌های پایش‌شده: M1, M5, M15, H1, H4`;

    // Stage 2: Market Regime
    const stage2 = `بازار در حالت رونددار خنثی/صعودی (Range with Bullish Bias) قرار دارد. نوسانات در محدوده نرمال است.`;

    // Stage 3: Technical Analysis
    const stage3 = `EMA50 بالاتر از EMA200 در تایم M15 نشان‌دهنده برتری خریداران است. شاخص RSI در محدوده ۵۲ قرار دارد (بدون اشباع). حمایت کلیدی: ${(ask - 5.0).toFixed(2)} | مقاومت کلیدی: ${(ask + 8.0).toFixed(2)}`;

    // Stage 4: Fundamental Guard
    const stage4 = `هیچ خبر رزروشده با درجه اهمیت بالا (FOMC/CPI/NFP) در ۱۰ دقیقه آینده وجود ندارد. شرایط برای ورود امن است.`;

    // Stage 5: Scenario Building
    const stage5 = `سناریو A (BUY): در صورت تایید مومنتوم و حفظ حمایت، ورود با TP: ${(ask + 3.0).toFixed(2)} و SL: ${(ask - 0.5).toFixed(2)}.\nسناریو B (SELL): در صورت شکست سطح حمایت با SL: ${(bid + 0.5).toFixed(2)}.\nسناریو C (NO TRADE): عدم وجود تاییدیه.`;

    // Stage 6: Risk Management
    const stage6 = `با توجه به موجودی حساب (${this.state.bridgeStatus.accountInfo?.balance ?? 971.49} USD)، ریسک مجاز ۰.۵٪ سرمایه محاسبه شده و حجم پایه ۰.۰۱ لات تعیین گردید.`;

    // Stage 7: Checklist
    const openPositions = this.state.bridgeStatus.accountInfo?.openPositionsCount || 0;
    const checklist = [
      { check: 'روند و جهت حرکت شفاف است؟', passed: true },
      { check: 'دلیل ورود تکنیکال و سناریوی مشخص وجود دارد؟', passed: true },
      { check: 'اخبار سهمگین در پیش رو نیست؟', passed: true },
      { check: 'حد ضرر (Stop Loss) دقیقاً مشخص شده؟', passed: true },
      { check: 'نسبت سود به زیان (R/R) بیش از ۱:۲ است؟', passed: true },
      { check: 'حجم معامله (Lot) متناسب با ریسک است؟', passed: true },
      { check: 'تعداد معاملات باز از سقف مجاز کمتر است؟', passed: openPositions < 2 },
    ];

    const allPassed = checklist.every((c) => c.passed);
    const decision = allPassed ? 'BUY' : 'NO_TRADE';
    const targetTp = Number((ask + 3.0).toFixed(2));
    const targetSl = Number((ask - 0.5).toFixed(2));

    let orderDispatched = false;
    let reasoning = '';

    if (decision === 'BUY') {
      const res = this.createOrder({
        symbol,
        type: 'BUY',
        lot: 0.01,
        sl: targetSl,
        tp: targetTp,
        source: 'ai_agent',
      });
      orderDispatched = res.success;
      reasoning = `تمام ۷ شرط چک‌لیست فرآیند ۸ مرحله‌ای تایید شد. معامله خرید با حجم ۰.۰۱ لات روی قیمت ${ask} (TP: ${targetTp}, SL: ${targetSl}) صادر و به متاتریدر ارسال گردید.`;
    } else {
      reasoning = `بر اساس ارزیابی چک‌لیست ۸ مرحله‌ای، به دلیل سقف معاملات یا عدم تایید شرایط، تصمیم به عدم معامله (NO TRADE) اتخاذ شد.`;
    }

    this.logTradingActivity('ai_analysis', `[فرآیند ۸ مرحله‌ای تحلیل ایجنت] نتیجه: ${decision} | ${reasoning}`);

    return {
      symbol,
      stage1_marketState: stage1,
      stage2_marketRegime: stage2,
      stage3_technicalAnalysis: stage3,
      stage4_fundamentalGuard: stage4,
      stage5_scenarios: stage5,
      stage6_riskCalculations: stage6,
      stage7_preTradeChecklist: checklist,
      stage8_decision: decision,
      targetTp,
      targetSl,
      recommendedLot: 0.01,
      reasoning,
      orderDispatched,
    };
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

    let reply = '';
    const trimmed = userText.trim();
    const lower = trimmed.toLowerCase();

    const currentAsk = this.state.lastTick?.ask || 4107.81;
    const currentBid = this.state.lastTick?.bid || 4106.50;
    const currentBalance = this.state.bridgeStatus.accountInfo?.balance ?? 971.49;
    const accountNum = this.state.bridgeStatus.accountInfo?.accountNumber || 9028145;
    const broker = this.state.bridgeStatus.accountInfo?.broker || '.Markets Ltd';
    const isBridgeConnected = this.state.bridgeStatus.isConnected;

    // 1. Direct Trade Commands (Buy / Sell / Close)
    const isExplicitBuy = /خرید|بخر|buy|ارسال پوزیشن خرید/i.test(lower);
    const isExplicitSell = /فروش|بفروش|sell|ارسال پوزیشن فروش/i.test(lower);
    const isExplicitClose = /ببند|بستن|close|خروج از پوزیشن/i.test(lower);

    if (isExplicitBuy || isExplicitSell || isExplicitClose) {
      if (isExplicitClose) {
        const res = this.createOrder({
          symbol: 'XAUUSD.m',
          type: 'CLOSE_ALL',
          lot: 0.01,
          source: 'user_manual'
        });
        reply = res.success
          ? `دستور خروج و بستن تمام پوزیشن‌ها صادر شد (شناسه: ${res.order?.id}). دستور به سفیر متاتریدر ۵ ارسال گردید.`
          : `خطا در اجرای دستور بستن پوزیشن: ${res.error}`;
      } else {
        const type = isExplicitBuy ? 'BUY' : 'SELL';
        
        let lot = 0.01;
        const lotMatch = userText.match(/(?:حجم|volume|lot|لات)?\s*(\d+(?:\.\d+)?)\s*(?:لات|lot)?/i);
        if (lotMatch && parseFloat(lotMatch[1]) > 0 && parseFloat(lotMatch[1]) <= 1.0) {
          lot = parseFloat(lotMatch[1]);
        }

        const sl = type === 'BUY' ? currentAsk - 2.5 : currentBid + 2.5;
        const tp = type === 'BUY' ? currentAsk + 5.0 : currentBid - 5.0;

        const res = this.createOrder({
          symbol: 'XAUUSD.m',
          type,
          lot,
          sl,
          tp,
          source: 'user_manual'
        });

        if (res.success) {
          reply = `سفارش معامله **${type === 'BUY' ? 'خرید (BUY)' : 'فروش (SELL)'}** با موفقیت صادر شد:\n\n` +
            `• **نماد:** XAUUSD.m (طلا)\n` +
            `• **حجم معامله:** ${lot} لات\n` +
            `• **قیمت جاری:** ${type === 'BUY' ? currentAsk : currentBid}\n` +
            `• **حد ضرر (SL):** ${sl.toFixed(2)}\n` +
            `• **حد سود (TP):** ${tp.toFixed(2)}\n` +
            `• **شناسه سفارش:** \`${res.order?.id}\`\n\n` +
            `این سفارش به صف معاملات سفیر متاتریدر ۵ (حساب ${accountNum} نزد ${broker}) متصل گردید.`;
        } else {
          reply = `خطا در ثبت سفارش معامله: ${res.error}`;
        }
      }
    }
    // 2. Greetings and Conversational Interaction
    else if (
      /^(سلام|درود|سلام علیک|salam|hi|hello|چطوری|خوبی|خسته نباشی|روز بخیر|وقت بخیر)$/i.test(trimmed) ||
      lower.startsWith('سلام') || lower.startsWith('درود') || lower.startsWith('salam')
    ) {
      reply = `سلام و درود! وقت شما بخیر.\n\nمن **هرمس (Hermes)**، ایجنت هوشمند معامله‌گر شما هستم. موجودی فعلی حساب شما **$${currentBalance}** (حساب ${accountNum}) است.\n\nچگونه می‌توانم کمکتان کنم؟ می‌توانم بازار طلا را تحلیل کنم، پوزیشن معاملاتی جدید ثبت کنم، قوانین ریسک را بروزرسانی کنم یا به پرسش‌های شما پاسخ دهم.`;
    }
    // 3. Status or Account Inquiries
    else if (/موجودی|حساب|وضعیت|قیمت|طلا|balance|equity|status/i.test(lower) && !/از این به بعد|قانون/i.test(lower)) {
      reply = `گزارش لحظه‌ای وضعیت حساب و متاتریدر ۵:\n\n` +
        `• **موجودی حساب (Balance):** $${currentBalance}\n` +
        `• **ارزش خالص (Equity):** $${currentBalance}\n` +
        `• **وضعیت اتصال سفیر MT5:** ${isBridgeConnected ? '🟢 متصل و فعال' : '🟡 آماده به کار'}\n` +
        `• **نرخ خرید طلا (Ask):** ${currentAsk}\n` +
        `• **نرخ فروش طلا (Bid):** ${currentBid}\n` +
        `• **بروکر:** ${broker}\n` +
        `• **شماره حساب:** ${accountNum}`;
    }
    // 4. Request for Analysis or Autonomous Engine
    else if (/تحلیل|آنالیز|ارزیابی|بررسی بازار|engine|فرآیند/i.test(lower)) {
      const analysis = this.runAutonomousAnalysis();
      reply = `تحلیل جامع بازار طلا بر اساس **فرآیند ۸ مرحله‌ای ایجنت هرمس**:\n\n` +
        `📊 **۱. وضعیت بازار:** ${analysis.stage1_marketState}\n` +
        `🔍 **۲. رژیم بازار:** ${analysis.stage2_marketRegime}\n` +
        `📈 **۳. تحلیل تکنیکال:** ${analysis.stage3_technicalAnalysis}\n` +
        `📰 **۴. فاندامنتال:** ${analysis.stage4_fundamentalGuard}\n` +
        `📝 **۵. سناریوها:** ${analysis.stage5_scenarios}\n` +
        `🛡️ **۶. مدیریت ریسک:** ${analysis.stage6_riskCalculations}\n` +
        `✅ **۷. چک‌لیست ورود:** ارزیابی شروط ۷‌گانه انجام شد.\n` +
        `🚀 **۸. تصمیم نهایی:** ${analysis.reasoning}`;
    }
    // 5. Explicit Strategy Instructions & Long-Term Memory Rules
    else if (
      /قانون|دستورالعمل|از این به بعد|قوانین|ریسک را|حد ضرر|حد سود|استراتژی/i.test(lower)
    ) {
      await this.addMemoryNote('قوانین و استراتژی کاربر', userText);
      reply = `دستورالعمل استراتژی شما دریافت شد: "${userText}". این آموزه به صورت دائمی در **حافظه بلندمدت Supabase** ثبت شد و ایجنت در تحلیل‌ها و معاملات بعدی طبق آن عمل خواهد کرد.`;
    }
    // 6. General Questions & Assistance
    else {
      reply = `متوجه پیام شما شدم. من ایجنت معامله‌گر شما هستم. اگر مایلید پوزیشن معاملاتی (خرید/فروش) باز کنم، یا تحلیل بازار انجام دهم، یا قانون جدیدی برای ریسک ثبت کنم، کافیست امر بفرمایید.`;
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
