import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { routerEngine } from './src/backend/routerEngine.js';
import { store } from './src/backend/store.js';
import { tradingEngine } from './src/backend/tradingEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // Trading Agent API: Get Supabase SQL & Config
  app.get('/api/trading/supabase-sql', (req: Request, res: Response) => {
    const sql = `-- Supabase Schema for Hermes Trading Agent Integration

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
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.trading_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  type TEXT NOT NULL,
  message TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_logs ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for demo
CREATE POLICY "Public full access user_profiles" ON public.user_profiles FOR ALL USING (true);
CREATE POLICY "Public full access risk_rules" ON public.risk_rules FOR ALL USING (true);
CREATE POLICY "Public full access trade_orders" ON public.trade_orders FOR ALL USING (true);
CREATE POLICY "Public full access trading_logs" ON public.trading_logs FOR ALL USING (true);
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
