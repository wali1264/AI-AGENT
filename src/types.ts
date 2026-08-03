export type ProviderType = 'google' | 'openai' | 'anthropic' | 'local';

export type RouterStrategy = 'round-robin' | 'failover' | 'priority';

export interface ModelConfig {
  id: string;
  name: string;
  provider: ProviderType;
  description: string;
  isEnabled: boolean;
  isDefault: boolean;
  priorityRank: number; // 1 = highest priority
  maxOutputTokens: number;
  temperature: number;
  thinkingLevel?: 'HIGH' | 'LOW' | 'MINIMAL';
  supportsStreaming: boolean;
  category?: 'chat' | 'image' | 'embedding';
  capabilities?: ('chat' | 'vision' | 'tools' | 'image-gen')[];
}

export interface RouterSettings {
  strategy: RouterStrategy;
  maxRetries: number;
  timeoutMs: number;
  cooldownMinutes: number;
  defaultModelId: string;
  fallbackChain: string[]; // List of model IDs in order of preference
}

export interface AgentProfile {
  id: string;
  name: string;
  roleTitle: string;
  description: string;
  systemPrompt: string;
  defaultModelId?: string; // Optional model override
  apiKeyToken: string; // Bearer token for client request authentication
  isEnabled: boolean;
  createdAt: string;
  requestCount: number;
}

export interface RequestLog {
  id: string;
  timestamp: string; // ISO String
  agentId: string;
  agentName: string;
  requestedModel: string;
  actualModel: string;
  provider: ProviderType;
  keyIndex: number;
  status: 'success' | 'error' | 'fallback_success';
  statusCode: number;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  errorDetails?: string;
  userPromptSnippet: string;
  responseSnippet: string;
  attempts: number;
}

export interface KeyPoolItem {
  keyIndex: number;
  provider: ProviderType;
  envVarName: string;
  maskedKey: string;
  status: 'active' | 'cooldown' | 'exhausted' | 'missing';
  cooldownUntil?: string; // ISO String
  lastUsed?: string;
  successCount: number;
  errorCount: number;
}

export interface SystemStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  fallbackRequests: number;
  avgLatencyMs: number;
  totalTokensUsed: number;
  activeKeysCount: number;
  activeModelsCount: number;
  uptimeSeconds: number;
}

export interface ServerState {
  models: ModelConfig[];
  settings: RouterSettings;
  agents: AgentProfile[];
  keyPool: KeyPoolItem[];
  logs: RequestLog[];
  stats: SystemStats;
  authRequired: boolean;
  tradingState?: TradingState;
}

export interface TradeOrder {
  id: string;
  clientOrderId?: string;
  symbol: string;
  type: 'BUY' | 'SELL' | 'CLOSE' | 'CLOSE_ALL';
  lot: number;
  sl?: number;
  tp?: number;
  status: 'pending' | 'executed' | 'failed' | 'cancelled';
  createdAt: string;
  executedAt?: string;
  executionPrice?: number;
  error?: string;
  source: 'ai_agent' | 'user_manual' | 'telegram';
  accountId?: string;
}

export interface TickData {
  symbol: string;
  ask: number;
  bid: number;
  spread: number;
  timestamp: string;
}

export interface OHLCVBar {
  time: number; // UNIX timestamp (sec) or ISO
  timeISO?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  tickVolume: number;
}

export type TimeframeType = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'D1';

export type TimeframeOHLCV = {
  [key in TimeframeType]?: OHLCVBar[];
};

export interface SymbolSpecification {
  symbol: string;
  digits: number;
  point: number;
  tickSize: number;
  tickValue: number;
  contractSize: number;
  minLot: number;
  maxLot: number;
  lotStep: number;
}

export interface PositionInfo {
  ticket: number;
  symbol: string;
  direction: 'BUY' | 'SELL';
  lot: number;
  entryPrice: number;
  sl: number;
  tp: number;
  currentProfit: number;
  swap: number;
  commission: number;
  magicNumber: number;
  openTime: string;
}

