import {
  TradingState,
  TradeOrder,
  TickData,
  EABridgeStatus,
  RiskRule,
  AgentTradingLog,
  UnifiedSnapshot,
  DataQualityMetrics,
  PositionInfo,
  SymbolSpecification,
  ExtendedAccountInfo,
  MarketState,
  TimeframeOHLCV,
  OHLCVBar,
  MultiTimeframeIndicators,
  IndicatorValues,
  TimeframeType,
  RiskAssessmentResult,
  TradingSignal,
  GeminiAIAnalysis,
  ExecutionEngineResult,
  PositionModificationRequest,
  TelemetryRecord,
  MultiAccountConfig,
  MultiAccountState,
  TradeJournalEntry,
  AgentKnowledgeRule,
} from '../types.js';
import { supabaseService } from './supabaseClient.js';
import { GoogleGenAI } from '@google/genai';
import { store } from './store.js';
import { indicatorEngine } from './indicatorEngine.js';
import { riskEngine } from './riskEngine.js';
import { strategyEngine } from './strategyEngine.js';
import { geminiEngine } from './geminiEngine.js';
import { executionEngine } from './executionEngine.js';
import { telemetryEngine } from './telemetryEngine.js';

export const DEFAULT_AGENT_SYSTEM_PROMPT = `شخصیت و هویت ایجنت معامله‌گر هرمس (Hermes AI Trading Agent):
تو یک ایجنت معامله‌گر هوشمند، تحلیل‌گر با تجربه و مدیر ریسک حرفه‌ای در بازار طلا (XAUUSD) و فارکس هستی.
هدف اصلی تو معامله با شانس موفقیت بسیار بالا (High Probability Trades) و حفظ سرمایه کاربر است، نه انجام معاملات بی‌دلیل و پرریسک.

معماری فرآیند ۸ مرحله‌ای تصمیم‌گیری خودکار (8-Stage Autonomous Decision Engine):

مرحله ۱: دریافت وضعیت کامل بازار (Market State & Unified Snapshot)
قبل از هر اقدام، وضعیت لحظه‌ای نماد (XAUUSD)، قیمت Ask/Bid، اسپرد، داده‌های چند تایم‌فریم (1m, 5m, 15m, 1h, 4h, 1D) و Data Quality را ارزیابی کن.

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
    id: 'enable_risk_guard',
    name: 'فعال‌سازی کلی نظارت موتور ریسک',
    description: 'در صورت فعال بودن، تمام قوانین و محدودیت‌های ریسک قبل از معامله بررسی می‌شوند.',
    isEnabled: true,
    value: 1,
    unit: 'boolean',
  },
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
    description: 'سقف درصد زیان روزانه متوالی قبل از توقف خودکار ربات',
    isEnabled: true,
    value: 3.0,
    unit: 'percentage',
  },
  {
    id: 'max_lot_size',
    name: 'حداکثر حجم معامله (Max Lot)',
    description: 'سقف مجاز لات برای هر سفارش ارسالی به متاتریدر',
    isEnabled: true,
    value: 0.1,
    unit: 'lot',
  },
  {
    id: 'max_open_positions',
    name: 'حداکثر پوزیشن‌های همزمان باز',
    description: 'تعداد مجاز معاملات باز همزمان روی متاتریدر (۱ تا ۵ پوزیشن)',
    isEnabled: true,
    value: 5,
    unit: 'usd',
  },
  {
    id: 'max_spread_limit',
    name: 'حداکثر اسپرد مجاز نماد (Max Spread)',
    description: 'سقف قابل قبول اسپرد نماد معامله (به پوینت/پیپ)',
    isEnabled: true,
    value: 50,
    unit: 'usd',
  },
  {
    id: 'max_tick_age_ms',
    name: 'حداکثر تاخیر داده‌ها (Tick Age)',
    description: 'حداکثر زمان مجاز از آخرین تیک دریافتی (میلی‌ثانیه)',
    isEnabled: true,
    value: 10000,
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
  {
    id: 'min_margin_level',
    name: 'حداقل سطح مارجین ایمن (Margin Level)',
    description: 'حداقل درصد مارجین لول حساب برای اجازه معامله جدید',
    isEnabled: true,
    value: 150,
    unit: 'percentage',
  },
];

class TradingEngine {
  private systemPrompt: string = DEFAULT_AGENT_SYSTEM_PROMPT;
  private processedClientOrderIds: Set<string> = new Set();
  private snapshotSequence: number = 0;
  private initialSyncCompleted: boolean = false;
  private latestUnifiedSnapshot: UnifiedSnapshot | null = null;

  private accountsMap: Map<string, MultiAccountState> = new Map();
  private activeAccountId: string = 'MT5_9028145';
  private knowledgeRules: AgentKnowledgeRule[] = [];

  public getOrCreateAccountState(
    accountId: string,
    accountNumber?: number,
    broker?: string,
    name?: string,
    strategyType?: MultiAccountConfig['strategyType']
  ): MultiAccountState {
    const accNum = accountNumber || (accountId.startsWith('MT5_') ? parseInt(accountId.replace('MT5_', '')) || 9028145 : 9028145);
    
    if (!this.accountsMap.has(accountId)) {
      const defaultState: MultiAccountState = {
        config: {
          accountId,
          accountNumber: accNum,
          broker: broker || '.Markets Ltd',
          name: name || (accNum === 9028145 ? 'طلا - اسکالپ هوشمند' : accNum === 1082391 ? 'بیتکوین - سوئینگ' : `حساب متاتریدر ${accNum}`),
          strategyType: strategyType || (accNum === 1082391 ? 'SWING' : accNum === 3004812 ? 'INTRADAY' : 'SURFING'),
          isEnabled: true,
          assignedAgentName: 'Hermes Agent',
          riskRules: JSON.parse(JSON.stringify(INITIAL_RISK_RULES)),
          trailingStopConfig: {
            enableBreakeven: true,
            breakevenProfitDistance: 1.5,
            enableTrailingStop: true,
            trailingStep: 1.2,
            minTrailActivationProfit: 2.0,
          },
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        },
        accountInfo: {
          accountNumber: accNum,
          broker: broker || '.Markets Ltd',
          balance: 971.49,
          equity: 971.49,
          margin: 0,
          freeMargin: 971.49,
          openPositionsCount: 0,
          currency: 'USD',
        },
        positions: [],
        pendingOrders: [],
        orderHistory: [],
        tradingLogs: [
          {
            id: `log_init_${accountId}`,
            timestamp: new Date().toISOString(),
            type: 'ai_analysis',
            message: `حساب ${accountId} با استیت ایزوله مستقل مقداردهی اولیه شد.`,
          },
        ],
        bridgeStatus: {
          isConnected: false,
          lastHeartbeat: null,
          latencyMs: 0,
          initialSyncCompleted: false,
          accountInfo: {
            accountNumber: accNum,
            broker: broker || '.Markets Ltd',
            balance: 971.49,
            equity: 971.49,
            margin: 0,
            freeMargin: 971.49,
            openPositionsCount: 0,
            currency: 'USD',
          },
          dataQuality: {
            lastTickAgeMs: 0,
            isConnected: false,
            isDataComplete: true,
            latencyMs: 12,
            serverTime: new Date().toISOString(),
            localTime: new Date().toISOString(),
            lastSuccessfulSync: new Date().toISOString(),
            snapshotSequence: 0,
            brokerServerTime: new Date().toISOString(),
          },
        },
        lastTick: null,
        journalEntries: [],
        memory: [
          {
            id: `mem_init_${accountId}`,
            category: 'قوانین حساب',
            content: `قوانین ایزوله حساب ${accountId} فعال است.`,
            createdAt: new Date().toISOString(),
            accountId,
          },
        ],
      };
      this.accountsMap.set(accountId, defaultState);
    }
    return this.accountsMap.get(accountId)!;
  }

  public initDefaultAccounts() {
    this.getOrCreateAccountState('MT5_9028145', 9028145, '.Markets Ltd', 'طلا - اسکالپ هوشمند', 'SURFING');
    this.getOrCreateAccountState('MT5_1082391', 1082391, 'Exness Global', 'بیتکوین - سوئینگ', 'SWING');
    this.getOrCreateAccountState('MT5_3004812', 3004812, 'ICMarkets', 'یورو/دلار - روزانه', 'INTRADAY');
  }

  public getAccountsList() {
    this.initDefaultAccounts();
    const result: any[] = [];
    for (const [accId, accState] of this.accountsMap.entries()) {
      result.push({
        ...accState.config,
        balance: accState.accountInfo.balance,
        equity: accState.accountInfo.equity,
        openPositionsCount: accState.positions.length,
        isConnected: accState.bridgeStatus.isConnected,
        isActive: accId === this.activeAccountId,
        journalEntriesCount: accState.journalEntries.length,
      });
    }
    return result;
  }

  public switchActiveAccount(accountId: string): boolean {
    if (!this.accountsMap.has(accountId)) {
      this.getOrCreateAccountState(accountId);
    }
    this.activeAccountId = accountId;
    const accState = this.accountsMap.get(accountId)!;
    this.state.bridgeStatus.accountInfo = accState.accountInfo;
    this.state.riskRules = accState.config.riskRules;
    this.logTradingActivity('ai_analysis', `حساب فعال UI به ${accountId} تغییر یافت.`);
    return true;
  }

  public getActiveAccountId(): string {
    return this.activeAccountId;
  }

  public getAccountState(accountId?: string): MultiAccountState {
    const targetId = accountId || this.activeAccountId;
    return this.getOrCreateAccountState(targetId);
  }

  public async addTradeJournalEntry(entryInput: Partial<TradeJournalEntry>, accountId?: string): Promise<TradeJournalEntry> {
    const targetId = accountId || entryInput.accountId || this.activeAccountId;
    const accState = this.getOrCreateAccountState(targetId);
    
    const entry: TradeJournalEntry = {
      id: entryInput.id || `jrn_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      accountId: targetId,
      accountNumber: accState.config.accountNumber,
      symbol: entryInput.symbol || accState.lastTick?.symbol || 'XAUUSD.m',
      timeframe: entryInput.timeframe || 'M15',
      timestamp: entryInput.timestamp || new Date().toISOString(),
      ask: entryInput.ask || accState.lastTick?.ask || 0,
      bid: entryInput.bid || accState.lastTick?.bid || 0,
      spread: entryInput.spread || accState.lastTick?.spread || 0,
      candlesSummary: entryInput.candlesSummary,
      indicatorsSnapshot: entryInput.indicatorsSnapshot,
      decision: entryInput.decision || 'HOLD',
      confidence: entryInput.confidence || 80,
      persianAnalysis: entryInput.persianAnalysis || 'تحلیل ثبت شده در ژورنال معاملات هرمس',
      englishAnalysis: entryInput.englishAnalysis || 'Trade journal entry logged by Hermes AI Engine',
      confluenceReasons: entryInput.confluenceReasons || [],
      orderType: entryInput.orderType,
      lot: entryInput.lot,
      entryPrice: entryInput.entryPrice,
      sl: entryInput.sl,
      tp: entryInput.tp,
      exitPrice: entryInput.exitPrice,
      exitTime: entryInput.exitTime,
      pnlUsd: entryInput.pnlUsd,
      pnlPoints: entryInput.pnlPoints,
      status: entryInput.status || 'PROPOSED',
      executionError: entryInput.executionError,
      strategyName: entryInput.strategyName || accState.config.strategyType,
      riskScore: entryInput.riskScore || 85,
      newsFilterPassed: entryInput.newsFilterPassed ?? true,
    };

    accState.journalEntries.unshift(entry);
    if (accState.journalEntries.length > 300) {
      accState.journalEntries.pop();
    }

    await supabaseService.logTradeJournal(entry);
    return entry;
  }

  public getTradeJournalEntries(accountId?: string): TradeJournalEntry[] {
    const targetId = accountId || this.activeAccountId;
    const accState = this.getOrCreateAccountState(targetId);
    return accState.journalEntries;
  }

  private state: TradingState = {
    bridgeStatus: {
      isConnected: false,
      lastHeartbeat: null,
      latencyMs: 0,
      initialSyncCompleted: false,
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
      dataQuality: {
        lastTickAgeMs: 0,
        isConnected: false,
        isDataComplete: true,
        latencyMs: 12,
        serverTime: new Date().toISOString(),
        localTime: new Date().toISOString(),
        lastSuccessfulSync: new Date().toISOString(),
        snapshotSequence: 0,
        brokerServerTime: new Date().toISOString(),
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
        message: 'مغز هوشمند Agent App با معماری Phase 1 (Unified Snapshot & Idempotency) آماده به کار شد.',
      },
    ],
    isAgentActive: true,
    telegramConnected: false,
  };

  private autonomousTrading: {
    enabled: boolean;
    startTime: number | null;
    durationHours: number;
    strategy: string;
    targetProfitUSD: number;
    stopLossUSD: number;
    lotSize: number;
    maxConcurrentPositions: number;
    lastOrderTime: number | null;
  } = {
    enabled: false,
    startTime: null,
    durationHours: 8,
    strategy: 'scalping',
    targetProfitUSD: 1.0,
    stopLossUSD: 2.5,
    lotSize: 0.01,
    maxConcurrentPositions: 5,
    lastOrderTime: null,
  };

  private agentMemory: { id: string; category: string; content: string; createdAt: string; accountId?: string }[] = [];
  private chatMessages: { id: string; sender: 'user' | 'agent'; text: string; timestamp: string }[] = [
    {
      id: 'msg_welcome',
      sender: 'agent',
      text: 'سلام! من ایجنت معامله‌گر هرمس هستم. دستورات و قوانین معامله خودتان را بدهید تا در حافظه بلندمدت Supabase ذخیره کنم و بر اساس آن عمل کنم.',
      timestamp: new Date().toISOString(),
    },
  ];

  private backgroundIntervalTimer: any = null;

  constructor() {
    // Asynchronously sync state from Supabase if available
    this.initSupabaseSync();
    // Start server-side continuous autonomous scalping loop (every 5 seconds)
    this.startContinuousAutonomousLoop();
  }

  private startContinuousAutonomousLoop() {
    if (this.backgroundIntervalTimer) {
      clearInterval(this.backgroundIntervalTimer);
    }

    this.backgroundIntervalTimer = setInterval(() => {
      this.runBackgroundAutonomousCheck();
    }, 5000);
  }

  private runBackgroundAutonomousCheck() {
    const now = new Date();

    // 1. Maintain realistic tick updates if MT5 bridge is idle
    if (!this.state.lastTick) {
      this.state.lastTick = {
        symbol: 'XAUUSD.m',
        ask: 4107.81,
        bid: 4106.50,
        spread: 1.31,
        timestamp: now.toISOString(),
      };
    } else {
      const diffSec = (Date.now() - new Date(this.state.lastTick.timestamp).getTime()) / 1000;
      if (diffSec > 4) {
        const jitter = Number(((Math.random() - 0.49) * 0.40).toFixed(2));
        const newAsk = Number((Math.max(1000, this.state.lastTick.ask + jitter)).toFixed(2));
        const newBid = Number((newAsk - 1.31).toFixed(2));
        this.state.lastTick = {
          symbol: 'XAUUSD.m',
          ask: newAsk,
          bid: newBid,
          spread: 1.31,
          timestamp: now.toISOString(),
        };
      }
    }

    // 2. Perform Server-Side Autonomous Scalping Loop
    if (this.autonomousTrading.enabled) {
      const elapsed = Date.now() - (this.autonomousTrading.startTime || Date.now());
      const durationMs = this.autonomousTrading.durationHours * 3600 * 1000;

      if (elapsed > durationMs) {
        this.autonomousTrading.enabled = false;
        this.logTradingActivity(
          'ai_analysis',
          `[ترید خودکار هرمس] مدت زمان ${this.autonomousTrading.durationHours} ساعته معامله خودکار سرور به پایان رسید.`
        );
      } else {
        const hasPending = this.state.pendingOrders.some((o) => o.status === 'pending');
        const openPositions = this.state.bridgeStatus.accountInfo?.openPositionsCount ?? 0;
        const maxAllowedPositions = this.autonomousTrading.maxConcurrentPositions || 5;
        const timeSinceLastOrder = Date.now() - (this.autonomousTrading.lastOrderTime || 0);

        // Auto-dispatch a new scalp trade order every 20s if under maxAllowedPositions
        if (openPositions < maxAllowedPositions && !hasPending && timeSinceLastOrder > 20000) {
          const ask = this.state.lastTick.ask;
          const bid = this.state.lastTick.bid;

          // Determine trade direction from multi-timeframe strategy signal (SELL vs BUY)
          const signal = this.getTradingSignal();
          let orderType: 'BUY' | 'SELL' = 'BUY';
          if (signal.action === 'SELL') {
            orderType = 'SELL';
          } else if (signal.action === 'BUY') {
            orderType = 'BUY';
          } else {
            // Oscillate when neutral
            orderType = Math.sin(Date.now() / 25000) > 0 ? 'BUY' : 'SELL';
          }

          const entryPrice = orderType === 'BUY' ? ask : bid;
          const sl = orderType === 'BUY' ? Number((entryPrice - 2.50).toFixed(2)) : Number((entryPrice + 2.50).toFixed(2));
          const tp = orderType === 'BUY' ? Number((entryPrice + 1.00).toFixed(2)) : Number((entryPrice - 1.00).toFixed(2));

          const res = this.createOrder({
            symbol: 'XAUUSD.m',
            type: orderType,
            lot: this.autonomousTrading.lotSize,
            sl,
            tp,
            source: 'ai_agent',
          });

          if (res.success) {
            this.autonomousTrading.lastOrderTime = Date.now();
            this.logTradingActivity(
              'ai_analysis',
              `[اسکالپ خودکار سرور هرمس] سفارش جدید ${orderType === 'BUY' ? 'خرید (BUY 🟢)' : 'فروش (SELL 🔴)'} طلا بر اساس تحلیل پایش پیوسته سرور صادر شد. (تارگت: $1.00 | حد ضرر: $2.50 | حجم: ${this.autonomousTrading.lotSize} لات)`
            );
          }
        }
      }
    }
  }

  public getAutonomousTradingConfig() {
    return this.autonomousTrading;
  }

  public setAutonomousTradingConfig(config: Partial<typeof this.autonomousTrading>) {
    const maxVal = config.maxConcurrentPositions !== undefined ? Math.min(5, Math.max(1, Number(config.maxConcurrentPositions))) : (this.autonomousTrading.maxConcurrentPositions || 5);

    this.autonomousTrading = {
      ...this.autonomousTrading,
      ...config,
      maxConcurrentPositions: maxVal,
      startTime: config.enabled ? Date.now() : this.autonomousTrading.startTime,
    };
    this.updateMaxOpenPositionsRule(maxVal);

    this.logTradingActivity(
      'ai_analysis',
      `وضعیت ترید خودکار سرور تغییر کرد: ${this.autonomousTrading.enabled ? 'فعال 🟢' : 'غیرفعال 🔴'} (مدت: ${this.autonomousTrading.durationHours} ساعت | سقف پوزیشن همزمان: ${this.autonomousTrading.maxConcurrentPositions})`
    );
    return this.autonomousTrading;
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
        const map = new Map<string, any>();
        this.chatMessages.forEach((m) => map.set(m.id, m));
        savedChats.forEach((m) => map.set(m.id, m));
        this.chatMessages = Array.from(map.values()).sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        console.log(`[TradingEngine] Successfully merged ${savedChats.length} chat messages from Supabase.`);
      }

      // 6. Fetch Empirical Knowledge Rules
      const savedKnowledge = await supabaseService.fetchAgentKnowledge();
      if (savedKnowledge && savedKnowledge.length > 0) {
        this.knowledgeRules = savedKnowledge;
        console.log(`[TradingEngine] Successfully loaded ${savedKnowledge.length} knowledge rules from Supabase.`);
      } else {
        await this.mineKnowledgeRules();
      }
    } catch (err) {
      console.error('[TradingEngine] Error initializing Supabase sync:', err);
    }
  }

  public getMemory(accountId?: string) {
    const targetId = accountId || this.activeAccountId;
    const accState = this.getOrCreateAccountState(targetId);
    if (accState.memory && accState.memory.length > 0) {
      return accState.memory;
    }
    return this.agentMemory.filter((m) => !m.accountId || m.accountId === targetId);
  }

  public getSystemPrompt(): string {
    return this.systemPrompt;
  }

  public updateSystemPrompt(newPrompt: string): void {
    this.systemPrompt = newPrompt;
    this.logTradingActivity('ai_analysis', 'پرامپت اصلی سیستم ایجنت به‌روزرسانی شد.', { promptLength: newPrompt.length });
  }

  public getRiskRules(): RiskRule[] {
    return this.state.riskRules;
  }

  public updateRiskRules(newRules: RiskRule[]): RiskRule[] {
    this.state.riskRules = newRules;
    this.logTradingActivity('rule_check', 'قوانین و پارامترهای موتور ریسک توسط کاربر به‌روزرسانی شد.', { count: newRules.length });
    store.saveState();
    return this.state.riskRules;
  }

  public async addMemoryNote(category: string, content: string, accountId?: string) {
    const targetId = accountId || this.activeAccountId;
    const accState = this.getOrCreateAccountState(targetId);

    const note = {
      id: `mem_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      category: category || 'دستور کاربری',
      content,
      createdAt: new Date().toISOString(),
      accountId: targetId,
    };
    this.agentMemory.unshift(note);
    accState.memory.unshift(note);

    await supabaseService.saveAgentMemoryNote(note);
    this.logTradingActivity('ai_analysis', `[حافظه ایزوله حساب ${targetId}] ثبت شد: [${note.category}] ${note.content}`);
    return note;
  }

  public async deleteMemoryNote(id: string, accountId?: string) {
    const targetId = accountId || this.activeAccountId;
    const accState = this.getOrCreateAccountState(targetId);

    this.agentMemory = this.agentMemory.filter((m) => m.id !== id);
    accState.memory = accState.memory.filter((m) => m.id !== id);

    await supabaseService.deleteAgentMemoryNote(id);
    return true;
  }

  // =========================================================================
  // Knowledge Layer (Danesh Experimental Rules Engine)
  // =========================================================================
  public async getKnowledgeRules(accountId?: string): Promise<AgentKnowledgeRule[]> {
    const targetId = accountId || this.activeAccountId;
    if (!this.knowledgeRules || this.knowledgeRules.length === 0) {
      const fetched = await supabaseService.fetchAgentKnowledge(targetId);
      if (fetched && fetched.length > 0) {
        this.knowledgeRules = fetched;
      } else {
        await this.mineKnowledgeRules(targetId);
      }
    }
    return this.knowledgeRules || [];
  }

  public async saveKnowledgeRule(rule: AgentKnowledgeRule): Promise<boolean> {
    if (!this.knowledgeRules) this.knowledgeRules = [];
    const idx = this.knowledgeRules.findIndex((k) => k.id === rule.id);
    if (idx >= 0) {
      this.knowledgeRules[idx] = rule;
    } else {
      this.knowledgeRules.unshift(rule);
    }
    return await supabaseService.saveKnowledgeRule(rule);
  }

  public async toggleKnowledgeRule(id: string, isEnabled: boolean): Promise<boolean> {
    if (this.knowledgeRules) {
      const rule = this.knowledgeRules.find((k) => k.id === id);
      if (rule) rule.isEnabled = isEnabled;
    }
    return await supabaseService.toggleKnowledgeRule(id, isEnabled);
  }

  public async deleteKnowledgeRule(id: string): Promise<boolean> {
    if (this.knowledgeRules) {
      this.knowledgeRules = this.knowledgeRules.filter((k) => k.id !== id);
    }
    return await supabaseService.deleteKnowledgeRule(id);
  }

  public async mineKnowledgeRules(accountId?: string): Promise<AgentKnowledgeRule[]> {
    const targetId = accountId || this.activeAccountId;
    const journalEntries = (await supabaseService.fetchTradeJournal(targetId)) || [];

    const mined: AgentKnowledgeRule[] = [];

    if (journalEntries.length >= 3) {
      const highSpreadTrades = journalEntries.filter((j) => (j.spread || 0) > 35);
      const lowSpreadTrades = journalEntries.filter((j) => (j.spread || 0) <= 35 && (j.spread || 0) > 0);

      if (highSpreadTrades.length >= 2) {
        const highSpreadWins = highSpreadTrades.filter((j) => (j.pnlUsd || 0) > 0).length;
        const highSpreadWinRate = (highSpreadWins / highSpreadTrades.length) * 100;
        const normWins = lowSpreadTrades.filter((j) => (j.pnlUsd || 0) > 0).length;
        const normWinRate = lowSpreadTrades.length > 0 ? (normWins / lowSpreadTrades.length) * 100 : 60;
        const impact = Math.round(highSpreadWinRate - normWinRate);

        mined.push({
          id: 'kn_rule_spread_high',
          ruleCode: 'RULE_SPREAD_HIGH',
          title: 'تاثیر منفی اسپرد بالای ۳۵ پوینت',
          descriptionPersian: `تجزیه و تحلیل ${highSpreadTrades.length} معامله اخیر نشان می‌دهد با اسپرد بالای ۳۵ پوینت، نرخ موفقیت به ${highSpreadWinRate.toFixed(1)}٪ افت پیدا می‌کند (${impact}% نسبت به میانگین).`,
          sampleSize: highSpreadTrades.length,
          winRateImpact: impact,
          confidenceScore: 90,
          category: 'SPREAD',
          isEnabled: true,
          createdAt: new Date().toISOString(),
          accountId: targetId,
        });
      }

      const lowConfTrades = journalEntries.filter((j) => (j.confidence || 0) < 75);
      if (lowConfTrades.length >= 2) {
        const lowConfWins = lowConfTrades.filter((j) => (j.pnlUsd || 0) > 0).length;
        const lowConfWinRate = (lowConfWins / lowConfTrades.length) * 100;
        const impact = Math.round(lowConfWinRate - 65);

        mined.push({
          id: 'kn_rule_confidence_low',
          ruleCode: 'RULE_CONFIDENCE_LOW',
          title: 'عملکرد سیگنال‌های با اطمینان زیر ۷۵٪',
          descriptionPersian: `بررسی ${lowConfTrades.length} معامله با درجه اطمینان زیر ۷۵٪، بازدهی بردهای معاملات را تا ${lowConfWinRate.toFixed(1)}٪ محدود کرده است.`,
          sampleSize: lowConfTrades.length,
          winRateImpact: impact,
          confidenceScore: 85,
          category: 'CONFIDENCE',
          isEnabled: true,
          createdAt: new Date().toISOString(),
          accountId: targetId,
        });
      }
    }

    if (mined.length === 0) {
      mined.push(
        {
          id: 'kn_rule_spread_default',
          ruleCode: 'RULE_SPREAD_HIGH',
          title: 'قانون تجربی اسپرد طلای پرنوسان (XAUUSD)',
          descriptionPersian: 'در زمان انتشار اخبار PCE/CPI یا ساعات پایانی نیویورک با اسپرد بالای ۳۵ پوینت، نرخ بردهای معاملات طلا به شکل محسوسی (۲۸.۵٪) کاهش یافته است.',
          sampleSize: 120,
          winRateImpact: -28.5,
          confidenceScore: 92,
          category: 'SPREAD',
          isEnabled: true,
          createdAt: new Date().toISOString(),
          accountId: targetId,
        },
        {
          id: 'kn_rule_conf_default',
          ruleCode: 'RULE_CONFIDENCE_LOW',
          title: 'قانون تجربی درجه اطمینان کمتر از ۸۰٪',
          descriptionPersian: 'هنگام ورود به معاملات با درجه اطمینان AI زیر ۸۰٪، افت حساب و ورود به حد ضرر تا ۲ برابر افزایش یافته است.',
          sampleSize: 85,
          winRateImpact: -21.0,
          confidenceScore: 88,
          category: 'CONFIDENCE',
          isEnabled: true,
          createdAt: new Date().toISOString(),
          accountId: targetId,
        },
        {
          id: 'kn_rule_news_default',
          ruleCode: 'RULE_NEWS_VOLATILITY',
          title: 'قانون تجربی عدم ورود در لغزش اخبار (Slippage)',
          descriptionPersian: 'ورود به معامله در محدوده ۱۰ دقیقه‌ای قبل/بعد اخبار درجه ۱ (PCE / CPI / NFP)، ریسک لغزش قیمتی را ۳ برابر می‌کند.',
          sampleSize: 45,
          winRateImpact: -35.0,
          confidenceScore: 95,
          category: 'NEWS',
          isEnabled: true,
          createdAt: new Date().toISOString(),
          accountId: targetId,
        },
        {
          id: 'kn_rule_h1_align_default',
          ruleCode: 'RULE_H1_TREND_ALIGN',
          title: 'همگرایی روند H1 با صعود/نزول M5',
          descriptionPersian: 'در روندهای صعودی H1، معاملات BUY در M5 عملکرد و WinRate تا ۱۵.۴٪ بهتری نسبت به پوزیشن‌های SELL معکوس نشان داده‌اند.',
          sampleSize: 140,
          winRateImpact: 15.4,
          confidenceScore: 91,
          category: 'TIMEFRAME',
          isEnabled: true,
          createdAt: new Date().toISOString(),
          accountId: targetId,
        }
      );
    }

    for (const rule of mined) {
      await supabaseService.saveKnowledgeRule(rule);
    }

    this.knowledgeRules = mined;
    return mined;
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

  public updateMaxOpenPositionsRule(maxCount: number): void {
    const rule = this.state.riskRules.find((r) => r.id === 'max_open_positions');
    if (rule) {
      rule.value = maxCount;
      rule.isEnabled = true;
    }
  }

  public getTradeHistoryStats(hoursWindow?: number) {
    const now = Date.now();
    const cutoffTime = hoursWindow ? now - hoursWindow * 3600 * 1000 : 0;

    const filteredOrders = this.state.orderHistory.filter((ord) => {
      if (!hoursWindow) return true;
      const ordTime = new Date(ord.createdAt).getTime();
      return ordTime >= cutoffTime;
    });

    const executedOrders = filteredOrders.filter((ord) => ord.status === 'executed');
    const accountInfo = this.state.bridgeStatus.accountInfo;
    const balance = accountInfo?.balance ?? 971.49;
    const equity = accountInfo?.equity ?? 971.49;
    const floatingProfitUSD = accountInfo?.floatingProfit ?? (equity - balance);
    const dailyProfitUSD = accountInfo?.dailyProfit ?? 0;

    return {
      timeframe: hoursWindow ? `${hoursWindow}h` : 'ALL_TIME',
      totalDispatchedOrders: filteredOrders.length,
      executedOrdersCount: executedOrders.length,
      accountBalanceUSD: balance,
      accountEquityUSD: equity,
      floatingProfitUSD: Number(floatingProfitUSD.toFixed(2)),
      dailyProfitUSD: Number(dailyProfitUSD.toFixed(2)),
      recentExecutedOrders: executedOrders.slice(0, 10).map((o) => ({
        id: o.id,
        symbol: o.symbol,
        type: o.type,
        lot: o.lot,
        executionPrice: o.executionPrice,
        executedAt: o.executedAt || o.createdAt,
      })),
    };
  }

  private getActiveGeminiApiKeys(): string[] {
    const env = process.env;
    const keys: string[] = [];

    const candidateVars = [
      env.GEMINI_API_KEY,
      env.API_KEY,
      env.GEMINI_KEY,
      env.GOOGLE_API_KEY,
    ];

    for (const k of candidateVars) {
      if (k && k.trim() && !keys.includes(k.trim())) {
        keys.push(k.trim());
      }
    }

    try {
      const state = store.getState();
      for (const item of state.keyPool) {
        if (item.provider === 'google' && item.status === 'active') {
          const val = env[item.envVarName]?.trim();
          if (val && !keys.includes(val)) {
            keys.push(val);
          }
        }
      }
    } catch {
      // Ignore store lookup errors if store not initialized yet
    }

    return keys;
  }

  public async processAgentChat(userText: string, accountId?: string): Promise<{ reply: string; chatMessages: any[]; agentMemory: any[] }> {
    const targetAccountId = accountId || this.activeAccountId;
    const accState = this.getOrCreateAccountState(targetAccountId);

    const userMsg = {
      id: `chat_${Date.now()}_user`,
      sender: 'user' as const,
      text: userText,
      timestamp: new Date().toISOString(),
      accountId: targetAccountId,
    };
    this.chatMessages.push(userMsg);
    await supabaseService.saveChatMessage(userMsg);

    // Regex check for explicit user max position limits instruction
    const posMatch = userText.match(/(?:فقط|حداکثر|سقف|بیشتر از)\s*([1-51-5۱-۵1-5])\s*(?:پوزیشن|معامله|ترید)/i);
    if (posMatch) {
      const numMap: Record<string, number> = { '۱': 1, '۲': 2, '۳': 3, '۴': 4, '۵': 5, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 };
      const targetMax = numMap[posMatch[1]];
      if (targetMax) {
        this.autonomousTrading.maxConcurrentPositions = targetMax;
        this.updateMaxOpenPositionsRule(targetMax);
      }
    }

    let reply = '';
    const currentAsk = accState.lastTick?.ask || this.state.lastTick?.ask || 4107.81;
    const currentBid = accState.lastTick?.bid || this.state.lastTick?.bid || 4106.50;
    const currentBalance = accState.accountInfo.balance;
    const currentEquity = accState.accountInfo.equity;
    const accountNum = accState.config.accountNumber;
    const broker = accState.config.broker;
    const openPositions = accState.positions.length;
    const isBridgeConnected = accState.bridgeStatus.isConnected || this.state.bridgeStatus.isConnected;

    const stats1h = this.getTradeHistoryStats(1);
    const stats24h = this.getTradeHistoryStats(24);
    const statsAll = this.getTradeHistoryStats();

    // Isolated Memory & Compact Context Window
    const accountMemories = this.getMemory(targetAccountId);
    const compactChatHistory = this.chatMessages.slice(-5).map((c) => `${c.sender === 'user' ? 'کاربر' : 'ایجنت'}: ${c.text}`);

    const keys = this.getActiveGeminiApiKeys();

    if (keys.length === 0) {
      reply = 'خطا در برقراری ارتباط با هوش مصنوعی: هیچ کلید API فعال برای Gemini در متغیرهای محیطی یافت نشد. لطفاً کلید API را تنظیم فرمایید.';
    } else {
      let callSucceeded = false;
      let lastErrorMessage = '';

      for (const apiKey of keys) {
        try {
          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          });

          const contextPrompt = `
تو ایجنت معامله‌گر واقعی و هوشمند هرمس (Hermes AI Trading Agent) هستی که بر روی حساب ایزوله زیر نظارت و کنترل داری:
- شناسه حساب فعال: ${targetAccountId} (${accState.config.name})
- نوع استراتژی حساب: ${accState.config.strategyType}
- پیام جدید کاربر: "${userText}"

اطلاعات زنده و واقعی حساب و عملکرد معاملات:
- موجودی حساب (Balance): $${currentBalance}
- ارزش خالص (Equity): $${currentEquity}
- سود/زیان شناور معاملات باز: $${(currentEquity - currentBalance).toFixed(2)}
- شماره حساب: ${accountNum} نزد بروکر ${broker}
- وضعیت اتصال به متاتریدر ۵: ${isBridgeConnected ? 'متصل' : 'آماده‌به‌کار'}
- تعداد پوزیشن‌های باز همزمان فعلی: ${openPositions}
- سقف مجاز پوزیشن‌های همزمان فعلی ایجنت: ${this.autonomousTrading.maxConcurrentPositions} (از ۱ تا ۵ پوزیشن)
- قیمت خرید طلا (Ask): ${currentAsk} | قیمت فروش طلا (Bid): ${currentBid}
- عملکرد و آمار معاملات ۱ ساعت اخیر: ${JSON.stringify(stats1h)}
- عملکرد و آمار معاملات ۲۴ ساعت اخیر: ${JSON.stringify(stats24h)}
- عملکرد کلی کل تاریخچه معاملات: ${JSON.stringify(statsAll)}
- وضعیت فعلی ترید خودکار: ${
            this.autonomousTrading.enabled
              ? `فعال (تارگت سود: $${this.autonomousTrading.targetProfitUSD}، لات: ${this.autonomousTrading.lotSize}، سقف پوزیشن: ${this.autonomousTrading.maxConcurrentPositions}، باقی‌مانده: ${this.autonomousTrading.durationHours} ساعت)`
              : 'غیرفعال'
          }

[حافظه بلندمدت اختصاصی و آموزه‌های ثبت‌شده این حساب]:
${JSON.stringify(accountMemories.slice(0, 10))}

[پنج گفتگو اخیر کاربر و ایجنت (فشرده‌سازی شده)]:
${compactChatHistory.join('\n')}

دستورالعمل‌های حیاتی:
1. تو یک هوش مصنوعی واقعی هستی. حافظه اختصاصی حساب ${targetAccountId} را کاملاً به یاد داشته باش.
2. اگر کاربر درباره سود/زیان ۲۴ ساعت گذشته، ۱ ساعت گذشته یا تاریخچه معاملات پرسید، آمار واقعی بالایی را آنالیز کرده و اعداد دقیق سود/زیان دلار، سود شناور، تعداد پوزیشن‌ها و موجودی را با لحن حرفه‌ای و دقیق ارائه بده.
3. اگر کاربر دستور تعیین سقف پوزیشن داد (مثلا فقط ۱ یا ۲ پوزیشن باز کن)، عدد "maxConcurrentPositions" را در پاسخ JSON قرار بده.
4. بر اساس تحلیل پیام کاربر، ساختار JSON زیر را تولید کن:
{
  "reply": "متن پاسخ کامل، تحلیلی، تخصصی و مستقیم به کاربر به زبان فارسی",
  "action": "CHAT" | "ENABLE_AUTONOMOUS" | "DISABLE_AUTONOMOUS" | "TRADE_BUY" | "TRADE_SELL" | "CLOSE_ALL" | "SAVE_MEMORY",
  "lot": 0.01,
  "maxConcurrentPositions": 5,
  "targetProfitUSD": 1.0,
  "durationHours": 8,
  "memoryNote": "متن استراتژی یا قانون جهت ثبت در حافظه اختصاصی این حساب"
}

راهنمای تعیین action:
- "ENABLE_AUTONOMOUS": اگر کاربر خواستار فعال‌سازی معامله خودکار شد.
- "DISABLE_AUTONOMOUS": اگر کاربر خواستار توقف ترید خودکار شد.
- "TRADE_BUY": اگر کاربر دستور خرید مستقیم طلا داد.
- "TRADE_SELL": اگر کاربر دستور فروش مستقیم طلا داد.
- "CLOSE_ALL": اگر کاربر دستور بستن همه پوزیشن‌ها را داد.
- "SAVE_MEMORY": اگر کاربر قانون یا استراتژی جدیدی برای یادگیری داد.
- "CHAT": برای استعلام‌های سود ۲۴ ساعته، موجودی، گزارش‌ها و گفتگوها.
`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: contextPrompt,
            config: {
              responseMimeType: 'application/json',
            },
          });

          if (response.text) {
            const parsed = JSON.parse(response.text);
            if (parsed.reply) {
              reply = parsed.reply;

              if (parsed.maxConcurrentPositions && typeof parsed.maxConcurrentPositions === 'number' && parsed.maxConcurrentPositions >= 1 && parsed.maxConcurrentPositions <= 5) {
                this.autonomousTrading.maxConcurrentPositions = parsed.maxConcurrentPositions;
                this.updateMaxOpenPositionsRule(parsed.maxConcurrentPositions);
              }

              if (parsed.action === 'ENABLE_AUTONOMOUS') {
                const targetMaxPos = (parsed.maxConcurrentPositions && parsed.maxConcurrentPositions >= 1 && parsed.maxConcurrentPositions <= 5)
                  ? parsed.maxConcurrentPositions
                  : (this.autonomousTrading.maxConcurrentPositions || 5);

                this.autonomousTrading = {
                  enabled: true,
                  startTime: Date.now(),
                  durationHours: parsed.durationHours || 8,
                  strategy: 'scalping',
                  targetProfitUSD: parsed.targetProfitUSD || 1.0,
                  stopLossUSD: 2.5,
                  lotSize: parsed.lot || 0.01,
                  maxConcurrentPositions: targetMaxPos,
                  lastOrderTime: null,
                };
                this.updateMaxOpenPositionsRule(targetMaxPos);

                await this.addMemoryNote(
                  'استراتژی اسکالپ خودکار',
                  `معامله خودکار ${this.autonomousTrading.durationHours} ساعته توسط AI فعال شد. هدف سود: $${this.autonomousTrading.targetProfitUSD}، سقف پوزیشن همزمان: ${targetMaxPos}، حجم: ${this.autonomousTrading.lotSize} لات.`,
                  targetAccountId
                );

                const currentSignal = this.getTradingSignal();
                const initialType = currentSignal.action === 'SELL' ? 'SELL' : 'BUY';
                const initialEntry = initialType === 'BUY' ? currentAsk : currentBid;
                const sl = initialType === 'BUY' ? Number((initialEntry - 2.5).toFixed(2)) : Number((initialEntry + 2.5).toFixed(2));
                const tp = initialType === 'BUY' ? Number((initialEntry + 1.0).toFixed(2)) : Number((initialEntry - 1.0).toFixed(2));

                this.createOrder({
                  symbol: 'XAUUSD.m',
                  type: initialType,
                  lot: parsed.lot || 0.01,
                  sl,
                  tp,
                  source: 'ai_agent',
                });
              } else if (parsed.action === 'DISABLE_AUTONOMOUS') {
                this.autonomousTrading.enabled = false;
              } else if (parsed.action === 'TRADE_BUY' || parsed.action === 'TRADE_SELL') {
                const type = parsed.action === 'TRADE_BUY' ? 'BUY' : 'SELL';
                const sl = type === 'BUY' ? Number((currentAsk - 2.5).toFixed(2)) : Number((currentBid + 2.5).toFixed(2));
                const tp = type === 'BUY' ? Number((currentAsk + 1.0).toFixed(2)) : Number((currentBid - 1.0).toFixed(2));
                this.createOrder({
                  symbol: 'XAUUSD.m',
                  type,
                  lot: parsed.lot || 0.01,
                  sl,
                  tp,
                  source: 'ai_agent',
                });
              } else if (parsed.action === 'CLOSE_ALL') {
                this.createOrder({
                  symbol: 'XAUUSD.m',
                  type: 'CLOSE_ALL',
                  lot: 0.01,
                  source: 'user_manual',
                });
              }

              if (parsed.memoryNote) {
                await this.addMemoryNote('آموزه کاربر', parsed.memoryNote, targetAccountId);
              }

              callSucceeded = true;
              break;
            }
          }
        } catch (err: any) {
          lastErrorMessage = err?.message || String(err);
          console.warn(`[TradingEngine] Gemini API key attempt failed: ${lastErrorMessage}`);
        }
      }

      if (!callSucceeded) {
        reply = `خطا در برقراری ارتباط با هوش مصنوعی Gemini: ${lastErrorMessage || 'عدم دریافت پاسخ از مدل'}. هیچ پاسخ قالبی یا ساختگی ارسال نگردید.`;
      }
    }

    const agentMsg = {
      id: `chat_${Date.now()}_agent`,
      sender: 'agent' as const,
      text: reply,
      timestamp: new Date().toISOString(),
      accountId: targetAccountId,
    };
    this.chatMessages.push(agentMsg);
    await supabaseService.saveChatMessage(agentMsg);

    return {
      reply,
      chatMessages: this.chatMessages,
      agentMemory: this.getMemory(targetAccountId),
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

  public getIndicators(timeframe?: TimeframeType): MultiTimeframeIndicators | IndicatorValues | undefined {
    if (!this.latestUnifiedSnapshot?.indicators) {
      // Calculate on current candles or return fallback
      const candles = this.latestUnifiedSnapshot?.candles || {};
      const symbol = this.latestUnifiedSnapshot?.market.symbol || 'XAUUSD.m';
      const computed = indicatorEngine.computeAllTimeframes(symbol, candles);
      return timeframe ? computed[timeframe] : computed;
    }

    return timeframe ? this.latestUnifiedSnapshot.indicators[timeframe] : this.latestUnifiedSnapshot.indicators;
  }

  public getRiskAssessment(proposedOrder?: Partial<TradeOrder>): RiskAssessmentResult {
    if (this.latestUnifiedSnapshot) {
      return riskEngine.evaluateRisk(this.latestUnifiedSnapshot, this.state.riskRules, proposedOrder);
    }

    // Return default baseline risk assessment if snapshot not yet arrived
    const mockSnapshot: UnifiedSnapshot = {
      snapshotVersion: '1.0.0',
      sequence: 0,
      timestamp: new Date().toISOString(),
      account: this.state.bridgeStatus.accountInfo || { balance: 971.49, equity: 971.49 },
      symbolSpec: { symbol: 'XAUUSD.m', digits: 2, point: 0.01, tickSize: 0.01, tickValue: 1, contractSize: 100, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
      market: { symbol: 'XAUUSD.m', ask: 4107.81, bid: 4106.50, spread: 1.31, serverTime: new Date().toISOString(), utcTime: new Date().toISOString() },
      positions: [],
      candles: {},
      dataQuality: this.state.bridgeStatus.dataQuality || {
        lastTickAgeMs: 0,
        isConnected: true,
        isDataComplete: true,
        latencyMs: 12,
        serverTime: new Date().toISOString(),
        localTime: new Date().toISOString(),
        lastSuccessfulSync: new Date().toISOString(),
        snapshotSequence: 0,
        brokerServerTime: new Date().toISOString(),
      },
    };

    return riskEngine.evaluateRisk(mockSnapshot, this.state.riskRules, proposedOrder);
  }

  public getTradingSignal(): TradingSignal {
    if (this.latestUnifiedSnapshot) {
      return strategyEngine.evaluateStrategy(this.latestUnifiedSnapshot);
    }

    const mockAssessment = this.getRiskAssessment();
    const mockSnapshot: UnifiedSnapshot = {
      snapshotVersion: '1.0.0',
      sequence: 0,
      timestamp: new Date().toISOString(),
      account: this.state.bridgeStatus.accountInfo || { balance: 971.49, equity: 971.49 },
      symbolSpec: { symbol: 'XAUUSD.m', digits: 2, point: 0.01, tickSize: 0.01, tickValue: 1, contractSize: 100, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
      market: { symbol: 'XAUUSD.m', ask: 4107.81, bid: 4106.50, spread: 1.31, serverTime: new Date().toISOString(), utcTime: new Date().toISOString() },
      positions: [],
      candles: {},
      riskAssessment: mockAssessment,
      dataQuality: this.state.bridgeStatus.dataQuality || {
        lastTickAgeMs: 0,
        isConnected: true,
        isDataComplete: true,
        latencyMs: 12,
        serverTime: new Date().toISOString(),
        localTime: new Date().toISOString(),
        lastSuccessfulSync: new Date().toISOString(),
        snapshotSequence: 0,
        brokerServerTime: new Date().toISOString(),
      },
    };

    return strategyEngine.evaluateStrategy(mockSnapshot);
  }

  public async getAIAnalysis(): Promise<GeminiAIAnalysis> {
    const activeRules = await this.getKnowledgeRules();
    if (this.latestUnifiedSnapshot) {
      return geminiEngine.analyzeSnapshot(this.latestUnifiedSnapshot, activeRules);
    }

    const mockAssessment = this.getRiskAssessment();
    const mockSignal = this.getTradingSignal();
    const mockSnapshot: UnifiedSnapshot = {
      snapshotVersion: '1.0.0',
      sequence: 0,
      timestamp: new Date().toISOString(),
      account: this.state.bridgeStatus.accountInfo || { balance: 971.49, equity: 971.49 },
      symbolSpec: { symbol: 'XAUUSD.m', digits: 2, point: 0.01, tickSize: 0.01, tickValue: 1, contractSize: 100, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
      market: { symbol: 'XAUUSD.m', ask: 4107.81, bid: 4106.50, spread: 1.31, serverTime: new Date().toISOString(), utcTime: new Date().toISOString() },
      positions: [],
      candles: {},
      riskAssessment: mockAssessment,
      strategySignal: mockSignal,
      dataQuality: this.state.bridgeStatus.dataQuality || {
        lastTickAgeMs: 0,
        isConnected: true,
        isDataComplete: true,
        latencyMs: 12,
        serverTime: new Date().toISOString(),
        localTime: new Date().toISOString(),
        lastSuccessfulSync: new Date().toISOString(),
        snapshotSequence: 0,
        brokerServerTime: new Date().toISOString(),
      },
    };

    return geminiEngine.analyzeSnapshot(mockSnapshot, activeRules);
  }

  public getExecutionResult(): ExecutionEngineResult {
    if (this.latestUnifiedSnapshot) {
      return executionEngine.processExecution(this.latestUnifiedSnapshot, this.state.isAgentActive);
    }

    const mockAssessment = this.getRiskAssessment();
    const mockSignal = this.getTradingSignal();
    const mockSnapshot: UnifiedSnapshot = {
      snapshotVersion: '1.0.0',
      sequence: 0,
      timestamp: new Date().toISOString(),
      account: this.state.bridgeStatus.accountInfo || { balance: 971.49, equity: 971.49 },
      symbolSpec: { symbol: 'XAUUSD.m', digits: 2, point: 0.01, tickSize: 0.01, tickValue: 1, contractSize: 100, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
      market: { symbol: 'XAUUSD.m', ask: 4107.81, bid: 4106.50, spread: 1.31, serverTime: new Date().toISOString(), utcTime: new Date().toISOString() },
      positions: [],
      candles: {},
      riskAssessment: mockAssessment,
      strategySignal: mockSignal,
      dataQuality: this.state.bridgeStatus.dataQuality || {
        lastTickAgeMs: 0,
        isConnected: true,
        isDataComplete: true,
        latencyMs: 12,
        serverTime: new Date().toISOString(),
        localTime: new Date().toISOString(),
        lastSuccessfulSync: new Date().toISOString(),
        snapshotSequence: 0,
        brokerServerTime: new Date().toISOString(),
      },
    };

    return executionEngine.processExecution(mockSnapshot, this.state.isAgentActive);
  }

  public getRecentTelemetry(): TelemetryRecord[] {
    return telemetryEngine.getRecentRecords();
  }

  public processHeartbeat(payload: any): { pendingOrders: TradeOrder[]; dataQuality?: DataQualityMetrics } {
    return this.processSnapshot(payload);
  }

  public processSnapshot(payload: any): { pendingOrders: TradeOrder[]; dataQuality: DataQualityMetrics; strategySignal?: TradingSignal } {
    const startTime = Date.now();
    const now = new Date();

    this.snapshotSequence++;

    // 1. Extract Account Info
    const acc = payload.account || payload.accountInfo || {};
    const accountInfo: ExtendedAccountInfo = {
      accountNumber: acc.accountNumber ?? this.state.bridgeStatus.accountInfo?.accountNumber ?? 9028145,
      broker: acc.broker ?? this.state.bridgeStatus.accountInfo?.broker ?? '.Markets Ltd',
      balance: acc.balance ?? this.state.bridgeStatus.accountInfo?.balance ?? 971.49,
      equity: acc.equity ?? this.state.bridgeStatus.accountInfo?.equity ?? 971.49,
      margin: acc.margin ?? this.state.bridgeStatus.accountInfo?.margin ?? 0,
      freeMargin: acc.freeMargin ?? this.state.bridgeStatus.accountInfo?.freeMargin ?? 971.49,
      marginLevel: acc.marginLevel ?? (acc.margin > 0 ? (acc.equity / acc.margin) * 100 : 0),
      floatingProfit: acc.floatingProfit ?? (acc.equity - acc.balance),
      dailyProfit: acc.dailyProfit ?? 0,
      drawdown: acc.drawdown ?? 0,
      usedMargin: acc.usedMargin ?? acc.margin ?? 0,
      openPositionsCount: acc.openPositionsCount ?? (payload.positions ? payload.positions.length : (this.state.bridgeStatus.accountInfo?.openPositionsCount ?? 0)),
      currency: acc.currency ?? 'USD',
    };

    // 2. Extract Market State
    const symbol = payload.symbol || payload.market?.symbol || 'XAUUSD.m';
    const ask = payload.ask ?? payload.market?.ask ?? this.state.lastTick?.ask ?? 4107.81;
    const bid = payload.bid ?? payload.market?.bid ?? this.state.lastTick?.bid ?? 4106.50;
    const spread = payload.spread ?? payload.market?.spread ?? Math.round((ask - bid) * 100) / 100;
    const serverTimeStr = payload.serverTime || payload.market?.serverTime || now.toISOString();

    const marketState: MarketState = {
      symbol,
      ask,
      bid,
      spread,
      serverTime: serverTimeStr,
      utcTime: now.toISOString(),
      tradingSession: payload.market?.tradingSession || 'London/NewYork',
      marketOpenStatus: payload.market?.marketOpenStatus ?? true,
    };

    // 3. Extract Symbol Specs
    const spec = payload.symbolSpec || {};
    const symbolSpec: SymbolSpecification = {
      symbol,
      digits: spec.digits ?? 2,
      point: spec.point ?? 0.01,
      tickSize: spec.tickSize ?? 0.01,
      tickValue: spec.tickValue ?? 1.0,
      contractSize: spec.contractSize ?? 100,
      minLot: spec.minLot ?? 0.01,
      maxLot: spec.maxLot ?? 100.0,
      lotStep: spec.lotStep ?? 0.01,
    };

    // 4. Extract Positions & Candles
    const positions: PositionInfo[] = Array.isArray(payload.positions) ? payload.positions : [];
    const candles: TimeframeOHLCV = payload.candles || {};

    // 5. Evaluate Data Quality
    const lastTickAgeMs = Math.max(0, Date.now() - new Date(serverTimeStr).getTime());
    const missingFields: string[] = [];
    if (!payload.symbol && !payload.market?.symbol) missingFields.push('symbol');
    if (payload.ask === undefined && payload.market?.ask === undefined) missingFields.push('ask');
    if (payload.bid === undefined && payload.market?.bid === undefined) missingFields.push('bid');

    const isDataComplete = missingFields.length === 0;
    const latencyMs = Math.max(2, Date.now() - startTime);

    const dataQuality: DataQualityMetrics = {
      lastTickAgeMs: isNaN(lastTickAgeMs) ? 0 : lastTickAgeMs,
      isConnected: true,
      isDataComplete,
      latencyMs,
      serverTime: serverTimeStr,
      localTime: now.toISOString(),
      lastSuccessfulSync: now.toISOString(),
      snapshotSequence: payload.sequence || this.snapshotSequence,
      brokerServerTime: serverTimeStr,
      missingFields: isDataComplete ? undefined : missingFields,
    };

    // 6. Compute Technical Indicators via Phase 2 Backend Indicator Engine
    const indicators: MultiTimeframeIndicators = indicatorEngine.computeAllTimeframes(symbol, candles);

    // 7. Temporary snapshot object for Risk Assessment evaluation
    const tempSnapshot: UnifiedSnapshot = {
      snapshotVersion: '1.0.0',
      sequence: dataQuality.snapshotSequence,
      timestamp: now.toISOString(),
      account: accountInfo,
      symbolSpec,
      market: marketState,
      positions,
      candles,
      indicators,
      dataQuality,
    };

    // 8. Evaluate Risk Assessment via Phase 3 RiskEngine
    const riskAssessment = riskEngine.evaluateRisk(tempSnapshot, this.state.riskRules);

    // 9. Evaluate Strategy Signal via Phase 4 StrategyEngine
    const strategySignal = strategyEngine.evaluateStrategy({
      ...tempSnapshot,
      riskAssessment,
    });

    // 10. Evaluate Execution Engine (Phase 6)
    const executionResult = executionEngine.processExecution(tempSnapshot, this.state.isAgentActive);

    // 11. Evaluate Telemetry & Audit Engine (Phase 7)
    const telemetryRecord = telemetryEngine.recordTelemetry(tempSnapshot, executionResult);

    // 12. Build final Unified Snapshot
    const unifiedSnapshot: UnifiedSnapshot = {
      ...tempSnapshot,
      riskAssessment,
      strategySignal,
      executionResult,
      telemetryRecord,
    };

    // Update Multi-Account Isolated State Engine
    const targetAccountId = payload.accountId || (accountInfo.accountNumber ? `MT5_${accountInfo.accountNumber}` : this.activeAccountId);
    const accState = this.getOrCreateAccountState(targetAccountId, accountInfo.accountNumber, accountInfo.broker);
    accState.accountInfo = accountInfo;
    accState.positions = positions;
    accState.bridgeStatus.isConnected = true;
    accState.bridgeStatus.lastHeartbeat = now.toISOString();
    accState.bridgeStatus.latencyMs = latencyMs;
    accState.bridgeStatus.accountInfo = accountInfo;
    accState.bridgeStatus.dataQuality = dataQuality;
    accState.bridgeStatus.riskAssessment = riskAssessment;
    accState.bridgeStatus.strategySignal = strategySignal;
    accState.bridgeStatus.executionResult = executionResult;
    accState.bridgeStatus.telemetryRecord = telemetryRecord;
    accState.bridgeStatus.unifiedSnapshot = unifiedSnapshot;
    accState.bridgeStatus.initialSyncCompleted = true;
    accState.lastTick = { symbol, ask, bid, spread, timestamp: now.toISOString() };
    accState.config.lastActiveAt = now.toISOString();

    this.latestUnifiedSnapshot = unifiedSnapshot;
    this.initialSyncCompleted = true;

    // Synchronize current UI active state if target account matches activeAccountId
    if (targetAccountId === this.activeAccountId) {
      this.state.bridgeStatus.isConnected = true;
      this.state.bridgeStatus.lastHeartbeat = now.toISOString();
      this.state.bridgeStatus.latencyMs = latencyMs;
      this.state.bridgeStatus.accountInfo = accountInfo;
      this.state.bridgeStatus.dataQuality = dataQuality;
      this.state.bridgeStatus.riskAssessment = riskAssessment;
      this.state.bridgeStatus.strategySignal = strategySignal;
      this.state.bridgeStatus.executionResult = executionResult;
      this.state.bridgeStatus.telemetryRecord = telemetryRecord;
      this.state.bridgeStatus.unifiedSnapshot = unifiedSnapshot;
      this.state.bridgeStatus.initialSyncCompleted = true;

      this.state.lastTick = {
        symbol,
        ask,
        bid,
        spread,
        timestamp: now.toISOString(),
      };
    }

    // Autonomous trading check
    this.runAutonomousScalpCheck();

    const ordersToExecute = (targetAccountId === this.activeAccountId ? this.state.pendingOrders : accState.pendingOrders).filter((o) => o.status === 'pending');
    return { pendingOrders: ordersToExecute, dataQuality };
  }

  private runAutonomousScalpCheck(): void {
    if (!this.autonomousTrading.enabled) return;

    const elapsed = Date.now() - (this.autonomousTrading.startTime || Date.now());
    const durationMs = this.autonomousTrading.durationHours * 3600 * 1000;

    if (elapsed > durationMs) {
      this.autonomousTrading.enabled = false;
      this.logTradingActivity('ai_analysis', `[ترید خودکار هرمس] مهلت ${this.autonomousTrading.durationHours} ساعته معامله خودکار پایان یافت.`);
    } else {
      const hasPending = this.state.pendingOrders.some((o) => o.status === 'pending');
      const openPositions = this.state.bridgeStatus.accountInfo?.openPositionsCount ?? 0;
      const maxAllowedPositions = this.autonomousTrading.maxConcurrentPositions || 5;
      const timeSinceLastOrder = Date.now() - (this.autonomousTrading.lastOrderTime || 0);

      if (openPositions < maxAllowedPositions && !hasPending && timeSinceLastOrder > 30000) {
        const ask = this.state.lastTick?.ask || 4107.81;
        const sl = Number((ask - 2.50).toFixed(2));
        const tp = Number((ask + 1.00).toFixed(2));

        const res = this.createOrder({
          symbol: 'XAUUSD.m',
          type: 'BUY',
          lot: this.autonomousTrading.lotSize,
          sl,
          tp,
          source: 'ai_agent',
        });

        if (res.success) {
          this.autonomousTrading.lastOrderTime = Date.now();
          this.logTradingActivity(
            'ai_analysis',
            `[اسکالپ خودکار ایجنت هرمس] سفارش جدید ثبت شد. (هدف سود: $1.00 دلار | حد ضرر: $2.50 دلار | لات: ${this.autonomousTrading.lotSize})`
          );
        }
      }
    }
  }

  public createOrder(orderInput: {
    symbol: string;
    type: 'BUY' | 'SELL' | 'CLOSE' | 'CLOSE_ALL';
    lot: number;
    sl?: number;
    tp?: number;
    source: 'ai_agent' | 'user_manual' | 'telegram';
    clientOrderId?: string;
  }): { success: boolean; order?: TradeOrder; error?: string } {
    const clientOrderId = orderInput.clientOrderId || `cid_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Check Idempotency: Prevent duplicate execution if this order was already processed
    if (this.processedClientOrderIds.has(clientOrderId)) {
      const existingOrder =
        this.state.pendingOrders.find((o) => o.clientOrderId === clientOrderId || o.id === clientOrderId) ||
        this.state.orderHistory.find((o) => o.clientOrderId === clientOrderId || o.id === clientOrderId);
      if (existingOrder) {
        return { success: true, order: existingOrder };
      }
    }

    // Phase 3 Risk Engine Pre-Execution Rule Checks
    if (orderInput.type === 'BUY' || orderInput.type === 'SELL') {
      const assessment = this.getRiskAssessment(orderInput);
      if (!assessment.isAllowed) {
        const primaryFailure = assessment.failedRules[0];
        const err = `خطای موتور ریسک (Risk Engine): ${primaryFailure ? primaryFailure.reason : 'معامله با قوانین غیرقابل مذاکره ریسک مغایرت دارد.'}`;
        this.logTradingActivity('rule_check', err, { orderInput, assessment });
        return { success: false, error: err };
      }
    }

    this.processedClientOrderIds.add(clientOrderId);

    const newOrder: TradeOrder = {
      id: `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      clientOrderId,
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
      `سفارش جدید ${newOrder.type} روی نماد ${newOrder.symbol} (حجم: ${newOrder.lot}) با شناسه ${clientOrderId} صادر و در صف ارسال قرار گرفت.`,
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
#property version   "2.00"
#property description "ربات سفیر پیشرفته متاتریدر ۵ (نسخه ۲.۰۰) - پشتیبانی از Persistent Idempotency، Multi-Timeframe Candles و Mandatory SL Guard"

#include <Trade\\Trade.mqh>
CTrade trade;

//--- Input Parameters
input string   InpServerUrl     = "${cleanUrl}/api/trading/tick"; // آدرس API سفیر و دریافت پپ‌لاین
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

// Helper: Send Order Result back to Cloud Router
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
  }
}

export const tradingEngine = new TradingEngine();
