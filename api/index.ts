import express, { Request, Response } from 'express';
import { routerEngine } from '../src/backend/routerEngine.js';
import { store } from '../src/backend/store.js';
import { tradingEngine } from '../src/backend/tradingEngine.js';

const app = express();

app.use(express.json({ limit: '10mb' }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Agent-ID');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Healthcheck
app.get('/api/health', (req: Request, res: Response) => {
  const state = store.getState();
  res.json({
    status: 'ok',
    service: 'Hermes Cloud Router (Vercel Serverless)',
    activeKeys: state.stats.activeKeysCount,
    activeModels: state.stats.activeModelsCount,
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// Trading Agent & MetaTrader 5 Ambassador API
// ==========================================

// EA Heartbeat & Tick endpoint (MT5 Ambassador posts ticks and receives pending orders)
app.post('/api/trading/tick', (req: Request, res: Response) => {
  const result = tradingEngine.processHeartbeat(req.body);
  res.json(result);
});

// Order Execution Result endpoint (MT5 Ambassador posts order fill status)
app.post('/api/trading/order-result', (req: Request, res: Response) => {
  const { orderId, status, executionPrice, error } = req.body;
  const success = tradingEngine.handleOrderResult({ orderId, status, executionPrice, error });
  res.json({ success });
});

// Get Full Trading State (UI Dashboard polls this)
app.get('/api/trading/state', (req: Request, res: Response) => {
  res.json(tradingEngine.getState());
});

// Create Order (Dispatch manual trade or AI agent trade)
app.post('/api/trading/order', (req: Request, res: Response) => {
  const { symbol, type, lot, sl, tp, source } = req.body;
  const result = tradingEngine.createOrder({
    symbol: symbol || 'XAUUSD',
    type: type || 'BUY',
    lot: Number(lot) || 0.01,
    sl: sl ? Number(sl) : undefined,
    tp: tp ? Number(tp) : undefined,
    source: source || 'user_manual',
  });
  if (!result.success) {
    res.status(400).json(result);
  } else {
    res.json(result);
  }
});

// Update Risk Rules (User updates strategy parameters)
app.post('/api/trading/rules', (req: Request, res: Response) => {
  const { rules } = req.body;
  if (Array.isArray(rules)) {
    tradingEngine.updateRiskRules(rules);
    res.json({ success: true, message: 'قوانین ریسک با موفقیت به‌روزرسانی شدند.' });
  } else {
    res.status(400).json({ error: 'آرایه قوانین نامعتبر است.' });
  }
});

// Download/Get MQL5 Ambassador Code
app.get('/api/trading/ea-code', (req: Request, res: Response) => {
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const serverUrl = `${protocol}://${host}`;
  const code = tradingEngine.generateMql5Code(serverUrl);
  res.json({ serverUrl, code });
});

// Get Supabase Setup Query & Status
app.get('/api/trading/supabase-sql', (req: Request, res: Response) => {
  const sql = `-- =====================================================================
-- HERMES TRADING AGENT - SUPABASE FULL DATABASE SCHEMA & RLS POLICIES
-- Project URL: https://dqhujeggbndwcavzgnhm.supabase.co
-- =====================================================================

-- 1. Create User Profiles Table (Integrated with Supabase Auth)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'user',
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Risk Rules Table (Strategy parameters & limits)
CREATE TABLE IF NOT EXISTS public.risk_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT TRUE,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Trade Orders Table (Pending and executed order history)
CREATE TABLE IF NOT EXISTS public.trade_orders (
  id TEXT PRIMARY KEY,
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

-- 4. Create Trading Logs Table (AI reflections, signals, and agent events)
CREATE TABLE IF NOT EXISTS public.trading_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB
);

-- 5. Seed Default Risk Rules
INSERT INTO public.risk_rules (id, name, description, is_enabled, value, unit)
VALUES
  ('max_risk_per_trade', 'حداکثر ریسک هر معامله', 'درصد مجاز ریسک از موجودی (Equity) برای هر پوزیشن جدید', true, 1.0, 'percentage'),
  ('max_daily_drawdown', 'حداکثر افت روزانه حساب (Daily Loss)', 'سقف زیان روزانه متوالی قبل از توقف خودکار ربات', true, 3.0, 'percentage'),
  ('max_lot_size', 'حداکثر حجم معامله (Max Lot)', 'سقف مجاز لات برای هر سفارش ارسالی', true, 0.1, 'lot'),
  ('max_open_positions', 'حداکثر پوزیشن‌های همزمان باز', 'تعداد مجاز معاملات باز همزمان روی متاتریدر', true, 2.0, 'usd'),
  ('require_sl_tp', 'الزامی بودن حد ضرر (Stop-Loss)', 'جلوگیری از ارسال هرگونه معامله بدون حد ضرر مشخص', true, 1.0, 'boolean')
ON CONFLICT (id) DO NOTHING;

-- 6. Trigger to automatically create a user_profiles record when a new user registers in Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    'user',
    FALSE
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_logs ENABLE ROW LEVEL SECURITY;

-- 8. Define RLS Access Policies
CREATE POLICY "Allow public read for user_profiles" ON public.user_profiles FOR SELECT USING (true);
CREATE POLICY "Allow anon and auth insert/update user_profiles" ON public.user_profiles FOR ALL USING (true);

CREATE POLICY "Allow public read for risk_rules" ON public.risk_rules FOR SELECT USING (true);
CREATE POLICY "Allow full access for risk_rules" ON public.risk_rules FOR ALL USING (true);

CREATE POLICY "Allow public read for trade_orders" ON public.trade_orders FOR SELECT USING (true);
CREATE POLICY "Allow full access for trade_orders" ON public.trade_orders FOR ALL USING (true);

CREATE POLICY "Allow public read for trading_logs" ON public.trading_logs FOR SELECT USING (true);
CREATE POLICY "Allow full access for trading_logs" ON public.trading_logs FOR ALL USING (true);
`;

  res.json({
    url: process.env.SUPABASE_URL || 'https://dqhujeggbndwcavzgnhm.supabase.co',
    anonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxaHVqZWdnYm5kd2NhdnpnbmhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNzM2MDcsImV4cCI6MjEwMDk0OTYwN30.ixW2V-WWQnOB8q4REtuF1KK3-bULS7fWw5NIg43EpV4',
    sql,
  });
});

// Models list
app.get('/api/v1/models', (req: Request, res: Response) => {
  const state = store.getState();
  const modelsList = [...state.models]
    .filter((m) => m.isEnabled)
    .sort((a, b) => a.priorityRank - b.priorityRank)
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

// Runtime Models Info Debug Endpoint
app.get('/api/v1/router/runtime-models', (req: Request, res: Response) => {
  res.json(routerEngine.getRuntimeModelsInfo());
});

// Last Request Execution Debug Endpoint
app.get(['/api/v1/router/last-request', '/api/v1/debug/last-request'], (req: Request, res: Response) => {
  const debug = routerEngine.getLastRequestDebug();
  if (!debug) {
    res.json({
      message: 'No request recorded yet since server boot.',
      requestedModel: null,
      selectedModel: null,
      keyIndex: 0,
      attempts: 0,
      fallbackUsed: false,
      errorReason: null,
      attemptDetails: [],
    });
    return;
  }
  res.json(debug);
});

// Chat completions
app.post('/api/v1/chat/completions', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const agentIdHeader = req.headers['x-agent-id'] as string | undefined;

    const agentProfile = routerEngine.resolveAgent(authHeader, agentIdHeader);

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
            reason: routeResult.error.reason,
            failed_models: routeResult.error.failed_models,
            excluded_models: routeResult.error.excluded_models,
            attempts: routeResult.error.attempts,
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

// State API
app.get('/api/admin/state', (req: Request, res: Response) => {
  res.json(store.getState());
});

// Admin Login
app.post('/api/admin/login', (req: Request, res: Response) => {
  const { password } = req.body;
  const requiredSecret = process.env.ADMIN_SECRET || 'hermes-admin-pass-2026';

  if (password === requiredSecret) {
    res.json({ success: true, token: requiredSecret });
  } else {
    res.status(401).json({ success: false, message: 'رمز عبور مدیریت نادرست است.' });
  }
});

// Update Models
app.post('/api/admin/models', (req: Request, res: Response) => {
  const { models } = req.body;
  if (Array.isArray(models)) {
    store.updateModels(models);
    res.json({ success: true, message: 'تنظیمات مدل‌ها به‌روزرسانی شد.' });
  } else {
    res.status(400).json({ error: 'آرایه مدل‌ها نامعتبر است.' });
  }
});

// Update Settings
app.post('/api/admin/settings', (req: Request, res: Response) => {
  const { settings } = req.body;
  if (settings) {
    store.updateSettings(settings);
    res.json({ success: true, message: 'تنظیمات روتر به‌روزرسانی شد.' });
  } else {
    res.status(400).json({ error: 'داده‌های تنظیمات نامعتبر است.' });
  }
});

// Update Agents
app.post('/api/admin/agents', (req: Request, res: Response) => {
  const { agents } = req.body;
  if (Array.isArray(agents)) {
    store.updateAgents(agents);
    res.json({ success: true, message: 'لیست ایجنت‌ها به‌روزرسانی شد.' });
  } else {
    res.status(400).json({ error: 'لیست ایجنت‌ها نامعتبر است.' });
  }
});

// Clear Logs
app.delete('/api/admin/logs', (req: Request, res: Response) => {
  store.clearLogs();
  res.json({ success: true, message: 'تمام گزارش‌ها با موفقیت پاکسازی شدند.' });
});

// ==========================================
// TRADING AGENT API ENDPOINTS (FOR VERCEL & SERVER)
// ==========================================

// Trading Agent API: Get State
app.get('/api/trading/state', (req: Request, res: Response) => {
  res.json(tradingEngine.getState());
});

// Trading Agent API: MT5 Heartbeat & Tick
app.post('/api/trading/tick', (req: Request, res: Response) => {
  const result = tradingEngine.processHeartbeat(req.body || {});
  res.json({ status: 'ok', pendingOrders: result.pendingOrders });
});

// Trading Agent API: Create New Order
app.post('/api/trading/order', (req: Request, res: Response) => {
  const { symbol, type, lot, sl, tp, source } = req.body || {};
  if (!symbol || !type || !lot) {
    res.status(400).json({ error: 'اطلاعات سفارش کامل نیست (نماد، نوع معامله و حجم الزامی است).' });
    return;
  }
  const result = tradingEngine.createOrder({ symbol, type, lot, sl, tp, source: source || 'user_manual' });
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

// Trading Agent API: Memory & Instructions
app.get('/api/trading/memory', (req: Request, res: Response) => {
  res.json({
    memory: tradingEngine.getMemory(),
    messages: tradingEngine.getChatMessages(),
  });
});

app.post('/api/trading/memory', async (req: Request, res: Response) => {
  const { category, content } = req.body || {};
  if (!content) {
    res.status(400).json({ error: 'متن دستورالعمل یا آموزه الزامی است.' });
    return;
  }
  const note = await tradingEngine.addMemoryNote(category || 'دستور کاربری', content);
  res.json({ success: true, note });
});

app.delete('/api/trading/memory/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  await tradingEngine.deleteMemoryNote(id);
  res.json({ success: true });
});

// Trading Agent API: Interactive Chat
app.post('/api/trading/chat', async (req: Request, res: Response) => {
  const { text } = req.body || {};
  if (!text) {
    res.status(400).json({ error: 'متن پیام الزامی است.' });
    return;
  }
  const result = await tradingEngine.processAgentChat(text);
  res.json({ success: true, ...result });
});

// Trading Agent API: Get Supabase SQL & Config
app.get('/api/trading/supabase-sql', (req: Request, res: Response) => {
  const sql = `-- Complete Supabase Schema for Hermes Trading Agent
-- Execute this SQL in Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT DEFAULT 'user',
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.risk_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT TRUE,
  value NUMERIC,
  unit TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.trade_orders (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  type TEXT NOT NULL,
  lot NUMERIC NOT NULL,
  sl NUMERIC,
  tp NUMERIC,
  status TEXT DEFAULT 'PENDING',
  execution_price NUMERIC,
  source TEXT DEFAULT 'ai_agent',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.trading_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  type TEXT,
  message TEXT,
  data JSONB
);

CREATE TABLE IF NOT EXISTS public.agent_memory (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id TEXT PRIMARY KEY,
  sender TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
`;

  res.json({
    url: process.env.SUPABASE_URL || 'https://dqhujeggbndwcavzgnhm.supabase.co',
    anonKey: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxaHVqZWdnYm5kd2NhdnpnbmhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNzM2MDcsImV4cCI6MjEwMDk0OTYwN30.ixW2V-WWQnOB8q4REtuF1KK3-bULS7fWw5NIg43EpV4',
    sql,
  });
});

export default app;