export interface ExtendedAccountInfo {
  accountNumber?: number;
  broker?: string;
  balance?: number;
  equity?: number;
  margin?: number;
  freeMargin?: number;
  marginLevel?: number;
  floatingProfit?: number;
  dailyProfit?: number;
  drawdown?: number;
  usedMargin?: number;
  openPositionsCount?: number;
  currency?: string;
}

export interface MarketState {
  symbol: string;
  ask: number;
  bid: number;
  spread: number;
  serverTime: string;
  utcTime: string;
  tradingSession?: string;
  marketOpenStatus?: boolean;
}

export interface DataQualityMetrics {
  lastTickAgeMs: number;
  isConnected: boolean;
  isDataComplete: boolean;
  latencyMs: number;
  serverTime: string;
  localTime: string;
  lastSuccessfulSync: string;
  snapshotSequence: number;
  brokerServerTime: string;
  missingFields?: string[];
}

export interface ADXResult {
  adx: number;
  plusDI: number;
  minusDI: number;
}

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
}

export interface BollingerBandsResult {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
}

export interface IndicatorValues {
  ema20: number;
  ema50: number;
  ema100: number;
  ema200: number;
  rsi14: number;
  atr14: number;
  adx14: ADXResult;
  macd: MACDResult;
  bollingerBands: BollingerBandsResult;
  trendSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  calculatedAt: string;
}

export type MultiTimeframeIndicators = {
  [key in TimeframeType]?: IndicatorValues;
};

export interface RiskFailedRule {
  ruleId: string;
  name: string;
  reason: string;
  threshold?: number | string;
  actual?: number | string;
}

export interface RiskAssessmentResult {
  isAllowed: boolean;
  riskScore: number; // 0 (Extremely Low Risk) to 100 (Extreme Risk / Unsafe)
  passedRules: string[];
  failedRules: RiskFailedRule[];
  maxAllowedLot: number;
  recommendation: 'PROCEED' | 'REJECT' | 'REDUCE_SIZE';
  evaluatedAt: string;
}

export interface TradingSignal {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  timeframe: TimeframeType;
  entryPrice: number;
  sl: number;
  tp: number;
  lot: number;
  confidenceScore: number; // 0 to 100%
  riskRewardRatio: number;
  confluenceReasons: string[];
  htfTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  ltfSetup: 'OVERBOUGHT' | 'OVERSOLD' | 'BREAKOUT' | 'RANGING' | 'NEUTRAL';
  aiReasoning?: string;
  generatedAt: string;
}

export interface GeminiAIAnalysis {
  decision: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE_ALL';
  confidence: number; // 0 to 100%
  marketBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  persianAnalysis: string;
  englishAnalysis: string;
  keyObservations: string[];
  suggestedAction: string;
  evaluatedAt: string;
  modelUsed: string;
}

export interface PositionModificationRequest {
  ticket: number;
  symbol: string;
  action: 'UPDATE_SL_TP' | 'BREAKEVEN' | 'PARTIAL_CLOSE' | 'CLOSE';
  newSL?: number;
  newTP?: number;
  closeLot?: number;
  reason: string;
}

export interface TrailingStopConfig {
  enableBreakeven: boolean;
  breakevenProfitDistance: number; // Points or price distance (e.g., 1.50 for Gold)
  enableTrailingStop: boolean;
  trailingStep: number; // Distance behind price (e.g., 1.20 for Gold)
  minTrailActivationProfit: number; // Minimum profit before trailing starts
}

export interface ExecutionEngineResult {
  actionExecuted: boolean;
  ordersToDispatch: TradeOrder[];
  modificationsToDispatch: PositionModificationRequest[];
  executionSummaryPersian: string;
  logs: string[];
  timestamp: string;
}

export interface TelemetryRecord {
  id: string;
  timestamp: string;
  sequenceNumber: number;
  latencyMs: number;
  riskScore: number;
  riskAllowed: boolean;
  strategySignalAction: string;
  confidenceScore: number;
  aiDecision: string;
  ordersDispatchedCount: number;
  modificationsCount: number;
  persianNotificationText: string;
  englishNotificationText: string;
  status: 'OPTIMAL' | 'WARNING' | 'ALERT' | 'CRITICAL';
}

