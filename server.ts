import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { routerEngine } from './src/backend/routerEngine.js';
import { store } from './src/backend/store.js';
import { tradingEngine } from './src/backend/tradingEngine.js';

let currentFilePath = process.cwd();
try {
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    currentFilePath = fileURLToPath(import.meta.url);
  }
} catch {
  // Fallback
}
const __dirname = path.dirname(currentFilePath);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body parser
  app.use(express.json({ limit: '10mb' }));

  // CORS & UTF-8 Middleware
  app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Agent-ID');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Healthcheck endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    const state = store.getState();
    res.json({
      status: 'ok',
      service: 'Hermes Cloud Router',
      uptimeSeconds: state.stats.uptimeSeconds,
      activeKeys: state.stats.activeKeysCount,
      activeModels: state.stats.activeModelsCount,
      timestamp: new Date().toISOString(),
    });
  });

  // OpenAI-Compatible Models Endpoint
  app.get('/api/v1/models', (req: Request, res: Response) => {
    const state = store.getState();
    const modelsList = state.models
      .filter((m) => m.isEnabled)
      .map((m) => ({
        id: m.id,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: m.provider,
        permission: [],
        root: m.id,
        parent: null,
      }));

    res.json({
      object: 'list',
      data: modelsList,
    });
  });

  // Main OpenAI-Compatible Chat Completions Gateway for Hermes Agent
  app.post('/api/v1/chat/completions', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const agentIdHeader = req.headers['x-agent-id'] as string | undefined;

      // Resolve Agent Profile
      const agentProfile = routerEngine.resolveAgent(authHeader, agentIdHeader);

      // Verify Admin / Agent Token if auth is strictly configured
      if (process.env.ADMIN_SECRET) {
        const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
        const validTokens = [
          process.env.ADMIN_SECRET,
          process.env.HERMES_API_KEY,
          ...store.getState().agents.map((a) => a.apiKeyToken),
        ];

        if (token && !validTokens.includes(token)) {
          res.status(401).json({
            error: {
              message: 'Invalid Authentication Token for Hermes Gateway',
              type: 'invalid_request_error',
              code: 'unauthorized',
            },
          });
          return;
        }
      }

      // Execute Smart Routing (passes res to handle stream: true if requested)
      const routeResult = await routerEngine.handleChatCompletion(req.body, agentProfile, res);

      if (routeResult.error) {
        if (!res.headersSent) {
          res.status(routeResult.error.statusCode).json({
            error: {
              message: routeResult.error.message,
              type: 'router_error',
              details: routeResult.error.details,
              hermes_meta: routeResult.hermesMeta,
            },
          });
        }
        return;
      }

      if (!routeResult.isStreamed && routeResult.response && !res.headersSent) {
        res.json(routeResult.response);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Internal Server Error';
      console.error('[Hermes Router Endpoint Error]:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: {
            message: errMsg,
            type: 'internal_server_error',
          },
        });
      }
    }
  });

  // Admin API: Get State
  app.get('/api/admin/state', (req: Request, res: Response) => {
    res.json(store.getState());
  });

  // Trading Agent API: Get State
  app.get('/api/trading/state', (req: Request, res: Response) => {
    res.json(tradingEngine.getState());
  });

  // Trading Agent API: Get Technical Indicators (Phase 2 Indicator Engine)
  app.get('/api/trading/indicators', (req: Request, res: Response) => {
    const timeframe = req.query.tf as any;
    const indicators = tradingEngine.getIndicators(timeframe);
    res.json({ status: 'ok', timeframe: timeframe || 'ALL', indicators });
  });

  // Trading Agent API: Get Risk Assessment & Pre-Execution Rule Engine Status (Phase 3 Risk Engine)
  app.all('/api/trading/risk', (req: Request, res: Response) => {
    const proposedOrder = req.body && Object.keys(req.body).length > 0 ? req.body : undefined;
    const riskAssessment = tradingEngine.getRiskAssessment(proposedOrder);
    res.json({ status: 'ok', riskAssessment });
  });

  // Trading Agent API: Dynamic Risk Engine Customization & Personalization
  app.get('/api/trading/risk-rules', (req: Request, res: Response) => {
    res.json({ status: 'ok', rules: tradingEngine.getRiskRules() });
  });

  app.get('/api/trading/rules', (req: Request, res: Response) => {
    res.json({ status: 'ok', rules: tradingEngine.getRiskRules() });
  });

  app.post('/api/trading/risk-rules', (req: Request, res: Response) => {
    const { rules } = req.body || {};
    if (!Array.isArray(rules)) {
      res.status(400).json({ error: 'آرایه قوانین ریسک (rules) ارسالی نامعتبر است.' });
      return;
    }
    const updated = tradingEngine.updateRiskRules(rules);
    res.json({ status: 'ok', rules: updated });
  });

  app.post('/api/trading/rules', (req: Request, res: Response) => {
    const { rules } = req.body || {};
    if (!Array.isArray(rules)) {
      res.status(400).json({ error: 'آرایه قوانین ریسک (rules) ارسالی نامعتبر است.' });
      return;
    }
    const updated = tradingEngine.updateRiskRules(rules);
    res.json({ status: 'ok', rules: updated });
  });

  // Trading Agent API: Get Multi-Timeframe Strategy Signals (Phase 4 Strategy Engine)
  app.get('/api/trading/signals', (req: Request, res: Response) => {
    const signal = tradingEngine.getTradingSignal();
    res.json({ status: 'ok', signal });
  });

  // Trading Agent API: Get Gemini AI Analysis & Reasoning (Phase 5 Gemini AI Engine)
  app.all('/api/trading/ai-analysis', async (req: Request, res: Response) => {
    try {
      const aiAnalysis = await tradingEngine.getAIAnalysis();
      res.json({ status: 'ok', aiAnalysis });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Trading Agent API: Automated Execution & Order Routing Engine (Phase 6 Execution Engine)
  app.all('/api/trading/execution', (req: Request, res: Response) => {
    try {
      const executionResult = tradingEngine.getExecutionResult();
      res.json({ status: 'ok', executionResult });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Trading Agent API: Real-Time Telemetry & Audit Trail Dispatcher (Phase 7 Telemetry Engine)
  app.all('/api/trading/telemetry', (req: Request, res: Response) => {
    try {
      const records = tradingEngine.getRecentTelemetry();
      res.json({
        status: 'ok',
        count: records.length,
        telemetry: records,
        latestRecord: records[0] || null,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Phase 2: Multi-Account Management API Endpoints
  app.get('/api/multi-accounts', (req: Request, res: Response) => {
    try {
      const accounts = tradingEngine.getAccountsList();
      const activeAccountId = tradingEngine.getActiveAccountId();
      res.json({ status: 'ok', activeAccountId, accounts });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Get Live Symbols received from connected MT5 EA
  app.get('/api/trading/symbols', (req: Request, res: Response) => {
    try {
      const accountId = (req.query.accountId as string) || undefined;
      const symbols = tradingEngine.getLiveSymbolsList(accountId);
      res.json({ status: 'ok', symbols });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  app.post('/api/multi-accounts', (req: Request, res: Response) => {
    try {
      const { accountId, accountNumber, broker, name, strategyType } = req.body || {};
      if (!accountId) {
        res.status(400).json({ error: 'شناسه حساب (accountId) الزامی است.' });
        return;
      }
      const state = tradingEngine.getOrCreateAccountState(accountId, accountNumber, broker, name, strategyType);
      res.json({ status: 'ok', account: state.config });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  app.post('/api/multi-accounts/select', (req: Request, res: Response) => {
    try {
      const { accountId } = req.body || {};
      if (!accountId) {
        res.status(400).json({ error: 'شناسه حساب (accountId) الزامی است.' });
        return;
      }
      tradingEngine.switchActiveAccount(accountId);
      res.json({ status: 'ok', activeAccountId: tradingEngine.getActiveAccountId() });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  app.get('/api/multi-accounts/:accountId/state', (req: Request, res: Response) => {
    try {
      const accState = tradingEngine.getAccountState(req.params.accountId);
      res.json({ status: 'ok', state: accState });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  app.delete('/api/multi-accounts/:accountId', (req: Request, res: Response) => {
    try {
      const { accountId } = req.params;
      const success = tradingEngine.deleteAccount(accountId);
      res.json({ status: 'ok', success, activeAccountId: tradingEngine.getActiveAccountId() });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Phase 2: Trade Journal API Endpoints
  app.get('/api/trade-journal', (req: Request, res: Response) => {
    try {
      const accountId = req.query.accountId as string | undefined;
      const journal = tradingEngine.getTradeJournalEntries(accountId);
      res.json({ status: 'ok', journal });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  app.post('/api/trade-journal/add', async (req: Request, res: Response) => {
    try {
      const accountId = req.body?.accountId as string | undefined;
      const entry = await tradingEngine.addTradeJournalEntry(req.body || {}, accountId);
      res.json({ status: 'ok', entry });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Copilot & Analyst API Endpoints
  app.get('/api/trading/copilot/config', (req: Request, res: Response) => {
    try {
      const accountId = req.query.accountId as string | undefined;
      const config = tradingEngine.getCopilotConfig(accountId);
      res.json({ status: 'ok', config });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  app.post('/api/trading/copilot/config', (req: Request, res: Response) => {
    try {
      const { accountId, ...updates } = req.body;
      const targetId = accountId || tradingEngine.getActiveAccountId();
      const updated = tradingEngine.updateCopilotConfig(targetId, updates);
      res.json({ status: 'ok', config: updated });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  app.get('/api/trading/copilot/opportunities', (req: Request, res: Response) => {
    try {
      const accountId = req.query.accountId as string | undefined;
      const opportunities = tradingEngine.getCopilotOpportunities(accountId);
      res.json({ status: 'ok', opportunities });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  app.post('/api/trading/copilot/generate-opportunity', async (req: Request, res: Response) => {
    try {
      const { symbol, accountId, style } = req.body || {};
      const opportunity = await tradingEngine.generateCopilotOpportunity(symbol, accountId, style);
      res.json({ status: 'ok', opportunity });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  app.post('/api/trading/copilot/execute-opportunity', async (req: Request, res: Response) => {
    try {
      const { opportunityId, accountId } = req.body || {};
      const result = await tradingEngine.executeCopilotOpportunity(opportunityId, accountId);
      if (result.success) {
        res.json({ status: 'ok', ...result });
      } else {
        res.status(400).json({ status: 'error', message: result.error });
      }
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  app.post('/api/trading/copilot/reject-opportunity', (req: Request, res: Response) => {
    try {
      const { opportunityId, accountId } = req.body || {};
      const success = tradingEngine.rejectCopilotOpportunity(opportunityId, accountId);
      res.json({ status: 'ok', success });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  app.get('/api/trading/copilot/scanner', (req: Request, res: Response) => {
    try {
      const scannerData = tradingEngine.getMarketScannerData();
      res.json({ status: 'ok', scanner: scannerData });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  app.post('/api/trading/analyze', async (req: Request, res: Response) => {
    try {
      const signal = tradingEngine.getTradingSignal();
      const state = tradingEngine.getState();
      const riskAssessment = tradingEngine.getRiskAssessment();
      const aiAnalysis = await tradingEngine.getAIAnalysis();
      const executionResult = tradingEngine.getExecutionResult();
      res.json({
        status: 'ok',
        signal,
        riskAssessment,
        aiAnalysis,
        executionResult,
        market: state.lastTick,
        analyzedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Trading Agent API: MT5 Heartbeat & Tick & Unified Snapshot
  app.post('/api/trading/tick', (req: Request, res: Response) => {
    try {
      const result = tradingEngine.processHeartbeat(req.body || {});
      res.json({ status: 'ok', pendingOrders: result.pendingOrders || [], dataQuality: result.dataQuality });
    } catch (err: any) {
      console.error('[Tick Endpoint Error]:', err);
      res.json({ status: 'ok', pendingOrders: [], error: err?.message || String(err) });
    }
  });

  app.post('/api/trading/snapshot', (req: Request, res: Response) => {
    try {
      const result = tradingEngine.processSnapshot(req.body || {});
      res.json({ status: 'ok', pendingOrders: result.pendingOrders || [], dataQuality: result.dataQuality });
    } catch (err: any) {
      console.error('[Snapshot Endpoint Error]:', err);
      res.json({ status: 'ok', pendingOrders: [], error: err?.message || String(err) });
    }
  });

  // Trading Agent API: Create New Order
  app.post('/api/trading/order', (req: Request, res: Response) => {
    const { symbol, type, lot, sl, tp, source, accountId, clientOrderId } = req.body || {};
    if (!type || !lot) {
      res.status(400).json({ error: 'اطلاعات سفارش کامل نیست (نوع معامله و حجم الزامی است).' });
      return;
    }
    const result = tradingEngine.createOrder({ symbol, type, lot, sl, tp, source: source || 'user_manual', accountId, clientOrderId });
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ success: true, order: result.order });
  });

  // Trading Agent API: Handle Order Result from EA
  app.post('/api/trading/order-result', (req: Request, res: Response) => {
    const { orderId, status, executionPrice, error } = req.body || {};
    if (!orderId || !status) {
      res.status(400).json({ error: 'شناسه سفارش و وضعیت الزامی است.' });
      return;
    }
    tradingEngine.handleOrderResult({ orderId, status, executionPrice, error });
    res.json({ success: true });
  });

  // Trading Agent API: Get EA Code
  app.get('/api/trading/ea-code', (req: Request, res: Response) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    const code = tradingEngine.generateMql5Code(origin);
    res.json({ code });
  });

  // Trading Agent API: System Prompt & Autonomous Engine
  app.get('/api/trading/system-prompt', (req: Request, res: Response) => {
    res.json({ systemPrompt: tradingEngine.getSystemPrompt() });
  });

  app.post('/api/trading/system-prompt', (req: Request, res: Response) => {
    const { systemPrompt } = req.body || {};
    if (!systemPrompt || typeof systemPrompt !== 'string') {
      res.status(400).json({ error: 'متن پرامپت سیستم الزامی است.' });
      return;
    }
    tradingEngine.updateSystemPrompt(systemPrompt);
    res.json({ success: true, message: 'سیستم پرامپت ایجنت با موفقیت بروزرسانی شد.' });
  });

  app.post('/api/trading/autonomous-analyze', (req: Request, res: Response) => {
    const analysis = tradingEngine.runAutonomousAnalysis();
    res.json({ success: true, analysis });
  });

  app.get('/api/trading/autonomous', (req: Request, res: Response) => {
    res.json(tradingEngine.getAutonomousTradingConfig());
  });

  app.post('/api/trading/autonomous', (req: Request, res: Response) => {
    const updated = tradingEngine.setAutonomousTradingConfig(req.body || {});
    res.json({ success: true, config: updated });
  });

  // Trading Agent API: Live Telemetry & Inspector
  app.get('/api/trading/telemetry', (req: Request, res: Response) => {
    const storeState = store.getState();
    const tradingState = tradingEngine.getState();

    res.json({
      keyPool: storeState.keyPool,
      requestLogs: storeState.logs.slice(-50).reverse(), // Last 50 API router logs
      stats: storeState.stats,
      models: storeState.models,
      bridgeStatus: tradingState.bridgeStatus,
      lastTick: tradingState.lastTick,
      tradingLogs: tradingState.tradingLogs.slice(-50).reverse(),
      telegramConnected: tradingState.telegramConnected,
      supabaseStatus: {
        connected: true,
        lastSync: new Date().toISOString(),
      },
      routerStatus: {
        active: true,
        port: 3000,
        strategy: storeState.settings.strategy,
        maxRetries: storeState.settings.maxRetries,
      },
    });
  });

  // Trading Agent API: Scalping Autonomous Analysis Engine (Phase 2)
  app.post('/api/trading/autonomous-analyze', (req: Request, res: Response) => {
    const { accountId, symbol } = req.body || {};
    const analysis = tradingEngine.computeScalpingAnalysis(accountId, symbol || 'XAUUSD.m');
    res.json({ success: true, analysis });
  });

  app.get('/api/trading/signal-history', (req: Request, res: Response) => {
    const history = tradingEngine.getSignalSnapshots();
    res.json({ success: true, history });
  });

  // Trading Agent API: Memory & Instructions (Multi-Account Isolated)
  app.get('/api/trading/memory', (req: Request, res: Response) => {
    const accountId = req.query.accountId as string | undefined;
    res.json({
      memory: tradingEngine.getMemory(accountId),
      messages: tradingEngine.getChatMessages(),
    });
  });

  app.post('/api/trading/memory', async (req: Request, res: Response) => {
    const { category, content, accountId } = req.body || {};
    if (!content) {
      res.status(400).json({ error: 'متن دستورالعمل یا آموزه الزامی است.' });
      return;
    }
    const note = await tradingEngine.addMemoryNote(category || 'دستور کاربری', content, accountId);
    res.json({ success: true, note });
  });

  app.delete('/api/trading/memory/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const accountId = req.query.accountId as string | undefined;
    await tradingEngine.deleteMemoryNote(id, accountId);
    res.json({ success: true });
  });

  // Trading Agent API: Interactive Chat
  app.post('/api/trading/chat', async (req: Request, res: Response) => {
    const { text, accountId } = req.body || {};
    if (!text) {
      res.status(400).json({ error: 'متن پیام الزامی است.' });
      return;
    }
    const result = await tradingEngine.processAgentChat(text, accountId);
    res.json({ success: true, ...result });
  });

  // Trading Agent API: Knowledge Layer (Danesh Experimental Rules)
  app.get('/api/trading/knowledge', async (req: Request, res: Response) => {
    const accountId = req.query.accountId as string | undefined;
    const rules = await tradingEngine.getKnowledgeRules(accountId);
    res.json({ success: true, knowledgeRules: rules });
  });

  app.post('/api/trading/knowledge', async (req: Request, res: Response) => {
    const rule = req.body;
    if (!rule || !rule.title || !rule.descriptionPersian) {
      res.status(400).json({ error: 'اطلاعات قانون دانش کامل نیست.' });
      return;
    }
    const success = await tradingEngine.saveKnowledgeRule(rule);
    res.json({ success });
  });

  app.post('/api/trading/knowledge/toggle', async (req: Request, res: Response) => {
    const { id, isEnabled } = req.body || {};
    if (!id) {
      res.status(400).json({ error: 'شناسه قانون دانش مشخص نیست.' });
      return;
    }
    const success = await tradingEngine.toggleKnowledgeRule(id, !!isEnabled);
    res.json({ success });
  });

  app.delete('/api/trading/knowledge/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const success = await tradingEngine.deleteKnowledgeRule(id);
    res.json({ success });
  });

  app.post('/api/trading/knowledge/mine', async (req: Request, res: Response) => {
    const { accountId } = req.body || {};
    const rules = await tradingEngine.mineKnowledgeRules(accountId);
    res.json({ success: true, knowledgeRules: rules });
  });

  // Trading Agent API: Get Supabase SQL & Config
  app.get('/api/trading/supabase-sql', (req: Request, res: Response) => {
    const sql = `-- ====================================================================
-- Hermes Agent v3 - Complete Idempotent Supabase Database Schema Query
-- Safe to run multiple times: Creates missing tables, alters existing ones,
-- configures RLS policies, indexes, views, and seed data without errors.
-- ====================================================================

-- 1. Table: user_profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT DEFAULT 'trader',
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist in user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'trader';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Table: risk_rules
CREATE TABLE IF NOT EXISTS public.risk_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT TRUE,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.risk_rules ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.risk_rules ADD COLUMN IF NOT EXISTS value NUMERIC DEFAULT 0;
ALTER TABLE public.risk_rules ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT '%';
ALTER TABLE public.risk_rules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Table: trade_orders
CREATE TABLE IF NOT EXISTS public.trade_orders (
  id TEXT PRIMARY KEY,
  account_id TEXT DEFAULT 'account_default',
  symbol TEXT NOT NULL,
  type TEXT NOT NULL,
  lot NUMERIC NOT NULL,
  sl NUMERIC,
  tp NUMERIC,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  execution_price NUMERIC,
  error TEXT
);

ALTER TABLE public.trade_orders ADD COLUMN IF NOT EXISTS account_id TEXT DEFAULT 'account_default';
ALTER TABLE public.trade_orders ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;
ALTER TABLE public.trade_orders ADD COLUMN IF NOT EXISTS execution_price NUMERIC;
ALTER TABLE public.trade_orders ADD COLUMN IF NOT EXISTS error TEXT;

-- 4. Table: trading_logs
CREATE TABLE IF NOT EXISTS public.trading_logs (
  id TEXT PRIMARY KEY,
  account_id TEXT DEFAULT 'account_default',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  type TEXT NOT NULL,
  message TEXT NOT NULL
);

ALTER TABLE public.trading_logs ADD COLUMN IF NOT EXISTS account_id TEXT DEFAULT 'account_default';

-- 5. Table: agent_memory
CREATE TABLE IF NOT EXISTS public.agent_memory (
  id TEXT PRIMARY KEY,
  account_id TEXT,
  category TEXT DEFAULT 'general',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.agent_memory ADD COLUMN IF NOT EXISTS account_id TEXT;
ALTER TABLE public.agent_memory ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';

-- 6. Table: agent_chat_messages
CREATE TABLE IF NOT EXISTS public.agent_chat_messages (
  id TEXT PRIMARY KEY,
  account_id TEXT,
  sender TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.agent_chat_messages ADD COLUMN IF NOT EXISTS account_id TEXT;
ALTER TABLE public.agent_chat_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 7. Table: trade_journal (Professional Multi-Account Journal Engine)
CREATE TABLE IF NOT EXISTS public.trade_journal (
  id TEXT PRIMARY KEY,
  account_id TEXT DEFAULT 'account_default',
  account_number NUMERIC,
  symbol TEXT DEFAULT 'XAUUSD',
  timeframe TEXT DEFAULT 'M15',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  ask NUMERIC DEFAULT 0,
  bid NUMERIC DEFAULT 0,
  spread NUMERIC DEFAULT 0,
  candles_summary JSONB,
  indicators_snapshot JSONB,
  decision TEXT DEFAULT 'NO_TRADE',
  confidence NUMERIC DEFAULT 0,
  persian_analysis TEXT,
  english_analysis TEXT,
  confluence_reasons JSONB,
  order_type TEXT,
  lot NUMERIC,
  entry_price NUMERIC,
  sl NUMERIC,
  tp NUMERIC,
  exit_price NUMERIC,
  exit_time TIMESTAMPTZ,
  pnl_usd NUMERIC,
  pnl_points NUMERIC,
  status TEXT DEFAULT 'PROPOSED',
  execution_error TEXT,
  strategy_name TEXT,
  risk_score NUMERIC DEFAULT 0,
  news_filter_passed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist in trade_journal if table was created previously
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS account_id TEXT DEFAULT 'account_default';
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS account_number NUMERIC;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS symbol TEXT DEFAULT 'XAUUSD';
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS timeframe TEXT DEFAULT 'M15';
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS ask NUMERIC DEFAULT 0;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS bid NUMERIC DEFAULT 0;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS spread NUMERIC DEFAULT 0;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS candles_summary JSONB;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS indicators_snapshot JSONB;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS decision TEXT DEFAULT 'NO_TRADE';
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS confidence NUMERIC DEFAULT 0;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS persian_analysis TEXT;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS english_analysis TEXT;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS confluence_reasons JSONB;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS order_type TEXT;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS lot NUMERIC;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS entry_price NUMERIC;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS sl NUMERIC;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS tp NUMERIC;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS exit_price NUMERIC;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS exit_time TIMESTAMPTZ;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS pnl_usd NUMERIC;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS pnl_points NUMERIC;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PROPOSED';
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS execution_error TEXT;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS strategy_name TEXT;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS risk_score NUMERIC DEFAULT 0;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS news_filter_passed BOOLEAN DEFAULT TRUE;
ALTER TABLE public.trade_journal ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 8. View Alias: hermes_trade_journal
CREATE OR REPLACE VIEW public.hermes_trade_journal AS
SELECT * FROM public.trade_journal;

-- 9. Create Performance Indexes for Multi-Account Filtering
CREATE INDEX IF NOT EXISTS idx_trade_journal_account_id ON public.trade_journal(account_id);
CREATE INDEX IF NOT EXISTS idx_trade_journal_timestamp ON public.trade_journal(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memory_account_id ON public.agent_memory(account_id);
CREATE INDEX IF NOT EXISTS idx_agent_chat_messages_account_id ON public.agent_chat_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_trade_orders_account_id ON public.trade_orders(account_id);
CREATE INDEX IF NOT EXISTS idx_trading_logs_account_id ON public.trading_logs(account_id);

-- 10. Row Level Security (RLS) Configuration
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_knowledge ENABLE ROW LEVEL SECURITY;

-- Safely recreate permissive policies for API client access
DROP POLICY IF EXISTS "Public full access user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Public full access risk_rules" ON public.risk_rules;
DROP POLICY IF EXISTS "Public full access trade_orders" ON public.trade_orders;
DROP POLICY IF EXISTS "Public full access trading_logs" ON public.trading_logs;
DROP POLICY IF EXISTS "Public full access agent_memory" ON public.agent_memory;
DROP POLICY IF EXISTS "Public full access agent_chat_messages" ON public.agent_chat_messages;
DROP POLICY IF EXISTS "Public full access trade_journal" ON public.trade_journal;
DROP POLICY IF EXISTS "Public full access agent_knowledge" ON public.agent_knowledge;

CREATE POLICY "Public full access user_profiles" ON public.user_profiles FOR ALL USING (true);
CREATE POLICY "Public full access risk_rules" ON public.risk_rules FOR ALL USING (true);
CREATE POLICY "Public full access trade_orders" ON public.trade_orders FOR ALL USING (true);
CREATE POLICY "Public full access trading_logs" ON public.trading_logs FOR ALL USING (true);
CREATE POLICY "Public full access agent_memory" ON public.agent_memory FOR ALL USING (true);
CREATE POLICY "Public full access agent_chat_messages" ON public.agent_chat_messages FOR ALL USING (true);
CREATE POLICY "Public full access trade_journal" ON public.trade_journal FOR ALL USING (true);
CREATE POLICY "Public full access agent_knowledge" ON public.agent_knowledge FOR ALL USING (true);

-- 11. Seed Data: Master Admin Account & Initial Risk Rules
DO $$
BEGIN
  -- Safely insert or update master admin user profile regardless of whether 'id' is UUID or TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND table_schema = 'public' AND data_type LIKE '%uuid%' AND column_name = 'id'
  ) THEN
    INSERT INTO public.user_profiles (id, email, full_name, role, is_approved)
    VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'raadtaxi1@gmail.com', 'مدیر ارشد هرمس', 'admin', true)
    ON CONFLICT (email) DO UPDATE SET is_approved = true, role = 'admin';
  ELSE
    INSERT INTO public.user_profiles (id, email, full_name, role, is_approved)
    VALUES ('00000000-0000-0000-0000-000000000001', 'raadtaxi1@gmail.com', 'مدیر ارشد هرمس', 'admin', true)
    ON CONFLICT (email) DO UPDATE SET is_approved = true, role = 'admin';
  END IF;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, role, is_approved)
    VALUES ('00000000-0000-0000-0000-000000000001', 'raadtaxi1@gmail.com', 'مدیر ارشد هرمس', 'admin', true)
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

INSERT INTO public.risk_rules (id, name, description, is_enabled, value, unit)
VALUES
  ('rule_max_daily_loss', 'حداکثر حد ضرر روزانه (Daily Loss Limit)', 'جلوگیری از زیان روزانه بیش از حد مشخص شده', true, 3.0, '%'),
  ('rule_max_drawdown', 'حداکثر افت حساب (Max Drawdown)', 'سقف مجاز افت کلی بالانس حساب', true, 6.0, '%'),
  ('rule_max_lot_size', 'حداکثر حجم معامله (Max Lot Size)', 'سقف حجم هر پوزیشن معامله', true, 1.0, 'Lot'),
  ('rule_min_margin_level', 'حداقل سطح مارجین (Min Margin Level)', 'حداقل سطح مارجین مجاز جهت ورود به معامله جدید', true, 200.0, '%'),
  ('rule_max_spread_points', 'حداکثر اسپرد مجاز (Max Spread)', 'عدم ورود به معامله در صورت بالاتر بودن اسپرد', true, 35.0, 'Points')
ON CONFLICT (id) DO NOTHING;
`;
    res.json({
      sql,
      url: process.env.SUPABASE_URL || 'https://dqhujeggbndwcavzgnhm.supabase.co',
      anonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxaHVqZWdnYm5kd2NhdnpnbmhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNzM2MDcsImV4cCI6MjEwMDk0OTYwN30.ixW2V-WWQnOB8q4REtuF1KK3-bULS7fWw5NIg43EpV4',
    });
  });

  // Trading Agent API: Update Risk Rules
  app.post('/api/trading/rules', (req: Request, res: Response) => {
    const { rules } = req.body || {};
    if (!Array.isArray(rules)) {
      res.status(400).json({ error: 'آرایه قوانین نامعتبر است.' });
      return;
    }
    tradingEngine.updateRiskRules(rules);
    res.json({ success: true, message: 'قوانین ریسک به‌روزرسانی شد.' });
  });

  // Admin API: Admin Login Verification
  app.post('/api/admin/login', (req: Request, res: Response) => {
    const { password } = req.body;
    const requiredSecret = process.env.ADMIN_SECRET || 'hermes-admin-pass-2026';

    if (password === requiredSecret) {
      res.json({ success: true, token: requiredSecret });
    } else {
      res.status(401).json({ success: false, message: 'رمز عبور مدیریت نادرست است.' });
    }
  });

  // Admin API: Update Models
  app.post('/api/admin/models', (req: Request, res: Response) => {
    const { models } = req.body;
    if (Array.isArray(models)) {
      store.updateModels(models);
      res.json({ success: true, message: 'تنظیمات مدل‌ها به‌روزرسانی شد.' });
    } else {
      res.status(400).json({ error: 'آرایه مدل‌ها نامعتبر است.' });
    }
  });

  // Admin API: Update Settings
  app.post('/api/admin/settings', (req: Request, res: Response) => {
    const { settings } = req.body;
    if (settings) {
      store.updateSettings(settings);
      res.json({ success: true, message: 'تنظیمات روتر به‌روزرسانی شد.' });
    } else {
      res.status(400).json({ error: 'داده‌های تنظیمات نامعتبر است.' });
    }
  });

  // Admin API: Update Agents
  app.post('/api/admin/agents', (req: Request, res: Response) => {
    const { agents } = req.body;
    if (Array.isArray(agents)) {
      store.updateAgents(agents);
      res.json({ success: true, message: 'لیست ایجنت‌ها به‌روزرسانی شد.' });
    } else {
      res.status(400).json({ error: 'لیست ایجنت‌ها نامعتبر است.' });
    }
  });

  // Admin API: Clear Logs
  app.delete('/api/admin/logs', (req: Request, res: Response) => {
    store.clearLogs();
    res.json({ success: true, message: 'تمام گزارش‌ها با موفقیت پاکسازی شدند.' });
  });

  // Vite Integration for Development vs Production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Hermes Cloud Router] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
