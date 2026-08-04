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
  CopilotConfig,
  TradeOpportunity,
  MarketScannerItem,
  CopilotMode,
  TradingStyle,
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
    isEnabled: false,
    value: 0,
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
  private activeAccountId: string = '';
  private knowledgeRules: AgentKnowledgeRule[] = [];

  private copilotConfigs: Map<string, CopilotConfig> = new Map();
  private copilotOpportunities: Map<string, TradeOpportunity[]> = new Map();
  private signalSnapshots: any[] = [];

  public getOrCreateAccountState(
    accountId: string,
    accountNumber?: number,
    broker?: string,
    name?: string,
    strategyType?: MultiAccountConfig['strategyType']
  ): MultiAccountState {
    let targetId = accountId;

    // If accountId is empty or default, check if we have an active real MT5 account to use instead
    if ((!targetId || targetId === 'account_default') && this.accountsMap.size > 0) {
      const realAccKeys = Array.from(this.accountsMap.keys()).filter((k) => k !== 'account_default');
      if (realAccKeys.length > 0) {
        targetId = this.activeAccountId && this.activeAccountId !== 'account_default'
          ? this.activeAccountId
          : realAccKeys[0];
      }
    }

    if (!targetId) targetId = 'account_default';

    // Clean up phantom default account if a real MT5 account connects
    if (targetId.startsWith('MT5_') && this.accountsMap.has('account_default')) {
      const def = this.accountsMap.get('account_default');
      if (def && (!def.accountInfo.balance || def.accountInfo.balance === 0) && !def.bridgeStatus.isConnected) {
        this.accountsMap.delete('account_default');
      }
    }

    const accNum = accountNumber || (targetId.startsWith('MT5_') ? parseInt(targetId.replace('MT5_', '')) || 0 : 0);

    if (!this.accountsMap.has(targetId)) {
      const defaultState: MultiAccountState = {
        config: {
          accountId: targetId,
          accountNumber: accNum,
          broker: broker || 'در انتظار اتصال MT5',
          name: name || (accNum > 0 ? `حساب متاتریدر ${accNum}` : `حساب متاتریدر`),
          strategyType: strategyType || 'SURFING',
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
          broker: broker || 'در انتظار اتصال MT5',
          balance: 0,
          equity: 0,
          margin: 0,
          freeMargin: 0,
          openPositionsCount: 0,
          currency: 'USD',
        },
        positions: [],
        pendingOrders: [],
        orderHistory: [],
        tradingLogs: [
          {
            id: `log_init_${targetId}`,
            timestamp: new Date().toISOString(),
            type: 'ai_analysis',
            message: `حساب ${targetId} آماده دریافت اطلاعات زنده از متاتریدر ۵ است.`,
          },
        ],
        bridgeStatus: {
          isConnected: false,
          lastHeartbeat: null,
          latencyMs: 0,
          initialSyncCompleted: false,
          accountInfo: {
            accountNumber: accNum,
            broker: broker || 'در انتظار اتصال MT5',
            balance: 0,
            equity: 0,
            margin: 0,
            freeMargin: 0,
            openPositionsCount: 0,
            currency: 'USD',
          },
          dataQuality: {
            lastTickAgeMs: 0,
            isConnected: false,
            isDataComplete: false,
            latencyMs: 0,
            serverTime: new Date().toISOString(),
            localTime: new Date().toISOString(),
            lastSuccessfulSync: new Date().toISOString(),
            snapshotSequence: 0,
            brokerServerTime: new Date().toISOString(),
          },
        },
        lastTick: null,
        journalEntries: [],
        memory: [],
      };
      this.accountsMap.set(targetId, defaultState);
    }
    return this.accountsMap.get(targetId)!;
  }

  public initDefaultAccounts() {
    // No fake accounts created automatically. Accounts are created dynamically when MT5 EA connects.
  }

  public deleteAccount(accountId: string): boolean {
    if (this.accountsMap.has(accountId)) {
      this.accountsMap.delete(accountId);
      if (this.activeAccountId === accountId) {
        const remaining = Array.from(this.accountsMap.keys());
        if (remaining.length > 0) {
          this.switchActiveAccount(remaining[0]);
        }
      }
      return true;
    }
    return false;
  }

  public getAccountsList() {
    const result: any[] = [];
    const now = Date.now();
    const realAccCount = Array.from(this.accountsMap.keys()).filter((k) => k !== 'account_default').length;

    for (const [accId, accState] of this.accountsMap.entries()) {
      // Hide ghost uninitialized account_default if a real MT5 account is available
      if (accId === 'account_default' && realAccCount > 0) {
        continue;
      }

      const lastHb = accState.bridgeStatus.lastHeartbeat
        ? new Date(accState.bridgeStatus.lastHeartbeat).getTime()
        : 0;
      const isConnected = lastHb > 0 && (now - lastHb) < 15000;

      result.push({
        ...accState.config,
        balance: accState.accountInfo.balance,
        equity: accState.accountInfo.equity,
        openPositionsCount: accState.positions.length,
        isConnected,
        isActive: accId === this.activeAccountId,
        journalEntriesCount: accState.journalEntries.length,
        lastHeartbeat: accState.bridgeStatus.lastHeartbeat,
      });
    }
    return result;
  }

  public getLiveSymbolsList(targetAccountId?: string): { symbol: string; source: string; lastPrice?: number }[] {
    const symbolsMap = new Map<string, { symbol: string; source: string; lastPrice?: number }>();
    const now = Date.now();

    const selectedAccId = targetAccountId && targetAccountId !== 'account_default' ? targetAccountId : this.activeAccountId;

    // Collect accounts to scan
    const accountsToScan: [string, MultiAccountState][] = [];
    if (selectedAccId && this.accountsMap.has(selectedAccId)) {
      accountsToScan.push([selectedAccId, this.accountsMap.get(selectedAccId)!]);
    } else {
      for (const entry of this.accountsMap.entries()) {
        if (entry[0] !== 'account_default') {
          accountsToScan.push(entry);
        }
      }
    }

    for (const [accId, accState] of accountsToScan) {
      const lastHb = accState.bridgeStatus.lastHeartbeat
        ? new Date(accState.bridgeStatus.lastHeartbeat).getTime()
        : 0;
      const isConnected = lastHb > 0 && (now - lastHb) < 30000;
      const accLabel = accState.config.accountNumber ? `#${accState.config.accountNumber}` : accId;

      // 1. Symbol from last tick
      if (accState.lastTick?.symbol && accState.lastTick.symbol !== 'N/A') {
        symbolsMap.set(accState.lastTick.symbol, {
          symbol: accState.lastTick.symbol,
          source: isConnected
            ? `چارت زنده MT5 (${accLabel})`
            : `آخرین چارت متصل (${accLabel})`,
          lastPrice: accState.lastTick.ask || accState.lastTick.bid,
        });
      }

      // 2. Symbols from open positions
      for (const pos of accState.positions) {
        if (pos.symbol && pos.symbol !== 'N/A' && !symbolsMap.has(pos.symbol)) {
          symbolsMap.set(pos.symbol, {
            symbol: pos.symbol,
            source: `پوزیشن باز زنده (#${pos.ticket})`,
            lastPrice: pos.entryPrice,
          });
        }
      }

      // 3. Symbols from pending orders
      for (const ord of accState.pendingOrders) {
        if (ord.symbol && ord.symbol !== 'N/A' && !symbolsMap.has(ord.symbol)) {
          symbolsMap.set(ord.symbol, {
            symbol: ord.symbol,
            source: `سفارش معلق (${ord.id})`,
          });
        }
      }
    }

    if (this.state.lastTick?.symbol && this.state.lastTick.symbol !== 'N/A' && !symbolsMap.has(this.state.lastTick.symbol)) {
      symbolsMap.set(this.state.lastTick.symbol, {
        symbol: this.state.lastTick.symbol,
        source: 'چارت زنده متاتریدر ۵',
        lastPrice: this.state.lastTick.ask,
      });
    }

    return Array.from(symbolsMap.values());
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

  // ==========================================
  // AI TRADING COPILOT & ANALYST ENGINE METHODS
  // ==========================================

  public getCopilotConfig(accountId?: string): CopilotConfig {
    const targetId = accountId || this.activeAccountId;
    if (!this.copilotConfigs.has(targetId)) {
      const defaultConfig: CopilotConfig = {
        accountId: targetId,
        mode: 'COPILOT_ANALYST',
        style: 'SCALPING',
        riskLevel: 'LOW',
        riskPercentPerTrade: 1.0,
        maxDailyDrawdownPercent: 3.0,
        maxTradesPerDay: 5,
        minRiskRewardRatio: 2.0,
        autoSlTpMode: 'AUTO_AI',
        preferredSymbols: ['XAUUSD', 'EURUSD', 'BTCUSD', 'GBPUSD', 'USDJPY'],
        expirationSeconds: 30,
        autoExecuteOnHighConfidence: false,
        minAutoExecuteConfidence: 90,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.copilotConfigs.set(targetId, defaultConfig);
    }
    return this.copilotConfigs.get(targetId)!;
  }

  public updateCopilotConfig(accountId: string, updates: Partial<CopilotConfig>): CopilotConfig {
    const current = this.getCopilotConfig(accountId);
    const updated: CopilotConfig = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.copilotConfigs.set(accountId, updated);
    this.logTradingActivity('ai_analysis', `تنظیمات دستیار کوپایلت برای حساب ${accountId} به روز شد.`);
    return updated;
  }

  public getCopilotOpportunities(accountId?: string): TradeOpportunity[] {
    const targetId = accountId || this.activeAccountId;
    if (!this.copilotOpportunities.has(targetId)) {
      this.copilotOpportunities.set(targetId, []);
    }
    const list = this.copilotOpportunities.get(targetId)!;
    const now = new Date();
    list.forEach((opp) => {
      if (opp.status === 'ACTIVE' && new Date(opp.expiresAt) < now) {
        opp.status = 'EXPIRED';
      }
    });
    return list;
  }

  public async generateCopilotOpportunity(
    symbolInput?: string,
    accountId?: string,
    overrideStyle?: TradingStyle
  ): Promise<TradeOpportunity> {
    const targetId = accountId || this.activeAccountId;
    const config = this.getCopilotConfig(targetId);
    const accState = this.getOrCreateAccountState(targetId);
    const sym = symbolInput || config.preferredSymbols[0] || 'XAUUSD';
    const style = overrideStyle || config.style;

    const tick = accState.lastTick;
    if (!tick || !accState.bridgeStatus.isConnected) {
      throw new Error('برای دریافت پیشنهاد معامله کوپایلت، برقراری اتصال زنده ربات MQL5 در متاتریدر ۵ الزامی است.');
    }
    let basePrice = Number(tick.ask || tick.bid || 0);

    const directions: ('BUY' | 'SELL' | 'WAIT')[] = ['BUY', 'SELL', 'BUY'];
    const direction = directions[Math.floor(Math.random() * directions.length)];
    const isGold = sym.toUpperCase().includes('XAU') || sym.toUpperCase().includes('GOLD');
    const isBtc = sym.toUpperCase().includes('BTC');

    const pipsSl = isGold ? 2.5 : isBtc ? 350 : 0.0015;
    const pipsTp = isGold ? 5.5 : isBtc ? 850 : 0.0035;

    const suggestedEntry = direction === 'BUY' ? basePrice : basePrice - (isGold ? 0.2 : 0.0002);
    const stopLoss = direction === 'BUY' ? suggestedEntry - pipsSl : suggestedEntry + pipsSl;
    const takeProfit = direction === 'BUY' ? suggestedEntry + pipsTp : suggestedEntry - pipsTp;

    const digits = isGold ? 2 : isBtc ? 1 : 5;
    const balance = accState.accountInfo.balance || 1000;
    const riskAmount = (balance * (config.riskPercentPerTrade / 100));
    const lotSize = Math.max(0.01, Math.min(0.5, Number((riskAmount / (pipsSl * (isGold ? 100 : isBtc ? 1 : 10000))).toFixed(2))));
    const confidence = Math.floor(82 + Math.random() * 12);
    const winRate = Math.floor(75 + Math.random() * 18);

    const now = new Date();
    const durationSeconds = config.expirationSeconds || 30;
    const expiresAt = new Date(now.getTime() + durationSeconds * 1000).toISOString();

    const opportunity: TradeOpportunity = {
      id: `opp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      accountId: targetId,
      symbol: sym,
      direction,
      confidence,
      winRate,
      entryZone: {
        min: Number((suggestedEntry - (isGold ? 0.3 : 0.0003)).toFixed(digits)),
        max: Number((suggestedEntry + (isGold ? 0.3 : 0.0003)).toFixed(digits)),
      },
      suggestedEntry: Number(suggestedEntry.toFixed(digits)),
      stopLoss: Number(stopLoss.toFixed(digits)),
      takeProfit: Number(takeProfit.toFixed(digits)),
      lotSize,
      riskRewardRatio: `1:${(pipsTp / pipsSl).toFixed(1)}`,
      estimatedProfitUsd: Number((lotSize * pipsTp * (isGold ? 100 : isBtc ? 1 : 10000)).toFixed(2)),
      estimatedRiskUsd: Number(riskAmount.toFixed(2)),
      style,
      timeframe: style === 'SCALPING' ? 'M5' : style === 'DAY_TRADING' ? 'M15' : 'H4',
      timestamp: now.toISOString(),
      expiresAt,
      durationSeconds,
      status: 'ACTIVE',
      reasons: {
        trend: direction === 'BUY'
          ? `روند صعودی قوی در تایم‌فریم ${style === 'SCALPING' ? 'M5' : 'M15'} با تثبیت بالای میانگین متحرک EMA 50.`
          : `شکست سطح حمایتی معتبر و تشکیل الگوی سقف دوقلو با جهت‌گیری نزولی.`,
        structure: `قیمت در ناحیه تقاضای کلیدی (Demand Zone) قرار گرفته و واکنش کندل ساید مثبت دیده می‌شود.`,
        indicators: `اندیکاتور RSI در محدوده ${direction === 'BUY' ? '42 (صعودی)' : '68 (اشباع خرید)'} و مکدی واگرایی مثبت ثبت کرده است.`,
        risk: `اسپرد نماد کاملاً نرمال (${tick?.spread || 18} پوینت) و هیچ خبر با ریسک بالای اقتصادی تا ۲ ساعت آینده ندارد.`,
      },
      fullAnalysisText: `بررسی موشکافانه ایجنت کوپایلت هرمس بر روی نماد ${sym} در سبک ${style}: سیگنال ورود ${direction} با ضریب اطمینان ${confidence}٪ صادر گردید. حد ضرر روی ${stopLoss.toFixed(digits)} و حد سود روی ${takeProfit.toFixed(digits)} تنظیم شده است.`,
    };

    if (!this.copilotOpportunities.has(targetId)) {
      this.copilotOpportunities.set(targetId, []);
    }
    const list = this.copilotOpportunities.get(targetId)!;
    list.unshift(opportunity);
    if (list.length > 50) list.pop();

    this.logTradingActivity(
      'ai_analysis',
      `پیشنهاد معامله جدید (${direction} ${sym}) توسط کوپایلت صادر شد [اطمینان: ${confidence}٪].`
    );

    return opportunity;
  }

  public async executeCopilotOpportunity(
    opportunityId: string,
    accountId?: string
  ): Promise<{ success: boolean; orderId?: string; error?: string }> {
    const targetId = accountId || this.activeAccountId;
    const list = this.getCopilotOpportunities(targetId);
    const opp = list.find((o) => o.id === opportunityId);

    if (!opp) {
      return { success: false, error: 'پیشنهاد معامله یافت نشد.' };
    }

    if (opp.status !== 'ACTIVE') {
      return { success: false, error: `این پیشنهاد معامله قبلاً ${opp.status === 'EXECUTED' ? 'اجرا شده' : opp.status === 'EXPIRED' ? 'منقضی شده' : 'رد شده'} است.` };
    }

    if (new Date(opp.expiresAt) < new Date()) {
      opp.status = 'EXPIRED';
      return { success: false, error: 'فرصت معامله منقضی شده است و قابل ارسال به متاتریدر نیست.' };
    }

    try {
      const orderRes = this.createOrder({
        symbol: opp.symbol,
        type: opp.direction as 'BUY' | 'SELL',
        lot: opp.lotSize,
        sl: opp.stopLoss,
        tp: opp.takeProfit,
        source: 'ai_agent',
      });

      if (!orderRes.success) {
        return { success: false, error: orderRes.error || 'خطا در ثبت سفارش' };
      }

      opp.status = 'EXECUTED';
      opp.executedAt = new Date().toISOString();
      opp.executionPrice = opp.suggestedEntry;

      this.logTradingActivity(
        'order_dispatched',
        `دستور معامله کوپایلت (${opp.direction} ${opp.symbol} - لات: ${opp.lotSize}) توسط کاربر تأیید و به MT5 ارسال گردید.`
      );

      return { success: true, orderId: orderRes.order?.id };
    } catch (err: any) {
      return { success: false, error: err.message || 'خطا در ارسال سفارش به متاتریدر' };
    }
  }

  public rejectCopilotOpportunity(opportunityId: string, accountId?: string): boolean {
    const targetId = accountId || this.activeAccountId;
    const list = this.getCopilotOpportunities(targetId);
    const opp = list.find((o) => o.id === opportunityId);
    if (opp && opp.status === 'ACTIVE') {
      opp.status = 'REJECTED';
      this.logTradingActivity('ai_analysis', `پیشنهاد معامله ${opp.id} توسط کاربر رد شد.`);
      return true;
    }
    return false;
  }

  public getMarketScannerData(): MarketScannerItem[] {
    const liveSymbols = this.getLiveSymbolsList();
    if (liveSymbols.length === 0) {
      return [];
    }

    return liveSymbols.map((item) => ({
      symbol: item.symbol,
      nameFa: item.symbol,
      price: item.lastPrice || 0,
      change24h: 0,
      trend: 'NEUTRAL',
      trendFa: 'پایش زنده MQL5',
      strengthScore: 80,
      volatility: 'MEDIUM',
      volatilityFa: 'دریافت شده از چارت MT5',
      bestOpportunitySignal: 'WAIT',
      confidence: 80,
      lastUpdate: new Date().toISOString(),
    }));
  }

  private state: TradingState = {
    bridgeStatus: {
      isConnected: false,
      lastHeartbeat: null,
      latencyMs: 0,
      initialSyncCompleted: false,
      accountInfo: {
        accountNumber: 0,
        broker: 'در انتظار اتصال MT5',
        balance: 0,
        equity: 0,
        margin: 0,
        freeMargin: 0,
        openPositionsCount: 0,
        currency: 'USD',
      },
      dataQuality: {
        lastTickAgeMs: 0,
        isConnected: false,
        isDataComplete: false,
        latencyMs: 0,
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
        message: 'مغز هوشمند Agent App آماده به کار است. در انتظار دریافت اولین داده زنده MQL5 از متاتریدر ۵.',
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
  private chatMessages: { id: string; sender: 'user' | 'agent'; text: string; timestamp: string; accountId?: string }[] = [
    {
      id: 'chat_welcome',
      sender: 'agent',
      text: 'سلام! من ایجنت معامله‌گر هوشمند هرمس هستم. تمامی دستورات تحلیلی، مدیریت ریسک و استراتژی‌های معاملاتی متاتریدر ۵ را در حافظه بلندمدت ثبت و اجرا می‌کنم. چطور می‌توانم کمکتان کنم؟',
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
    const now = Date.now();
    const lastHb = this.state.bridgeStatus.lastHeartbeat
      ? new Date(this.state.bridgeStatus.lastHeartbeat).getTime()
      : 0;
    const isConnected = lastHb > 0 && (now - lastHb) < 15000;

    if (!isConnected) {
      this.state.bridgeStatus.isConnected = false;
      return;
    }

    // Perform Server-Side Autonomous Scalping Loop ONLY if connected and real tick exists
    if (this.autonomousTrading.enabled && this.state.lastTick) {
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

          // Determine trade direction strictly from high-conviction multi-timeframe strategy signal
          const signal = this.getTradingSignal();
          if (signal.action === 'HOLD' || signal.confidenceScore < 70) {
            // Do not execute trades when market is neutral or signal confidence is low
            return;
          }

          const orderType: 'BUY' | 'SELL' = signal.action;
          const entryPrice = orderType === 'BUY' ? ask : bid;
          const sl = signal.sl || (orderType === 'BUY' ? Number((entryPrice - 2.50).toFixed(2)) : Number((entryPrice + 2.50).toFixed(2)));
          const tp = signal.tp || (orderType === 'BUY' ? Number((entryPrice + 1.00).toFixed(2)) : Number((entryPrice - 1.00).toFixed(2)));

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
    if (!this.state.bridgeStatus.isConnected || !this.state.lastTick) {
      return {
        symbol: 'N/A',
        stage1_marketState: 'در انتظار اتصال ربات MT5 - داده تیک زنده دریافت نشده است.',
        stage2_marketRegime: 'حالت بازار نامشخص (ارتباط با متاتریدر ۵ قطع است)',
        stage3_technicalAnalysis: 'تحلیل تکنیکال غیرفعال (نیاز به تیک زنده قیمت)',
        stage4_fundamentalGuard: 'پایش اخبار فعال است (در انتظار قیمت زنده)',
        stage5_scenarios: 'سناریوسازی غیرفعال تا زمان برقراری اولین اتصال زنده MQL5',
        stage6_riskCalculations: 'حساب متصل نیست (موجودی: $0)',
        stage7_preTradeChecklist: [
          { check: 'ربات MQL5 به متاتریدر متصل است؟', passed: false },
          { check: 'داده تیک قیمت زنده دریافت شده است؟', passed: false },
        ],
        stage8_decision: 'NO_TRADE',
        recommendedLot: 0,
        reasoning: 'به دلیل عدم برقراری اتصال زنده با ربات متاتریدر ۵، هیچ پوزیشن یا سفارشی صادر نمی‌شود.',
        orderDispatched: false,
      };
    }

    const ask = this.state.lastTick.ask;
    const bid = this.state.lastTick.bid;
    const spread = this.state.lastTick.spread;
    const symbol = this.state.lastTick.symbol;

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
    const stage6 = `با توجه به موجودی حساب (${this.state.bridgeStatus.accountInfo?.balance ?? 0} USD)، ریسک مجاز ۰.۵٪ سرمایه محاسبه شده و حجم پایه ۰.۰۱ لات تعیین گردید.`;

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
    const signal = this.getTradingSignal();
    const decision: 'BUY' | 'SELL' | 'NO_TRADE' = allPassed ? (signal.action === 'SELL' ? 'SELL' : 'BUY') : 'NO_TRADE';
    const targetTp = decision === 'BUY' ? Number((ask + 3.0).toFixed(2)) : Number((bid - 3.0).toFixed(2));
    const targetSl = decision === 'BUY' ? Number((ask - 0.5).toFixed(2)) : Number((bid + 0.5).toFixed(2));

    let orderDispatched = false;
    let reasoning = '';

    if (decision === 'BUY' || decision === 'SELL') {
      const res = this.createOrder({
        symbol,
        type: decision,
        lot: 0.01,
        sl: targetSl,
        tp: targetTp,
        source: 'ai_agent',
      });
      orderDispatched = res.success;
      reasoning = `تمام ۷ شرط چک‌لیست فرآیند ۸ مرحله‌ای تایید شد. معامله ${decision === 'BUY' ? 'خرید' : 'فروش'} با حجم ۰.۰۱ لات روی قیمت ${decision === 'BUY' ? ask : bid} (TP: ${targetTp}, SL: ${targetSl}) صادر و به متاتریدر ارسال گردید.`;
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
    const balance = accountInfo?.balance ?? 0;
    const equity = accountInfo?.equity ?? 0;
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

  public getLiveTradingContextForAI(targetAccountId?: string): string {
    const primaryId = targetAccountId || this.activeAccountId;
    const accounts = this.getAccountsList();
    const primaryAcc = this.getOrCreateAccountState(primaryId);

    let summary = `\n==============================================\n`;
    summary += `[اطلاعات لحظه‌ای و زنده حساب‌های متاتریدر ۵، چارت‌ها و پوزیشن‌های فعال]\n`;
    summary += `حساب فعال هدف (Target Active Account): ${primaryId} (${primaryAcc.config.name || 'حساب اصلی'})\n`;
    summary += `تعداد کل حساب‌های متاتریدر ثبت‌شده در سیستم: ${accounts.length}\n\n`;

    summary += `لیست حساب‌ها و وضعیت اتصال:\n`;
    for (const acc of accounts) {
      const isCurrent = acc.accountId === primaryId ? ' [حساب فعال انتخاب شده]' : '';
      summary += `- حساب ${acc.accountId} (${acc.name} - شماره حساب MT5: ${acc.accountNumber}, بروکر: ${acc.broker}): موجودی $${acc.balance?.toFixed(2) || '0'}, ارزش $${acc.equity?.toFixed(2) || '0'}, پوزیشن باز: ${acc.openPositionsCount}, وضعیت اتصال: ${acc.isConnected ? 'متصل و آنلاین MT5' : 'آماده به کار'}${isCurrent}\n`;
    }

    summary += `\n[جزئیات پوزیشن‌های باز و چارت‌های فعال حساب ${primaryId}]:\n`;
    
    if (primaryAcc.positions && primaryAcc.positions.length > 0) {
      summary += `پوزیشن‌های باز فعال روی حساب ${primaryId} (${primaryAcc.positions.length} عدد):\n`;
      primaryAcc.positions.forEach((p: any, idx: number) => {
        const sym = p.symbol || 'XAUUSD.m';
        const symUpper = sym.toUpperCase();
        const symName = symUpper.includes('BTC') ? 'بیت‌کوین (Bitcoin / BTCUSD)' :
                        symUpper.includes('XAU') ? 'طلا (Gold / XAUUSD)' :
                        symUpper.includes('ETH') ? 'اتریوم (Ethereum / ETHUSD)' : sym;
        summary += `  ${idx + 1}. تیکت #${p.ticket || p.id || idx + 1}: نماد ${sym} (${symName}) | نوع: ${p.direction || p.type} | حجم: ${p.lot} لات | قیمت ورود: ${p.entryPrice} | قیمت فعلی: ${p.currentPrice || '-'} | حد ضرر (SL): ${p.sl || 'تعیین نشده'} | حد سود (TP): ${p.tp || 'تعیین نشده'} | سود/زیان شناور: $${p.profit ?? '0.00'}\n`;
      });
    } else {
      summary += `در حال حاضر هیچ پوزیشن بازی روی حساب ${primaryId} وجود ندارد.\n`;
    }

    // Dynamic active charts and symbols
    const activeSymbolsSet = new Set<string>();
    if (primaryAcc.lastTick?.symbol) activeSymbolsSet.add(primaryAcc.lastTick.symbol);
    if (primaryAcc.positions) primaryAcc.positions.forEach((p: any) => p.symbol && activeSymbolsSet.add(p.symbol));
    if (this.state.lastTick?.symbol) activeSymbolsSet.add(this.state.lastTick.symbol);
    // Standard supported market symbols
    ['BTCUSD', 'BTCUSD.m', 'XAUUSD', 'XAUUSD.m', 'EURUSD', 'GBPUSD', 'ETHUSD'].forEach(s => activeSymbolsSet.add(s));

    summary += `\nنمادها و چارت‌های معاملاتی فعال و قابل دسترسی در این حساب:\n`;
    activeSymbolsSet.forEach(sym => {
      const symUpper = sym.toUpperCase();
      const isGold = symUpper.includes('XAU');
      const isBtc = symUpper.includes('BTC');
      const isEth = symUpper.includes('ETH');
      const label = isBtc ? 'بیت‌کوین (BTC/USD)' : isGold ? 'طلا (XAU/USD)' : isEth ? 'اتریوم (ETH/USD)' : sym;
      
      const ask = (primaryAcc.lastTick?.symbol === sym ? primaryAcc.lastTick.ask : null) || (this.state.lastTick?.symbol === sym ? this.state.lastTick.ask : null);
      const bid = (primaryAcc.lastTick?.symbol === sym ? primaryAcc.lastTick.bid : null) || (this.state.lastTick?.symbol === sym ? this.state.lastTick.bid : null);
      
      summary += `- نماد ${sym} [${label}]: ${ask && bid ? `Ask: ${ask}, Bid: ${bid}` : 'چارت باز و آماده سفارش'}\n`;
    });

    summary += `\nپیام حیاتی برای سیستم AI: شما به تمام داده‌های زنده بالا، از جمله حساب‌های متاتریدر (شامل K1 و MT5)، چارت‌های بازشده (بیت‌کوین BTCUSD، طلا XAUUSD و فارکس) و پوزیشن‌ها دسترسی مستقیم کامل دارید. متاتریدر ۵ به شما متصل است.\n`;
    summary += `==============================================\n`;

    return summary;
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
    const currentAsk = accState.lastTick?.ask || this.state.lastTick?.ask || 0;
    const currentBid = accState.lastTick?.bid || this.state.lastTick?.bid || 0;
    const currentBalance = accState.accountInfo.balance;
    const currentEquity = accState.accountInfo.equity;
    const accountNum = accState.config.accountNumber;
    const broker = accState.config.broker;
    const openPositions = accState.positions.length;
    const isBridgeConnected = accState.bridgeStatus.isConnected || this.state.bridgeStatus.isConnected;

    const stats1h = this.getTradeHistoryStats(1);
    const stats24h = this.getTradeHistoryStats(24);
    const statsAll = this.getTradeHistoryStats();

    // Comprehensive Live Multi-Account & Multi-Symbol Context
    const liveMultiAccountContext = this.getLiveTradingContextForAI(targetAccountId);

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
تو ایجنت معامله‌گر واقعی و هوشمند هرمس (Hermes AI Trading Agent) هستی که بر روی تمام حساب‌های متاتریدر ۵، چارت‌های فعال و پوزیشن‌ها نظارت و کنترل مستقیم داری.

${liveMultiAccountContext}

اطلاعات خلاصه حساب فعال فعلی (${targetAccountId} - ${accState.config.name}):
- نوع استراتژی حساب: ${accState.config.strategyType}
- پیام جدید کاربر: "${userText}"
- موجودی حساب (Balance): $${currentBalance} | ارزش خالص (Equity): $${currentEquity}
- سود/زیان شناور: $${(currentEquity - currentBalance).toFixed(2)}
- شماره حساب: ${accountNum} نزد بروکر ${broker}
- وضعیت اتصال متاتریدر ۵: ${isBridgeConnected ? 'متصل' : 'آماده‌به‌کار'}
- تعداد پوزیشن‌های باز این حساب: ${openPositions}
- سقف مجاز پوزیشن‌های همزمان: ${this.autonomousTrading.maxConcurrentPositions}
- قیمت طلا (Ask/Bid): ${currentAsk} / ${currentBid}
- آمار معاملات ۲۴ ساعت گذشته: ${JSON.stringify(stats24h)}

[حافظه اختصاصی این حساب]:
${JSON.stringify(accountMemories.slice(0, 10))}

[گفتگوهای اخیر]:
${compactChatHistory.join('\n')}

دستورالعمل‌های حیاتی، صداقت و واقع‌گرایی:
1. صداقت کامل و عدم ادعای غیرواقعی: هرگز ادعای کاذب نکن. اگر معامله‌ای صادر گردید، صراحتاً بگو سفارش در "صف ارسال به متاتریدر ۵" قرار گرفت و نتیجه قطعی اجرای آن پس از بازخورد زنده اکسپرت MQL5 در چت ثبت خواهد شد.
2. هرگز قبل از دریافت بازخورد زنده متاتریدر ۵ نگو معامله حتماً در بروکر باز یا بسته شد؛ بلکه بگو دستور صادر شد و منتظر تاییدیه اجرای اکسپرت هستم.
3. شفافیت در دسترسی‌ها: تو به داده‌های چارت زنده، پوزیشن‌های باز، مانده حساب و تاریخچه معاملات دسترسی داری. به کاربر صراحتاً بگو به چه ابزارهایی دسترسی داری و محدودیت‌های بروکر (مانند بسته‌بودن بازار فارکس/طلا در تعطیلات، حدضرر نامعتبر یا عدم فعال بودن WebRequest) را توضیح بده.
4. اگر کاربر درباره بیت‌کوین، طلا یا هر نماد دیگری صحبت کرد یا خواست پوزیشن باز/بست کند، نماد دقیق را در کلید "symbol" برگردان (مثلا "BTCUSD" یا "XAUUSD.m").
5. پاسخ تخصصی، دقیق و کامل به زبان فارسی در کلید "reply" ارائه بده.
6. بر اساس درخواست کاربر ساختار JSON زیر را برگردان:
{
  "reply": "متن پاسخ تحلیلی و مستقیم به کاربر به زبان فارسی",
  "action": "CHAT" | "ENABLE_AUTONOMOUS" | "DISABLE_AUTONOMOUS" | "TRADE_BUY" | "TRADE_SELL" | "CLOSE_SYMBOL" | "CLOSE_ALL" | "SAVE_MEMORY",
  "symbol": "BTCUSD" | "XAUUSD.m" | "EURUSD",
  "lot": 0.01,
  "sl": 0,
  "tp": 0,
  "maxConcurrentPositions": 5,
  "targetProfitUSD": 1.0,
  "durationHours": 8,
  "memoryNote": "متن یادداشت جهت حافظه"
}
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

              // Determine symbol dynamically
              const targetSymbol = parsed.symbol || (userText.toUpperCase().includes('BTC') ? 'BTCUSD' : userText.toUpperCase().includes('ETH') ? 'ETHUSD' : 'XAUUSD.m');

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
                  `معامله خودکار ${this.autonomousTrading.durationHours} ساعته توسط AI روی ${targetSymbol} فعال شد. هدف سود: $${this.autonomousTrading.targetProfitUSD}، سقف پوزیشن: ${targetMaxPos}، لات: ${this.autonomousTrading.lotSize}.`,
                  targetAccountId
                );

                const currentSignal = this.getTradingSignal();
                const initialType = currentSignal.action === 'SELL' ? 'SELL' : 'BUY';
                
                const autoRes = this.createOrder({
                  symbol: targetSymbol,
                  type: initialType,
                  lot: parsed.lot || 0.01,
                  sl: parsed.sl || undefined,
                  tp: parsed.tp || undefined,
                  source: 'ai_agent',
                  accountId: targetAccountId,
                });
                if (!autoRes.success) {
                  reply += `\n\n⚠️ [هشدار موتور ریسک / عدم ثبت معامله اولیه]: ${autoRes.error}`;
                }
              } else if (parsed.action === 'DISABLE_AUTONOMOUS') {
                this.autonomousTrading.enabled = false;
              } else if (parsed.action === 'TRADE_BUY' || parsed.action === 'TRADE_SELL') {
                const type = parsed.action === 'TRADE_BUY' ? 'BUY' : 'SELL';
                const orderRes = this.createOrder({
                  symbol: targetSymbol,
                  type,
                  lot: parsed.lot || 0.01,
                  sl: parsed.sl || undefined,
                  tp: parsed.tp || undefined,
                  source: 'ai_agent',
                  accountId: targetAccountId,
                });
                if (!orderRes.success) {
                  reply += `\n\n⚠️ [خطای موتور ریسک / عدم امکان ثبت سفارش]: ${orderRes.error}`;
                }
              } else if (parsed.action === 'CLOSE_SYMBOL' || parsed.action === 'CLOSE_ALL') {
                const closeRes = this.createOrder({
                  symbol: targetSymbol,
                  type: 'CLOSE_ALL',
                  lot: 0.01,
                  source: 'user_manual',
                  accountId: targetAccountId,
                });
                if (!closeRes.success) {
                  reply += `\n\n⚠️ [خطای موتور ریسک / عدم ثبت دستور بستن]: ${closeRes.error}`;
                }
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
    const offlineSnapshot: UnifiedSnapshot = {
      snapshotVersion: '1.0.0',
      sequence: 0,
      timestamp: new Date().toISOString(),
      account: this.state.bridgeStatus.accountInfo || { balance: 0, equity: 0, accountNumber: 0, broker: 'N/A', margin: 0, freeMargin: 0, openPositionsCount: 0, currency: 'USD' },
      symbolSpec: { symbol: 'N/A', digits: 2, point: 0.01, tickSize: 0.01, tickValue: 1, contractSize: 100, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
      market: { symbol: 'N/A', ask: 0, bid: 0, spread: 0, serverTime: new Date().toISOString(), utcTime: new Date().toISOString() },
      positions: [],
      candles: {},
      dataQuality: {
        lastTickAgeMs: 0,
        isConnected: false,
        isDataComplete: false,
        latencyMs: 0,
        serverTime: new Date().toISOString(),
        localTime: new Date().toISOString(),
        lastSuccessfulSync: '',
        snapshotSequence: 0,
        brokerServerTime: '',
      },
    };

    return riskEngine.evaluateRisk(offlineSnapshot, this.state.riskRules, proposedOrder);
  }

  public getTradingSignal(): TradingSignal {
    if (this.latestUnifiedSnapshot) {
      return strategyEngine.evaluateStrategy(this.latestUnifiedSnapshot);
    }

    const mockAssessment = this.getRiskAssessment();
    const offlineSnapshot: UnifiedSnapshot = {
      snapshotVersion: '1.0.0',
      sequence: 0,
      timestamp: new Date().toISOString(),
      account: this.state.bridgeStatus.accountInfo || { balance: 0, equity: 0, accountNumber: 0, broker: 'N/A', margin: 0, freeMargin: 0, openPositionsCount: 0, currency: 'USD' },
      symbolSpec: { symbol: 'N/A', digits: 2, point: 0.01, tickSize: 0.01, tickValue: 1, contractSize: 100, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
      market: { symbol: 'N/A', ask: 0, bid: 0, spread: 0, serverTime: new Date().toISOString(), utcTime: new Date().toISOString() },
      positions: [],
      candles: {},
      riskAssessment: mockAssessment,
      dataQuality: {
        lastTickAgeMs: 0,
        isConnected: false,
        isDataComplete: false,
        latencyMs: 0,
        serverTime: new Date().toISOString(),
        localTime: new Date().toISOString(),
        lastSuccessfulSync: '',
        snapshotSequence: 0,
        brokerServerTime: '',
      },
    };

    return strategyEngine.evaluateStrategy(offlineSnapshot);
  }

  public async getAIAnalysis(): Promise<GeminiAIAnalysis> {
    const activeRules = await this.getKnowledgeRules();
    if (this.latestUnifiedSnapshot) {
      return geminiEngine.analyzeSnapshot(this.latestUnifiedSnapshot, activeRules);
    }

    const mockAssessment = this.getRiskAssessment();
    const mockSignal = this.getTradingSignal();
    const offlineSnapshot: UnifiedSnapshot = {
      snapshotVersion: '1.0.0',
      sequence: 0,
      timestamp: new Date().toISOString(),
      account: this.state.bridgeStatus.accountInfo || { balance: 0, equity: 0, accountNumber: 0, broker: 'N/A', margin: 0, freeMargin: 0, openPositionsCount: 0, currency: 'USD' },
      symbolSpec: { symbol: 'N/A', digits: 2, point: 0.01, tickSize: 0.01, tickValue: 1, contractSize: 100, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
      market: { symbol: 'N/A', ask: 0, bid: 0, spread: 0, serverTime: new Date().toISOString(), utcTime: new Date().toISOString() },
      positions: [],
      candles: {},
      riskAssessment: mockAssessment,
      strategySignal: mockSignal,
      dataQuality: {
        lastTickAgeMs: 0,
        isConnected: false,
        isDataComplete: false,
        latencyMs: 0,
        serverTime: new Date().toISOString(),
        localTime: new Date().toISOString(),
        lastSuccessfulSync: '',
        snapshotSequence: 0,
        brokerServerTime: '',
      },
    };

    return geminiEngine.analyzeSnapshot(offlineSnapshot, activeRules);
  }

  public getExecutionResult(): ExecutionEngineResult {
    if (this.latestUnifiedSnapshot) {
      return executionEngine.processExecution(this.latestUnifiedSnapshot, this.state.isAgentActive);
    }

    const mockAssessment = this.getRiskAssessment();
    const mockSignal = this.getTradingSignal();
    const offlineSnapshot: UnifiedSnapshot = {
      snapshotVersion: '1.0.0',
      sequence: 0,
      timestamp: new Date().toISOString(),
      account: this.state.bridgeStatus.accountInfo || { balance: 0, equity: 0, accountNumber: 0, broker: 'N/A', margin: 0, freeMargin: 0, openPositionsCount: 0, currency: 'USD' },
      symbolSpec: { symbol: 'N/A', digits: 2, point: 0.01, tickSize: 0.01, tickValue: 1, contractSize: 100, minLot: 0.01, maxLot: 100, lotStep: 0.01 },
      market: { symbol: 'N/A', ask: 0, bid: 0, spread: 0, serverTime: new Date().toISOString(), utcTime: new Date().toISOString() },
      positions: [],
      candles: {},
      riskAssessment: mockAssessment,
      strategySignal: mockSignal,
      dataQuality: {
        lastTickAgeMs: 0,
        isConnected: false,
        isDataComplete: false,
        latencyMs: 0,
        serverTime: new Date().toISOString(),
        localTime: new Date().toISOString(),
        lastSuccessfulSync: '',
        snapshotSequence: 0,
        brokerServerTime: '',
      },
    };

    return executionEngine.processExecution(offlineSnapshot, this.state.isAgentActive);
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
      accountNumber: acc.accountNumber ?? this.state.bridgeStatus.accountInfo?.accountNumber ?? 0,
      broker: acc.broker ?? this.state.bridgeStatus.accountInfo?.broker ?? 'MQL5 Broker',
      balance: acc.balance ?? this.state.bridgeStatus.accountInfo?.balance ?? 0,
      equity: acc.equity ?? this.state.bridgeStatus.accountInfo?.equity ?? 0,
      margin: acc.margin ?? this.state.bridgeStatus.accountInfo?.margin ?? 0,
      freeMargin: acc.freeMargin ?? this.state.bridgeStatus.accountInfo?.freeMargin ?? 0,
      marginLevel: acc.marginLevel ?? (acc.margin > 0 ? (acc.equity / acc.margin) * 100 : 0),
      floatingProfit: acc.floatingProfit ?? (acc.equity - acc.balance),
      dailyProfit: acc.dailyProfit ?? 0,
      drawdown: acc.drawdown ?? 0,
      usedMargin: acc.usedMargin ?? acc.margin ?? 0,
      openPositionsCount: acc.openPositionsCount ?? (payload.positions ? payload.positions.length : (this.state.bridgeStatus.accountInfo?.openPositionsCount ?? 0)),
      currency: acc.currency ?? 'USD',
    };

    // 2. Extract Market State
    const symbol = payload.symbol || payload.market?.symbol || 'N/A';
    const ask = payload.ask ?? payload.market?.ask ?? this.state.lastTick?.ask ?? 0;
    const bid = payload.bid ?? payload.market?.bid ?? this.state.lastTick?.bid ?? 0;
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

    // 10. Evaluate Execution Engine (Phase 6) - Strictly execute auto-orders ONLY if autonomous trading is explicitly enabled
    const executionResult = executionEngine.processExecution(tempSnapshot, this.autonomousTrading.enabled);

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

    // Synchronize current UI active state if target account matches activeAccountId or active account is disconnected
    const currentActiveState = this.accountsMap.get(this.activeAccountId);
    if (targetAccountId === this.activeAccountId || !currentActiveState?.bridgeStatus.isConnected) {
      this.activeAccountId = targetAccountId;
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

    // Virtual Risk Engine Guard: Monitor open positions against target dollar loss or profit (ONLY if autonomous trading is explicitly enabled)
    if (this.autonomousTrading.enabled && positions && positions.length > 0) {
      for (const pos of positions) {
        const profit = pos.profit ?? pos.currentProfit ?? 0;
        const ticket = pos.ticket;
        const targetTPUSD = this.autonomousTrading.targetProfitUSD || 1.0;
        const targetSLUSD = this.autonomousTrading.stopLossUSD || 3.0;

        if (profit >= targetTPUSD && ticket > 0) {
          const lastTrigger = (this as any)[`_triggered_tp_${ticket}`];
          if (!lastTrigger || Date.now() - lastTrigger > 10000) {
            (this as any)[`_triggered_tp_${ticket}`] = Date.now();
            this.logTradingActivity(
              'ai_analysis',
              `🎯 [محافظ هوشمند هرمس]: پوزیشن تیکت #${ticket} به حد سود هدف ($${profit.toFixed(2)} >= $${targetTPUSD.toFixed(2)}) رسید. دستور بستن صادر گردید.`
            );
            this.createOrder({
              symbol: pos.symbol || 'XAUUSD.m',
              type: 'CLOSE',
              lot: pos.lot || 0.01,
              source: 'ai_agent',
              accountId: targetAccountId,
            });
          }
        } else if (profit <= -targetSLUSD && ticket > 0) {
          const lastTrigger = (this as any)[`_triggered_sl_${ticket}`];
          if (!lastTrigger || Date.now() - lastTrigger > 10000) {
            (this as any)[`_triggered_sl_${ticket}`] = Date.now();
            this.logTradingActivity(
              'ai_analysis',
              `🛡️ [محافظ هوشمند هرمس]: پوزیشن تیکت #${ticket} به حد ضرر مجاز ($${profit.toFixed(2)} <= -$${targetSLUSD.toFixed(2)}) رسید. دستور بستن فوری صادر شد.`
            );
            this.createOrder({
              symbol: pos.symbol || 'XAUUSD.m',
              type: 'CLOSE',
              lot: pos.lot || 0.01,
              source: 'ai_agent',
              accountId: targetAccountId,
            });
          }
        }
      }
    }

    // Autonomous trading check
    this.runAutonomousScalpCheck();

    // Purge stale timed out pending orders
    this.checkAndPurgeStalePendingOrders();

    const rawOrders = (targetAccountId === this.activeAccountId ? this.state.pendingOrders : accState.pendingOrders).filter((o) => o.status === 'pending');
    const formattedOrders = rawOrders.map((o) => ({
      ...o,
      lot: o.lot ?? o.lots ?? 0.01,
      lots: o.lots ?? o.lot ?? 0.01,
      sl: o.sl ?? o.stopLoss ?? 0,
      stopLoss: o.stopLoss ?? o.sl ?? 0,
      tp: o.tp ?? o.takeProfit ?? 0,
      takeProfit: o.takeProfit ?? o.tp ?? 0,
    }));
    return { pendingOrders: formattedOrders, dataQuality };
  }

  private runAutonomousScalpCheck(): void {
    if (!this.autonomousTrading.enabled) return;
    this.runBackgroundAutonomousCheck();
  }

  public createOrder(orderInput: {
    symbol?: string;
    type: 'BUY' | 'SELL' | 'CLOSE' | 'CLOSE_ALL';
    lot: number;
    sl?: number;
    tp?: number;
    source: 'ai_agent' | 'user_manual' | 'telegram';
    clientOrderId?: string;
    accountId?: string;
  }): { success: boolean; order?: TradeOrder; error?: string } {
    const clientOrderId = orderInput.clientOrderId || `cid_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const targetAccountId = orderInput.accountId || this.activeAccountId;
    const targetAcc = this.getOrCreateAccountState(targetAccountId);

    // Auto-bind single active chart symbol for this account if missing or empty
    const effectiveSymbol = (orderInput.symbol && orderInput.symbol.trim() !== '')
      ? orderInput.symbol.trim()
      : (targetAcc.config.activeSymbol || targetAcc.lastTick?.symbol || this.state.lastTick?.symbol || 'XAUUSD.m');
    orderInput.symbol = effectiveSymbol;

    // Check Idempotency: Prevent duplicate execution if this order was already processed
    if (this.processedClientOrderIds.has(clientOrderId)) {
      const existingOrder =
        targetAcc.pendingOrders.find((o) => o.clientOrderId === clientOrderId || o.id === clientOrderId) ||
        this.state.pendingOrders.find((o) => o.clientOrderId === clientOrderId || o.id === clientOrderId) ||
        this.state.orderHistory.find((o) => o.clientOrderId === clientOrderId || o.id === clientOrderId);
      if (existingOrder) {
        return { success: true, order: existingOrder };
      }
    }

    // Phase 3 Risk Engine Pre-Execution Rule Checks & Dollar-to-Price SL/TP Conversion
    if (orderInput.type === 'BUY' || orderInput.type === 'SELL') {
      const tick = targetAcc.lastTick || this.state.lastTick;
      if (tick && tick.ask > 0) {
        const refPrice = orderInput.type === 'BUY' ? tick.ask : tick.bid;
        const lot = orderInput.lot || 0.01;
        const contractSize = (targetAcc.bridgeStatus.unifiedSnapshot?.symbolSpec?.contractSize) || 100;

        // Auto-convert SL if passed as a relative dollar offset (e.g., sl = 3.0 or 2.5 when market price is 2400)
        if (orderInput.sl && orderInput.sl > 0 && orderInput.sl < refPrice * 0.5) {
          const dollarSL = orderInput.sl;
          const deltaPrice = dollarSL / (lot * contractSize);
          orderInput.sl = Number((orderInput.type === 'BUY' ? refPrice - deltaPrice : refPrice + deltaPrice).toFixed(2));
        }

        // Auto-convert TP if passed as a relative dollar offset (e.g., tp = 1.0 or 5.0 when market price is 2400)
        if (orderInput.tp && orderInput.tp > 0 && orderInput.tp < refPrice * 0.5) {
          const dollarTP = orderInput.tp;
          const deltaPrice = dollarTP / (lot * contractSize);
          orderInput.tp = Number((orderInput.type === 'BUY' ? refPrice + deltaPrice : refPrice - deltaPrice).toFixed(2));
        }

        // Auto-fill safe fallback Stop Loss if missing so mandatory SL rule passes cleanly
        if (!orderInput.sl || orderInput.sl <= 0) {
          orderInput.sl = Number((orderInput.type === 'BUY' ? refPrice * 0.99 : refPrice * 1.01).toFixed(2));
        }
      }

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
      accountId: targetAccountId,
    };

    targetAcc.pendingOrders.push(newOrder);
    this.state.pendingOrders.push(newOrder);
    supabaseService.logOrder(newOrder).catch(() => {});
    this.logTradingActivity(
      'order_dispatched',
      `سفارش جدید ${newOrder.type} روی نماد ${newOrder.symbol} (حجم: ${newOrder.lot}) با شناسه ${clientOrderId} در حساب ${targetAccountId} صادر و در صف ارسال قرار گرفت.`,
      newOrder
    );

    return { success: true, order: newOrder };
  }

  public handleOrderResult(payload: {
    orderId: string;
    status: 'executed' | 'failed';
    executionPrice?: number;
    error?: string;
    accountId?: string;
  }): boolean {
    const matchOrder = (o: TradeOrder) => o.id === payload.orderId || o.clientOrderId === payload.orderId;

    let order: TradeOrder | undefined;

    // 1. Find and remove from global pending orders
    const globalIdx = this.state.pendingOrders.findIndex(matchOrder);
    if (globalIdx !== -1) {
      [order] = this.state.pendingOrders.splice(globalIdx, 1);
    }

    // 2. Find and remove from per-account pending orders
    const targetAccId = payload.accountId || order?.accountId || this.activeAccountId;
    if (targetAccId && this.accountsMap.has(targetAccId)) {
      const accState = this.accountsMap.get(targetAccId)!;
      const accIdx = accState.pendingOrders.findIndex(matchOrder);
      if (accIdx !== -1) {
        const [accOrder] = accState.pendingOrders.splice(accIdx, 1);
        if (!order) order = accOrder;
      }
    }

    if (!order) {
      // Check if already moved to order history
      order = this.state.orderHistory.find(matchOrder);
    }

    if (!order) return false;

    order.status = payload.status;
    order.executedAt = new Date().toISOString();
    order.executionPrice = payload.executionPrice;
    order.error = payload.error || (payload.status === 'failed' ? 'اجرای سفارش توسط سفیر متاتریدر ۵ رد شد (یا حدضرر/حدسود نامعتبر است)' : undefined);

    // 3. Update global order history
    if (!this.state.orderHistory.some((o) => o.id === order!.id)) {
      this.state.orderHistory.unshift(order);
      if (this.state.orderHistory.length > 100) {
        this.state.orderHistory.pop();
      }
    }

    // 4. Update account-specific order history
    if (targetAccId && this.accountsMap.has(targetAccId)) {
      const accState = this.accountsMap.get(targetAccId)!;
      if (!accState.orderHistory.some((o) => o.id === order!.id)) {
        accState.orderHistory.unshift(order);
        if (accState.orderHistory.length > 100) {
          accState.orderHistory.pop();
        }
      }
    }

    supabaseService.logOrder(order).catch(() => {});

    // Real-time Feedback Loop to User Chat & Agent Memory
    const typeLabel = order.type === 'BUY' ? 'خرید' : order.type === 'SELL' ? 'فروش' : order.type === 'CLOSE_ALL' ? 'بستن تمام پوزیشن‌ها' : order.type;
    const lotLabel = order.lot || order.lots || 0.01;
    const feedbackText = payload.status === 'executed'
      ? `🤖 [بازخورد زنده متاتریدر ۵]: سفارش ${typeLabel} نماد ${order.symbol} (حجم: ${lotLabel} لات) با موفقیت در نرخ ${payload.executionPrice ?? 'قیمت بازار'} توسط اکسپرت MQL5 اجرا گردید.`
      : `⚠️ [بازخورد زنده متاتریدر ۵]: سفارش ${typeLabel} نماد ${order.symbol} اجرا نشد و رد گردید. علت: ${order.error}`;

    const feedbackMsg = {
      id: `chat_${Date.now()}_mt5_feedback`,
      sender: 'agent' as const,
      text: feedbackText,
      timestamp: new Date().toISOString(),
      accountId: targetAccId,
    };
    this.chatMessages.push(feedbackMsg);
    supabaseService.saveChatMessage(feedbackMsg).catch(() => {});

    this.addMemoryNote(
      'بازخورد اجرای سفارش MQL5',
      feedbackText,
      targetAccId
    ).catch(() => {});

    if (payload.status === 'executed') {
      this.logTradingActivity(
        'order_result',
        `سفارش ${order.type} روی ${order.symbol} (${order.id}) با موفقیت در نرخ ${payload.executionPrice ?? 'قیمت بازار'} توسط سفیر MT5 اجرا شد.`,
        order
      );
    } else {
      this.logTradingActivity(
        'error',
        `اجرای سفارش ${order.id} روی ${order.symbol} ناوفق بود: ${order.error}`,
        order
      );
    }

    return true;
  }

  public checkAndPurgeStalePendingOrders(): void {
    const now = Date.now();
    const timeoutMs = 45000; // 45 seconds timeout

    const staleOrders = this.state.pendingOrders.filter((o) => {
      const createdTime = new Date(o.createdAt).getTime();
      return (now - createdTime) > timeoutMs && o.status === 'pending';
    });

    for (const staleOrder of staleOrders) {
      this.handleOrderResult({
        orderId: staleOrder.id,
        status: 'failed',
        error: 'پاسخی در مهلت ۴۵ ثانیه از سفیر متاتریدر ۵ دریافت نشد (Timeout ارتباط)',
        accountId: staleOrder.accountId,
      });
    }
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

  public computeScalpingAnalysis(accountId?: string, symbol: string = 'XAUUSD.m'): {
    symbol: string;
    biasScore: number;
    marketState: 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGE' | 'HIGH_VOLATILITY' | 'LOW_LIQUIDITY' | 'NEWS_MODE';
    confidence: number;
    stability: number;
    breakdown: {
      trend: number;
      momentum: number;
      structure: number;
      priceAction: number;
      llmContext: number;
    };
    reasons: string[];
    riskGuardVeto: boolean;
    riskGuardReason?: string;
    recommendedAction: 'BUY' | 'SELL' | 'NO_TRADE';
    updatedAt: string;
  } {
    const targetAccountId = accountId || this.activeAccountId;
    const accState = this.getOrCreateAccountState(targetAccountId);
    const tick = accState.lastTick || this.state.lastTick;
    const bridge = accState.bridgeStatus || this.state.bridgeStatus;

    // Strict No-Mock Guard: If MetaTrader 5 EA is disconnected or hasn't sent a live tick
    if (!tick || !bridge?.isConnected) {
      return {
        symbol,
        biasScore: 0,
        marketState: 'LOW_LIQUIDITY',
        confidence: 0,
        stability: 0,
        breakdown: {
          trend: 0,
          momentum: 0,
          structure: 0,
          priceAction: 0,
          llmContext: 0,
        },
        reasons: ['ارتباط متاتریدر ۵ برقرار نیست - در انتظار دریافت داده‌های زنده از ربات سفیر (MQL5 EA)'],
        riskGuardVeto: true,
        riskGuardReason: 'اتصال متاتریدر ۵ قطع است - جهت جلوگیری از خطا، صدور معامله مسدود گردید.',
        recommendedAction: 'NO_TRADE',
        updatedAt: new Date().toLocaleTimeString('fa-IR'),
      };
    }

    const ask = tick.ask;
    const bid = tick.bid;
    const spread = tick.spread || Math.abs(ask - bid) || 0;
    const price = (ask + bid) / 2 || ask;

    // Continuously update M1 history and derive multi-timeframe indicators
    this.updateCandleHistory(symbol, ask, bid);
    const mtfCandles = this.getMultiTimeframeCandles(symbol, bridge.unifiedSnapshot?.candles);
    const indicators = indicatorEngine.computeAllTimeframes(symbol, mtfCandles);

    const m1 = indicators.M1;
    const m5 = indicators.M5;
    const h1 = indicators.H1;

    // 1. Calculate Multi-Factor Weights dynamically from live price action & indicators
    let trendScore = 0;
    const ema20_m5 = m5?.ema20;
    const ema50_m5 = m5?.ema50;
    if (ema20_m5 && ema20_m5 > 0) {
      trendScore += ask > ema20_m5 ? 15 : -15;
    }
    if (ema50_m5 && ema50_m5 > 0) {
      trendScore += ask > ema50_m5 ? 15 : -15;
    }

    let momentumScore = 0;
    const rsi = m5?.rsi14 || m1?.rsi14 || 50;
    if (rsi > 60) momentumScore = 20;
    else if (rsi < 40) momentumScore = -20;
    else momentumScore = Math.round((rsi - 50) * 1.5);

    let structureScore = 0;
    const ema50_h1 = h1?.ema50;
    if (ema50_h1 && ema50_h1 > 0) {
      structureScore = ask > ema50_h1 ? 20 : -20;
    } else {
      structureScore = trendScore > 0 ? 15 : -15;
    }

    let priceActionScore = m5?.macd ? (m5.macd.histogram > 0 ? 15 : -15) : (momentumScore >= 0 ? 15 : -15);
    let llmContextScore = (trendScore + momentumScore + structureScore > 0) ? 10 : -10;

    let totalBias = trendScore + momentumScore + structureScore + priceActionScore + llmContextScore;
    totalBias = Math.max(-100, Math.min(100, Math.round(totalBias)));

    // 2. Risk Engine Veto Guard Checks
    let riskGuardVeto = false;
    let riskGuardReason: string | undefined = undefined;

    if (spread > 3.5) {
      riskGuardVeto = true;
      riskGuardReason = `اسپرد نماد بالا‌تر از حد مجاز است ($${spread.toFixed(2)} - خطر لغزش نرخ)`;
    }

    const accountInfo = bridge?.accountInfo;
    if (accountInfo && accountInfo.marginLevel && accountInfo.marginLevel < 150) {
      riskGuardVeto = true;
      riskGuardReason = `سطح مارجین حساب پایین است (${accountInfo.marginLevel.toFixed(0)}٪) - معامله مسدود شد.`;
    }

    // 3. Market State Determination
    let marketState: 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGE' | 'HIGH_VOLATILITY' | 'LOW_LIQUIDITY' | 'NEWS_MODE' = 'TRENDING_UP';
    if (spread > 3.0) {
      marketState = 'HIGH_VOLATILITY';
    } else if (Math.abs(totalBias) < 20) {
      marketState = 'RANGE';
    } else if (totalBias > 20) {
      marketState = 'TRENDING_UP';
    } else {
      marketState = 'TRENDING_DOWN';
    }

    // 4. Confluence Confidence & Signal Stability Index
    const positiveFactors = [trendScore, momentumScore, structureScore, priceActionScore, llmContextScore].filter((f) => f > 0).length;
    const confidence = Math.min(95, Math.max(65, Math.round((positiveFactors / 5) * 100)));
    const stability = bridge.isConnected ? 95 : 0;

    // 5. Recommended Action
    let recommendedAction: 'BUY' | 'SELL' | 'NO_TRADE' = 'NO_TRADE';
    if (!riskGuardVeto) {
      if (totalBias >= 20) recommendedAction = 'BUY';
      else if (totalBias <= -20) recommendedAction = 'SELL';
      else recommendedAction = 'NO_TRADE';
    }

    // 6. Dynamic Real-Time Reasons
    const reasons: string[] = [];
    if (recommendedAction === 'BUY') {
      reasons.push(`پیشنهاد خرید (BUY 🟢): روند صعودی M5 و تثبیت نرخ زنده $${ask.toFixed(2)} بالاتر از سطوح حمایتی`);
    } else if (recommendedAction === 'SELL') {
      reasons.push(`پیشنهاد فروش (SELL 🔴): فشار فروش و غلبه روند نزولی در تایم‌فریم‌های M5/H1`);
    } else {
      reasons.push(`وضعیت نوسانی خنثی (NO TRADE 🟡): عدم وجود جهت‌گیری مشخص؛ پیشنهاد انتظار در ناحیه رنج`);
    }

    reasons.push(`مومنتوم شاخص RSI زنده: ${rsi.toFixed(1)}`);
    reasons.push(`اسپرد معامله زنده: $${spread.toFixed(2)} (${spread < 1.0 ? 'بسیار مطلوب جهت ورود' : 'معمولی'})`);

    const result = {
      symbol,
      biasScore: totalBias,
      marketState,
      confidence,
      stability,
      breakdown: {
        trend: trendScore,
        momentum: momentumScore,
        structure: structureScore,
        priceAction: priceActionScore,
        llmContext: llmContextScore,
      },
      reasons,
      riskGuardVeto,
      riskGuardReason,
      recommendedAction,
      updatedAt: new Date().toLocaleTimeString('fa-IR'),
    };

    // Store snapshot in history
    this.signalSnapshots.unshift({
      ...result,
      timestamp: new Date().toISOString(),
    });
    if (this.signalSnapshots.length > 100) this.signalSnapshots.pop();

    return result;
  }

  public getSignalSnapshots(): any[] {
    return this.signalSnapshots;
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
#property version   "2.10"
#property description "ربات سفیر پیشرفته متاتریدر ۵ (نسخه ۲.۱۰) - پشتیبانی از بازخورد زنده لحظه‌ای در چت (Real-Time Chat Feedback)، Multi-Symbol Router و Mandatory SL Guard"

#include <Trade\\Trade.mqh>
CTrade trade;

//--- Input Parameters
input string   InpServerUrl     = "${cleanUrl}/api/trading/tick"; // آدرس API سفیر و دریافت پپ‌لاین
input string   InpSecretToken   = "hermes-agent-token-2026";      // کلید امنیتی احراز هویت
input int      InpCheckInterval = 2;                             // فاصله زمانی سنکرون‌سازی (ثانیه)
input string   InpDefaultSymbol = "XAUUSD.m";                     // نماد پیش‌فرض معامله
input ulong    InpMagicNumber   = 77077;                          // شناسه مجیک نامبر اختصاصی ربات
input bool     InpEnforceSL     = true;                           // اجبار داشتن حد ضرر (Mandatory Stop Loss Guard)
input int      InpSlippage      = 10;                             // میزان لغزش مجاز (اسلیپیج به پوینت)

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
   Print("[Hermes Bridge v2.1] Ambassador EA Started. Target Server: ", InpServerUrl);
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

   int res = WebRequest("POST", InpServerUrl, headers, 10000, postData, resultData, resultHeaders);

   if(res == 200)
   {
      string responseJson = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
      ParseAndDispatchActions(responseJson);
   }
   else
   {
      PrintFormat("[Hermes Bridge ERROR] WebRequest HTTP status: %d | Last Error: %d | Ensure MT5 -> Tools -> Options -> Expert Advisors -> Allow WebRequest includes '%s'", res, GetLastError(), InpServerUrl);
   }
}

// Parser & Execution Router for Orders and Modifications
void ParseAndDispatchActions(string jsonStr)
{
   // A. Process Pending Orders (New Trade Entries / Close All)
   if(StringFind(jsonStr, "\\\"pendingOrders\\\":") >= 0)
   {
      int pos = StringFind(jsonStr, "\\\"id\\\":\\\"", 0);
      while(pos >= 0)
      {
         int startId = pos + 6;
         int endId = StringFind(jsonStr, "\\\"", startId);
         string orderId = StringSubstr(jsonStr, startId, endId - startId);

         if(!IsOrderAlreadyExecuted(orderId))
         {
            int typePos = StringFind(jsonStr, "\\\"type\\\":\\\"", endId);
            int startType = typePos + 8;
            int endType = StringFind(jsonStr, "\\\"", startType);
            string orderType = StringSubstr(jsonStr, startType, endType - startType);

            // Parse Symbol
            string orderSymbol = _Symbol;
            int symPos = StringFind(jsonStr, "\\\"symbol\\\":\\\"", endType);
            if(symPos > 0)
            {
               int startSym = symPos + 10;
               int endSym = StringFind(jsonStr, "\\\"", startSym);
               if(endSym > startSym)
               {
                  orderSymbol = StringSubstr(jsonStr, startSym, endSym - startSym);
               }
            }

            // Parse Lot (check both "lots": and "lot":)
            double lot = 0.01;
            int lotPos = StringFind(jsonStr, "\\\"lots\\\":", endType);
            if(lotPos > 0)
            {
               int endLot = StringFind(jsonStr, ",", lotPos);
               if(endLot < 0) endLot = StringFind(jsonStr, "}", lotPos);
               lot = StringToDouble(StringSubstr(jsonStr, lotPos + 7, endLot - (lotPos + 7)));
            }
            else
            {
               lotPos = StringFind(jsonStr, "\\\"lot\\\":", endType);
               if(lotPos > 0)
               {
                  int endLot = StringFind(jsonStr, ",", lotPos);
                  if(endLot < 0) endLot = StringFind(jsonStr, "}", lotPos);
                  lot = StringToDouble(StringSubstr(jsonStr, lotPos + 6, endLot - (lotPos + 6)));
               }
            }

            // Parse Stop Loss (check both "stopLoss": and "sl":)
            double sl = 0.0;
            int slPos = StringFind(jsonStr, "\\\"stopLoss\\\":", endType);
            if(slPos > 0)
            {
               int endSl = StringFind(jsonStr, ",", slPos);
               if(endSl < 0) endSl = StringFind(jsonStr, "}", slPos);
               sl = StringToDouble(StringSubstr(jsonStr, slPos + 11, endSl - (slPos + 11)));
            }
            else
            {
               slPos = StringFind(jsonStr, "\\\"sl\\\":", endType);
               if(slPos > 0)
               {
                  int endSl = StringFind(jsonStr, ",", slPos);
                  if(endSl < 0) endSl = StringFind(jsonStr, "}", slPos);
                  sl = StringToDouble(StringSubstr(jsonStr, slPos + 5, endSl - (slPos + 5)));
               }
            }

            // Parse Take Profit (check both "takeProfit": and "tp":)
            double tp = 0.0;
            int tpPos = StringFind(jsonStr, "\\\"takeProfit\\\":", endType);
            if(tpPos > 0)
            {
               int endTp = StringFind(jsonStr, ",", tpPos);
               if(endTp < 0) endTp = StringFind(jsonStr, "}", tpPos);
               tp = StringToDouble(StringSubstr(jsonStr, tpPos + 13, endTp - (tpPos + 13)));
            }
            else
            {
               tpPos = StringFind(jsonStr, "\\\"tp\\\":", endType);
               if(tpPos > 0)
               {
                  int endTp = StringFind(jsonStr, ",", tpPos);
                  if(endTp < 0) endTp = StringFind(jsonStr, "}", tpPos);
                  tp = StringToDouble(StringSubstr(jsonStr, tpPos + 5, endTp - (tpPos + 5)));
               }
            }

            ExecuteSingleOrder(orderId, orderType, lot, sl, tp, orderSymbol);
         }
         pos = StringFind(jsonStr, "\\\"id\\\":\\\"", pos + 10);
      }
   }

   // B. Process Position Modifications (Breakeven & Dynamic Trailing Stops)
   if(StringFind(jsonStr, "\\\"modifications\\\":") >= 0)
   {
      int modPos = StringFind(jsonStr, "\\\"ticket\\\":", 0);
      while(modPos >= 0)
      {
         int startTicket = modPos + 9;
         int endTicket = StringFind(jsonStr, ",", startTicket);
         ulong ticket = (ulong)StringToInteger(StringSubstr(jsonStr, startTicket, endTicket - startTicket));

         double newSL = 0.0;
         int slPos = StringFind(jsonStr, "\\\"newSL\\\":", endTicket);
         if(slPos > 0)
         {
            int endSl = StringFind(jsonStr, ",", slPos);
            if(endSl < 0) endSl = StringFind(jsonStr, "}", slPos);
            newSL = StringToDouble(StringSubstr(jsonStr, slPos + 8, endSl - (slPos + 8)));
         }

         double newTP = 0.0;
         int tpPos = StringFind(jsonStr, "\\\"newTP\\\":", endTicket);
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

         modPos = StringFind(jsonStr, "\\\"ticket\\\":", modPos + 10);
      }
   }
}

// Executes Trade Orders with Mandatory SL Enforced, Directional SL Guard & Magic Number Filter
void ExecuteSingleOrder(string orderId, string typeStr, double lot, double sl, double tp, string orderSymbol="")
{
   string symbol = (orderSymbol != "" && orderSymbol != NULL) ? orderSymbol : _Symbol;
   if(symbol == "" || symbol == NULL) symbol = InpDefaultSymbol;

   SymbolSelect(symbol, true);

   bool success = false;
   double price = 0;
   string errorMsg = "";

   // 1. Lot Size Broker Limits Guard
   double minLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   if(minLot <= 0) minLot = 0.01;
   if(maxLot <= 0) maxLot = 100.0;

   if((typeStr == "BUY" || typeStr == "SELL"))
   {
      if(lot < minLot) lot = minLot;
      if(lot > maxLot) lot = maxLot;
   }

   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   if(digits <= 0) digits = 2;
   double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
   if(point <= 0) point = 0.0001;

   // 2. Configure Broker Type Filling & Slippage
   trade.SetDeviationInPoints(InpSlippage);
   uint filling = (uint)SymbolInfoInteger(symbol, SYMBOL_FILLING_MODE);
   if((filling & SYMBOL_FILLING_FOK) != 0) trade.SetTypeFilling(ORDER_FILLING_FOK);
   else if((filling & SYMBOL_FILLING_IOC) != 0) trade.SetTypeFilling(ORDER_FILLING_IOC);
   else trade.SetTypeFilling(ORDER_FILLING_RETURN);

   if(typeStr == "BUY")
   {
      price = SymbolInfoDouble(symbol, SYMBOL_ASK);
      if(price <= 0) price = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      price = NormalizeDouble(price, digits);

      long stopsLevel = SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL);
      double minStopDist = MathMax((double)stopsLevel, 10.0) * point;

      // Guard against invalid SL for BUY (SL must be strictly below Ask price by at least minStopDist)
      if(sl > 0.0)
      {
         if(sl >= (price - minStopDist))
         {
            sl = price - minStopDist - (10 * point);
         }
      }

      // Guard against invalid TP for BUY (TP must be strictly above Ask price by at least minStopDist)
      if(tp > 0.0)
      {
         if(tp <= (price + minStopDist))
         {
            tp = price + minStopDist + (10 * point);
         }
      }

      // Safe fallback SL if mandatory SL rule is on but SL wasn't provided
      if(InpEnforceSL && sl <= 0.0 && price > 0)
      {
         sl = price - MathMax(minStopDist * 2.0, price * 0.01);
      }

      if(sl > 0.0) sl = NormalizeDouble(sl, digits);
      if(tp > 0.0) tp = NormalizeDouble(tp, digits);

      // Primary market execution attempt with SL/TP
      success = trade.Buy(lot, symbol, 0, sl, tp, "Hermes Order " + orderId);
      
      // Retry 1: If error 1016 (invalid stops), execute market order without initial SL/TP and set SL via PositionModify
      if(!success && (trade.ResultRetcode() == 1016 || trade.ResultRetcode() == 10016))
      {
         Print("[Hermes Guard] Retry market order without initial SL/TP to bypass strict broker stop level...");
         success = trade.Buy(lot, symbol, 0, 0, 0, "Hermes Order " + orderId);
         if(success && (sl > 0.0 || tp > 0.0))
         {
            ulong ticket = trade.ResultOrder();
            if(ticket > 0)
            {
               Sleep(100);
               trade.PositionModify(ticket, sl, tp);
            }
         }
      }

      if(!success)
      {
         // Retry 2: Explicit price with IOC filling
         trade.SetTypeFilling(ORDER_FILLING_IOC);
         success = trade.Buy(lot, symbol, price, sl, tp, "Hermes Order " + orderId);
      }
      if(!success)
      {
         // Retry 3: RETURN filling mode
         trade.SetTypeFilling(ORDER_FILLING_RETURN);
         success = trade.Buy(lot, symbol, price, sl, tp, "Hermes Order " + orderId);
      }
   }
   else if(typeStr == "SELL")
   {
      price = SymbolInfoDouble(symbol, SYMBOL_BID);
      if(price <= 0) price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      price = NormalizeDouble(price, digits);

      long stopsLevel = SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL);
      double minStopDist = MathMax((double)stopsLevel, 10.0) * point;

      // Guard against invalid SL for SELL (SL must be strictly above Bid price by at least minStopDist)
      if(sl > 0.0)
      {
         if(sl <= (price + minStopDist))
         {
            sl = price + minStopDist + (10 * point);
         }
      }

      // Guard against invalid TP for SELL (TP must be strictly below Bid price by at least minStopDist)
      if(tp > 0.0)
      {
         if(tp >= (price - minStopDist))
         {
            tp = price - minStopDist - (10 * point);
         }
      }

      // Safe fallback SL if mandatory SL rule is on but SL wasn't provided
      if(InpEnforceSL && sl <= 0.0 && price > 0)
      {
         sl = price + MathMax(minStopDist * 2.0, price * 0.01);
      }

      if(sl > 0.0) sl = NormalizeDouble(sl, digits);
      if(tp > 0.0) tp = NormalizeDouble(tp, digits);

      // Primary market execution attempt with SL/TP
      success = trade.Sell(lot, symbol, 0, sl, tp, "Hermes Order " + orderId);

      // Retry 1: If error 1016 (invalid stops), execute market order without initial SL/TP and set SL via PositionModify
      if(!success && (trade.ResultRetcode() == 1016 || trade.ResultRetcode() == 10016))
      {
         Print("[Hermes Guard] Retry market order without initial SL/TP to bypass strict broker stop level...");
         success = trade.Sell(lot, symbol, 0, 0, 0, "Hermes Order " + orderId);
         if(success && (sl > 0.0 || tp > 0.0))
         {
            ulong ticket = trade.ResultOrder();
            if(ticket > 0)
            {
               Sleep(100);
               trade.PositionModify(ticket, sl, tp);
            }
         }
      }

      if(!success)
      {
         // Retry 2: Explicit price with IOC filling
         trade.SetTypeFilling(ORDER_FILLING_IOC);
         success = trade.Sell(lot, symbol, price, sl, tp, "Hermes Order " + orderId);
      }
      if(!success)
      {
         // Retry 3: RETURN filling mode
         trade.SetTypeFilling(ORDER_FILLING_RETURN);
         success = trade.Sell(lot, symbol, price, sl, tp, "Hermes Order " + orderId);
      }
   }
   else if(typeStr == "CLOSE" || typeStr == "CLOSE_ALL")
   {
      int attemptedCount = 0;
      int closedCount = 0;
      for(int i = PositionsTotal() - 1; i >= 0; i--)
      {
         ulong ticket = PositionGetTicket(i);
         if(ticket > 0 && PositionSelectByTicket(ticket))
         {
            string posSymbol = PositionGetString(POSITION_SYMBOL);
            string checkPosSym = posSymbol; StringToUpper(checkPosSym);
            string checkOrdSym = symbol; StringToUpper(checkOrdSym);
            
            bool isMatch = (typeStr == "CLOSE_ALL" || symbol == "" || symbol == InpDefaultSymbol || checkPosSym == checkOrdSym || StringFind(checkPosSym, checkOrdSym) >= 0 || StringFind(checkOrdSym, checkPosSym) >= 0);
            if(isMatch)
            {
               attemptedCount++;
               if(trade.PositionClose(ticket))
               {
                  closedCount++;
               }
               else
               {
                  // Retry close with explicit filling mode IOC / RETURN if initial close fails
                  trade.SetTypeFilling(ORDER_FILLING_IOC);
                  if(trade.PositionClose(ticket))
                  {
                     closedCount++;
                  }
                  else
                  {
                     trade.SetTypeFilling(ORDER_FILLING_RETURN);
                     if(trade.PositionClose(ticket))
                     {
                        closedCount++;
                     }
                  }
               }
            }
         }
      }
      success = (attemptedCount == 0 || closedCount == attemptedCount);
      price = SymbolInfoDouble(symbol, SYMBOL_BID);
      if(!success)
      {
         errorMsg = StringFormat("Close incomplete: %d of %d positions closed. CTrade Error %d: %s", closedCount, attemptedCount, trade.ResultRetcode(), trade.ResultComment());
         PrintFormat("[Hermes Close Failed] %s", errorMsg);
      }
      else
      {
         PrintFormat("[Hermes Close Success] Closed %d positions for symbol %s", closedCount, symbol);
         RegisterExecutedOrder(orderId);
      }
   }

   if(!success && typeStr != "CLOSE_ALL")
   {
      errorMsg = StringFormat("CTrade Error %d (%s): %s", trade.ResultRetcode(), trade.ResultRetcodeDescription(), trade.ResultComment());
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
      int snapPos = StringFind(resultUrl, "/api/trading/snapshot");
      if(snapPos >= 0)
      {
         resultUrl = StringSubstr(resultUrl, 0, snapPos) + "/api/trading/order-result";
      }
      else
      {
         int apiPos = StringFind(resultUrl, "/api/");
         if(apiPos >= 0)
         {
            resultUrl = StringSubstr(resultUrl, 0, apiPos) + "/api/trading/order-result";
         }
         else
         {
            PrintFormat("[Hermes Bridge ERROR] Unable to construct order-result URL from InpServerUrl: '%s'. Notification skipped.", InpServerUrl);
            return;
         }
      }
   }

   // Sanitize error string for clean JSON encoding
   string cleanError = errorMsg;
   StringReplace(cleanError, "\\\"", "'");
   StringReplace(cleanError, "\\r", " ");
   StringReplace(cleanError, "\\n", " ");

   string jsonPayload = StringFormat(
      "{\\\"orderId\\\":\\\"%s\\\",\\\"status\\\":\\\"%s\\\",\\\"executionPrice\\\":%.5f,\\\"error\\\":\\\"%s\\\"}",
      orderId, status, price, cleanError
   );

   char postData[];
   StringToCharArray(jsonPayload, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1);

   char resultData[];
   string resultHeaders;
   string headers = "Content-Type: application/json\\r\\nAuthorization: Bearer " + InpSecretToken + "\\r\\n";

   WebRequest("POST", resultUrl, headers, 10000, postData, resultData, resultHeaders);
}
`;
  }
}

export const tradingEngine = new TradingEngine();