export interface NotificationPayload {
  title: string;
  persianMessage: string;
  englishMessage: string;
  level: 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS';
  timestamp: string;
  meta?: Record<string, unknown>;
}

export interface UnifiedSnapshot {
  snapshotVersion: string; // e.g., '1.0.0'
  sequence: number;
  timestamp: string;
  account: ExtendedAccountInfo;
  symbolSpec: SymbolSpecification;
  market: MarketState;
  positions: PositionInfo[];
  candles: TimeframeOHLCV;
  indicators?: MultiTimeframeIndicators;
  riskAssessment?: RiskAssessmentResult;
  strategySignal?: TradingSignal;
  aiAnalysis?: GeminiAIAnalysis;
  executionResult?: ExecutionEngineResult;
  telemetryRecord?: TelemetryRecord;
  dataQuality: DataQualityMetrics;
}

export interface EABridgeStatus {
  isConnected: boolean;
  lastHeartbeat: string | null;
  latencyMs: number;
  accountInfo?: ExtendedAccountInfo;
  dataQuality?: DataQualityMetrics;
  riskAssessment?: RiskAssessmentResult;
  strategySignal?: TradingSignal;
  aiAnalysis?: GeminiAIAnalysis;
  executionResult?: ExecutionEngineResult;
  telemetryRecord?: TelemetryRecord;
  unifiedSnapshot?: UnifiedSnapshot | null;
  initialSyncCompleted?: boolean;
}

export interface RiskRule {
  id: string;
  accountId?: string;
  name: string;
  description: string;
  isEnabled: boolean;
  value: number | string;
  unit: 'percentage' | 'usd' | 'lot' | 'boolean' | 'hours';
}

export interface TradeJournalEntry {
  id: string;
  accountId: string;
  accountNumber?: number;
  symbol: string;
  timeframe: string;
  timestamp: string;
  
  // Market Snapshot & Technical Context
  ask: number;
  bid: number;
  spread: number;
  candlesSummary?: {
    lastClose: number;
    trend: string;
  };
  indicatorsSnapshot?: Record<string, any>;
  
  // AI Decision & Reasoning
  decision: 'BUY' | 'SELL' | 'HOLD' | 'CLOSE_ALL';
  confidence: number; // 0 to 100
  persianAnalysis?: string;
  englishAnalysis?: string;
  confluenceReasons?: string[];
  
  // Order Parameters & Outcome
  orderType?: 'BUY' | 'SELL' | 'CLOSE';
  lot?: number;
  entryPrice?: number;
  sl?: number;
  tp?: number;
  exitPrice?: number;
  exitTime?: string;
  pnlUsd?: number;
  pnlPoints?: number;
  status: 'PROPOSED' | 'EXECUTED' | 'ACTIVE' | 'CLOSED' | 'CANCELLED' | 'FAILED';
  executionError?: string;
  
  // Strategy & Risk
  strategyName?: string;
  riskScore?: number;
  newsFilterPassed?: boolean;
}

export interface MultiAccountConfig {
  accountId: string; // e.g. "MT5_1082391" or "account_default"
  accountNumber: number;
  broker: string;
  name: string; // e.g. "طلا - موج سواری", "بیتکوین - سوئینگ"
  strategyType: 'SURFING' | 'INTRADAY' | 'SWING' | 'SCALPING' | 'CUSTOM';
  isEnabled: boolean;
  assignedAgentName: string;
  riskRules: RiskRule[];
  trailingStopConfig: TrailingStopConfig;
  createdAt: string;
  lastActiveAt?: string;
}

export interface AgentKnowledgeRule {
  id: string;
  ruleCode: string;
  title: string;
  descriptionPersian: string;
  sampleSize: number;
  winRateImpact: number;
  confidenceScore: number;
  category: 'SPREAD' | 'CONFIDENCE' | 'NEWS' | 'TIMEFRAME' | 'DRAWDOWN' | 'GENERAL';
  isEnabled: boolean;
  createdAt: string;
  updatedAt?: string;
  accountId?: string;
}

export interface MultiAccountState {
  config: MultiAccountConfig;
  accountInfo: ExtendedAccountInfo;
  positions: PositionInfo[];
  pendingOrders: TradeOrder[];
  orderHistory: TradeOrder[];
  tradingLogs: AgentTradingLog[];
  bridgeStatus: EABridgeStatus;
  lastTick: TickData | null;
  unifiedSnapshot?: UnifiedSnapshot | null;
  journalEntries: TradeJournalEntry[];
  memory: { id: string; category: string; content: string; createdAt: string; accountId?: string }[];
  knowledgeRules?: AgentKnowledgeRule[];
}

export interface AgentTradingLog {
  id: string;
  timestamp: string;
  type: 'tick_received' | 'signal_generated' | 'rule_check' | 'order_dispatched' | 'order_result' | 'error' | 'ai_analysis';
  message: string;
  data?: any;
}

export interface TradingState {
  bridgeStatus: EABridgeStatus;
  lastTick: TickData | null;
  pendingOrders: TradeOrder[];
  orderHistory: TradeOrder[];
  riskRules: RiskRule[];
  tradingLogs: AgentTradingLog[];
  isAgentActive: boolean;
  telegramConnected: boolean;
}

export interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAiToolDefinition {
  type?: 'function';
  function?: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
  name?: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'function';
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: OpenAiToolCall[];
}

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: OpenAiToolDefinition[];
  tool_choice?: unknown;
}

export interface ChatCompletionResponseChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string;
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionResponseChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  hermes_meta?: {
    provider: ProviderType;
    requested_model: string;
    actual_model: string;
    key_index: number;
    attempts: number;
    latency_ms: number;
    agent_id: string;
  };
}

export type CopilotMode = 'COPILOT_ANALYST' | 'AUTO_PILOT' | 'ADVISOR' | 'BACKTEST';
export type TradingStyle = 'SCALPING' | 'DAY_TRADING' | 'SWING' | 'CUSTOM';

export interface CopilotConfig {
  accountId: string;
  mode: CopilotMode;
  style: TradingStyle;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskPercentPerTrade: number;
  maxDailyDrawdownPercent: number;
  maxTradesPerDay: number;
  minRiskRewardRatio: number;
  autoSlTpMode: 'AUTO_AI' | 'MANUAL_GUIDELINE';
  preferredSymbols: string[];
  expirationSeconds: number; // e.g. 30
  autoExecuteOnHighConfidence: boolean;
  minAutoExecuteConfidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface TradeOpportunity {
  id: string;
  accountId: string;
  symbol: string;
  direction: 'BUY' | 'SELL' | 'WAIT';
  confidence: number; // 0 - 100
  winRate: number; // e.g. 82
  entryZone: { min: number; max: number };
  suggestedEntry: number;
  stopLoss: number;
  takeProfit: number;
  lotSize: number;
  riskRewardRatio: string; // e.g. "1:2.2"
  estimatedProfitUsd: number;
  estimatedRiskUsd: number;
  style: TradingStyle;
  timeframe: TimeframeType;
  timestamp: string;
  expiresAt: string; // ISO String
  durationSeconds: number;
  status: 'ACTIVE' | 'EXPIRED' | 'EXECUTED' | 'REJECTED';
  reasons: {
    trend: string;
    structure: string;
    indicators: string;
    risk: string;
  };
  fullAnalysisText: string;
  executedAt?: string;
  executionPrice?: number;
}

export interface MarketScannerItem {
  symbol: string;
  nameFa: string;
  price: number;
  change24h: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  trendFa: string;
  strengthScore: number; // 0 - 100
  volatility: 'LOW' | 'MEDIUM' | 'HIGH';
  volatilityFa: string;
  bestOpportunitySignal?: 'BUY' | 'SELL' | 'WAIT';
  confidence?: number;
  lastUpdate: string;
}

